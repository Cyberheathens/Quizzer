const { sql, initDB } = require('./_db.cjs');
const { fire } = require('./_pusher.cjs');

async function getQuizSnapshot(roomId, quizId) {
  const quizzes = await sql`SELECT * FROM quizzes WHERE id = ${quizId} AND room_id = ${roomId}`;
  if (quizzes.length === 0) return null;
  const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC`;
  return {
    quiz: quizzes[0],
    questions: questions.map((p) => ({
      ...p,
      options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
    })),
  };
}

async function aggregateResults(pollId) {
  const votes = await sql`SELECT selected_options FROM votes WHERE poll_id = ${pollId}`;
  const counts = {};
  votes.forEach((v) => {
    const opts = Array.isArray(v.selected_options) ? v.selected_options : [];
    opts.forEach((o) => {
      counts[o] = (counts[o] || 0) + 1;
    });
  });
  return Object.entries(counts).map(([idx, count]) => ({ optionIndex: parseInt(idx), count }));
}

module.exports = async function handler(req, res) {
  await initDB();

  if (req.method === 'POST') {
    const { roomId, title, questions } = req.body;
    if (!roomId || !title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Room ID, title, and at least 1 question required' });
    }

    const quizResult = await sql`
      INSERT INTO quizzes (room_id, title) VALUES (${roomId}, ${title}) RETURNING *
    `;
    const quiz = quizResult[0];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await sql`
        INSERT INTO polls (room_id, quiz_id, order_index, question, poll_type, options, correct_answers, timer_seconds, question_image, phase)
        VALUES (
          ${roomId}, ${quiz.id}, ${i}, ${q.question}, ${q.pollType || 'single'},
          ${JSON.stringify(q.options.map((o, j) => ({ id: j, text: o.text, is_correct: o.isCorrect })))},
          ${q.options.map((o) => (o.isCorrect ? 1 : 0)).length ? q.options.map((o, j) => (o.isCorrect ? j : -1)).filter((j) => j >= 0) : '{}'},
          ${q.timerSeconds || null},
          ${q.questionImage || null},
          'draft'
        )
      `;
    }

    const snap = await getQuizSnapshot(roomId, quiz.id);
    return res.status(201).json(snap);
  }

  if (req.method === 'GET') {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID required' });
    }

    const quizzes = await sql`SELECT * FROM quizzes WHERE room_id = ${roomId} ORDER BY created_at DESC`;
    const out = [];
    for (const quiz of quizzes) {
      const qs = await sql`SELECT * FROM polls WHERE quiz_id = ${quiz.id} ORDER BY order_index ASC`;
      out.push({
        quiz,
        questions: qs.map((p) => ({
          ...p,
          options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
        })),
      });
    }
    return res.status(200).json(out);
  }

  if (req.method === 'PATCH') {
    const { quizId, action } = req.body;
    if (!quizId || !action) {
      return res.status(400).json({ error: 'Quiz ID and action required' });
    }

    const quizRows = await sql`SELECT * FROM quizzes WHERE id = ${quizId}`;
    if (quizRows.length === 0) return res.status(404).json({ error: 'Quiz not found' });
    const quiz = quizRows[0];

    if (action === 'delete') {
      if (quiz.active_index !== null && quiz.active_index !== undefined) {
        return res.status(409).json({ error: 'Launched quizzes cannot be deleted' });
      }
      await sql`DELETE FROM quizzes WHERE id = ${quizId}`;
      return res.status(200).json({ success: true });
    }

    if (action === 'launch') {
      if (quiz.active_index !== null && quiz.active_index !== undefined) {
        return res.status(409).json({ error: 'Quiz already launched' });
      }
      const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC LIMIT 1`;
      if (questions.length === 0) return res.status(409).json({ error: 'Quiz has no questions' });

      await sql`UPDATE quizzes SET active_index = 0 WHERE id = ${quizId}`;
      await sql`UPDATE polls SET phase = 'voting_open', launched_at = now() WHERE quiz_id = ${quizId} AND order_index = 0`;

      const snap = await getQuizSnapshot(quiz.room_id, quizId);
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${quiz.room_id}`;
      if (rooms.length > 0) {
        await fire(`room-${rooms[0].code}`, 'poll:new', snap.questions[0]);
      }
      return res.status(200).json(snap);
    }

    if (action === 'lock' || action === 'reveal') {
      if (quiz.active_index === null || quiz.active_index === undefined) {
        return res.status(409).json({ error: 'Quiz not launched yet' });
      }
      const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC`;
      const current = questions[quiz.active_index];
      if (!current) return res.status(404).json({ error: 'No active question' });

      const newPhase = action === 'lock' ? 'voting_locked' : 'results_shown';
      await sql`UPDATE polls SET phase = ${newPhase(action)} WHERE id = ${current.id}`;
      const voteResults = await aggregateResults(current.id);

      const rooms = await sql`SELECT code FROM rooms WHERE id = ${quiz.room_id}`;
      if (rooms.length > 0) {
        const updated = await sql`SELECT * FROM polls WHERE id = ${current.id}`;
        const poll = { ...updated[0], options: typeof updated[0].options === 'string' ? JSON.parse(updated[0].options) : updated[0].options };
        await fire(`room-${rooms[0].code}`, 'poll:update', { ...poll, voteResults });
      }

      const snap = await getQuizSnapshot(quiz.room_id, quizId);
      return res.status(200).json({ ...snap, voteResults });
    }

    if (action === 'next') {
      const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC`;
      if (quiz.active_index === null || quiz.active_index === undefined) {
        return res.status(409).json({ error: 'Quiz not launched yet' });
      }
      const nextIndex = quiz.active_index + 1;
      if (nextIndex >= questions.length) {
        return res.status(409).json({ error: 'Quiz finished — no more questions' });
      }

      const current = questions[quiz.active_index];
      if (current.phase === 'voting_open') {
        await sql`UPDATE polls SET phase = 'voting_locked' WHERE id = ${current.id}`;
      }

      await sql`UPDATE polls SET phase = 'voting_open', launched_at = now() WHERE id = ${questions[nextIndex].id}`;
      await sql`UPDATE quizzes SET active_index = ${nextIndex} WHERE id = ${quizId}`;

      const rooms = await sql`SELECT code FROM rooms WHERE id = ${quiz.room_id}`;
      if (rooms.length > 0) {
        const updated = await sql`SELECT * FROM polls WHERE id = ${questions[nextIndex].id}`;
        const poll = { ...updated[0], options: typeof updated[0].options === 'string' ? JSON.parse(updated[0].options) : updated[0].options };
        await fire(`room-${rooms[0].code}`, 'poll:new', poll);
      }

      const snap = await getQuizSnapshot(quiz.room_id, quizId);
      return res.status(200).json(snap);
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function newPhase(action) {
  return action === 'lock' ? 'voting_locked' : 'results_shown';
}