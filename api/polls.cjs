const { sql, initDB } = require('../_db.cjs');
const { fire } = require('../_pusher.cjs');

function parseOptions(rows) {
  return rows.map((p) => ({
    ...p,
    options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
  }));
}

module.exports = async function handler(req, res) {
  await initDB();

  if (req.method === 'POST') {
    const { roomId, question, pollType, options, timerSeconds, questionImage, launch } = req.body;
    if (!roomId || !question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Room ID, question, and at least 2 options required' });
    }

    const phase = launch ? 'voting_open' : 'draft';
    const result = await sql`
      INSERT INTO polls (room_id, question, poll_type, options, correct_answers, timer_seconds, question_image, phase, launched_at)
      VALUES (
        ${roomId},
        ${question},
        ${pollType || 'single'},
        ${JSON.stringify(options.map((o, i) => ({ id: i, text: o.text, is_correct: o.isCorrect })))},
        ${options.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i >= 0)},
        ${timerSeconds || null},
        ${questionImage || null},
        ${phase},
        CASE WHEN ${!!launch} THEN now() ELSE NULL END
      )
      RETURNING *
    `;

    const poll = result[0];
    poll.options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

    if (launch) {
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${roomId}`;
      if (rooms.length > 0) {
        await fire(`room-${rooms[0].code}`, 'poll:new', poll);
      }
    }

    return res.status(201).json(poll);
  }

  if (req.method === 'GET') {
    const { roomId, includeDrafts } = req.query;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID required' });
    }

    const rows = includeDrafts === '1'
      ? await sql`SELECT * FROM polls WHERE room_id = ${roomId} ORDER BY created_at DESC`
      : await sql`SELECT * FROM polls WHERE room_id = ${roomId} AND phase != 'draft' ORDER BY created_at DESC`;

    return res.status(200).json(parseOptions(rows));
  }

  if (req.method === 'PATCH') {
    const { pollId, phase, action, question, options, questionImage, timerSeconds } = req.body;
    if (!pollId) {
      return res.status(400).json({ error: 'Poll ID required' });
    }

    if (action === 'launch') {
      const current = await sql`SELECT phase FROM polls WHERE id = ${pollId}`;
      if (current.length === 0) return res.status(404).json({ error: 'Poll not found' });
      if (current[0].phase !== 'draft') return res.status(409).json({ error: 'Poll already launched' });

      const result = await sql`UPDATE polls SET phase = 'voting_open', launched_at = now() WHERE id = ${pollId} RETURNING *`;
      const poll = result[0];
      poll.options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

      const rooms = await sql`SELECT code FROM rooms WHERE id = ${poll.room_id}`;
      if (rooms.length > 0) {
        await fire(`room-${rooms[0].code}`, 'poll:new', poll);
      }
      return res.status(200).json(poll);
    }

    if (action === 'update') {
      const current = await sql`SELECT phase FROM polls WHERE id = ${pollId}`;
      if (current.length === 0) return res.status(404).json({ error: 'Poll not found' });
      if (current[0].phase !== 'draft') return res.status(409).json({ error: 'Only drafts can be edited' });

      const opts = options
        ? JSON.stringify(options.map((o, i) => ({ id: i, text: o.text, is_correct: o.isCorrect })))
        : null;
      const correct = options
        ? options.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i >= 0)
        : null;

      const result = await sql`
        UPDATE polls SET
          question = COALESCE(${question ?? null}, question),
          options = COALESCE(${opts}, options),
          correct_answers = COALESCE(${correct}, correct_answers),
          question_image = ${questionImage ?? null},
          timer_seconds = ${timerSeconds ?? null}
        WHERE id = ${pollId} RETURNING *
      `;
      const poll = result[0];
      poll.options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;
      return res.status(200).json(poll);
    }

    if (phase) {
      const result = await sql`UPDATE polls SET phase = ${phase} WHERE id = ${pollId} RETURNING *`;
      if (result.length === 0) return res.status(404).json({ error: 'Poll not found' });

      const poll = result[0];
      poll.options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

      let voteResults = [];
      if (phase === 'voting_locked' || phase === 'results_shown') {
        const votes = await sql`SELECT selected_options FROM votes WHERE poll_id = ${pollId}`;
        const counts = {};
        votes.forEach((v) => {
          const opts = Array.isArray(v.selected_options) ? v.selected_options : [];
          opts.forEach((o) => {
            counts[o] = (counts[o] || 0) + 1;
          });
        });
        voteResults = Object.entries(counts).map(([idx, count]) => ({
          optionIndex: parseInt(idx),
          count,
        }));
      }

      const rooms = await sql`SELECT code FROM rooms WHERE id = ${poll.room_id}`;
      if (rooms.length > 0) {
        await fire(`room-${rooms[0].code}`, 'poll:update', { ...poll, voteResults });
      }

      return res.status(200).json({ ...poll, voteResults });
    }

    return res.status(400).json({ error: 'phase or action required' });
  }

  if (req.method === 'DELETE') {
    const pollId = req.query.pollId;
    if (!pollId || typeof pollId !== 'string') {
      return res.status(400).json({ error: 'Poll ID required' });
    }

    const current = await sql`SELECT phase FROM polls WHERE id = ${pollId}`;
    if (current.length === 0) return res.status(404).json({ error: 'Poll not found' });
    if (current[0].phase !== 'draft') {
      return res.status(409).json({ error: 'Only drafts can be deleted' });
    }

    await sql`DELETE FROM polls WHERE id = ${pollId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};