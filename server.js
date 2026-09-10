import 'dotenv/config';
import { Agent, setGlobalDispatcher } from 'undici';
import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import Pusher from 'pusher';

// Force IPv4 DNS resolution — campus networks often block IPv6.
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const app = express();
app.use(cors());
app.use(express.json());

const DATABASE_URL = process.env.DATABASE_URL || '';
const sql = neon(DATABASE_URL);

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
  useTLS: true,
});

async function fire(channel, event, data) {
  try { await pusher.trigger(channel, event, data); } catch {}
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function initDB() {
  await sql`CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    host_name TEXT NOT NULL,
    passcode TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    poll_type VARCHAR(20) DEFAULT 'single',
    options JSONB NOT NULL DEFAULT '[]',
    phase VARCHAR(20) DEFAULT 'voting_open',
    correct_answers INTEGER[] DEFAULT '{}',
    timer_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    selected_options INTEGER[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, session_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS members (
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    display_name TEXT DEFAULT 'Anonymous',
    last_seen TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (room_id, session_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS qa_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    display_name TEXT DEFAULT 'Anonymous',
    is_anonymous BOOLEAN DEFAULT false,
    upvotes INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    is_answering BOOLEAN DEFAULT false,
    is_answered BOOLEAN DEFAULT false,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
}

// Initialize DB on startup
initDB().then(() => console.log('DB initialized')).catch(console.error);

// Room routes
app.get('/api/rooms', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const result = await sql`SELECT * FROM rooms WHERE code = ${String(code).toUpperCase()} AND is_active = true`;
    if (result.length === 0) return res.status(404).json({ error: 'Room not found' });
    res.json(result[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name, hostName, passcode } = req.body;
    if (!name || !hostName) return res.status(400).json({ error: 'Name and host name required' });
    let code = generateCode();
    const result = await sql`INSERT INTO rooms (code, name, host_name, passcode, status) VALUES (${code}, ${name}, ${hostName}, ${passcode || null}, 'draft') RETURNING *`;
    res.status(201).json(result[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/rooms', async (req, res) => {
  try {
    const { code, action } = req.body;
    if (!code || !action) return res.status(400).json({ error: 'Code and action required' });
    const upper = String(code).toUpperCase();
    if (action === 'open') {
      const result = await sql`UPDATE rooms SET status = 'open' WHERE code = ${upper} AND is_active = true RETURNING *`;
      if (result.length === 0) return res.status(404).json({ error: 'Room not found' });
      await fire(`room-${upper}`, 'room:open', { code: upper });
      return res.json(result[0]);
    }
    if (action === 'end') {
      const result = await sql`UPDATE rooms SET is_active = false, status = 'draft' WHERE code = ${upper} RETURNING *`;
      if (result.length === 0) return res.status(404).json({ error: 'Room not found' });
      await fire(`room-${upper}`, 'room:ended', {});
      return res.json(result[0]);
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rooms/join', async (req, res) => {
  try {
    const { code, passcode, sessionId, displayName } = req.body;
    const rooms = await sql`SELECT * FROM rooms WHERE code = ${String(code).toUpperCase()} AND is_active = true`;
    if (rooms.length === 0) return res.status(404).json({ error: 'Room not found' });
    const room = rooms[0];
    if (room.status && room.status !== 'open') return res.status(403).json({ error: 'Room not open yet' });
    if (room.passcode && room.passcode !== passcode) return res.status(403).json({ error: 'Invalid passcode' });
    await sql`INSERT INTO members (room_id, session_id, display_name) VALUES (${room.id}, ${sessionId}, ${displayName || 'Anonymous'}) ON CONFLICT (room_id, session_id) DO UPDATE SET last_seen = now()`;
    const counts = await sql`SELECT count(*)::int AS count FROM members WHERE room_id = ${room.id} AND last_seen > now() - interval '5 minutes'`;
    await fire(`room-${room.code}`, 'participants', { count: counts[0].count });
    res.json({ room, sessionId, participantCount: counts[0].count, intervalMs: intervalFor(counts[0].count) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Poll routes
app.get('/api/polls', async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: 'Room ID required' });
    const includeDrafts = req.query.includeDrafts === '1';
    const result = includeDrafts
      ? await sql`SELECT * FROM polls WHERE room_id = ${String(roomId)} ORDER BY created_at DESC`
      : await sql`SELECT * FROM polls WHERE room_id = ${String(roomId)} AND phase != 'draft' ORDER BY created_at DESC`;
    res.json(result.map((p) => ({ ...p, options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/polls', async (req, res) => {
  try {
    const { roomId, question, pollType, options, timerSeconds } = req.body;
    if (!roomId || !question || !options || options.length < 2) return res.status(400).json({ error: 'Missing fields' });
    const opts = options.map((o, i) => ({ id: i, text: o.text, is_correct: o.isCorrect }));
    const correct = options.map((o, i) => o.isCorrect ? i : -1).filter((i) => i >= 0);
    const launch = !!req.body.launch;
    const result = await sql`INSERT INTO polls (room_id, question, poll_type, options, correct_answers, timer_seconds, question_image, phase, launched_at) VALUES (${roomId}, ${question}, ${pollType || 'single'}, ${JSON.stringify(opts)}, ${correct}, ${timerSeconds || null}, ${req.body.questionImage || null}, ${launch ? 'voting_open' : 'draft'}, CASE WHEN ${!!launch} THEN now() ELSE NULL END) RETURNING *`;
    const poll = { ...result[0], options: typeof result[0].options === 'string' ? JSON.parse(result[0].options) : result[0].options };
    if (launch) {
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${roomId}`;
      if (rooms.length > 0) await fire(`room-${rooms[0].code}`, 'poll:new', poll);
    }
    res.status(201).json(poll);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/polls', async (req, res) => {
  try {
    const { pollId, phase, action, question, options, questionImage, timerSeconds } = req.body;
    if (!pollId) return res.status(400).json({ error: 'Poll ID required' });

    if (action === 'launch') {
      const cur = await sql`SELECT phase FROM polls WHERE id = ${pollId}`;
      if (cur.length === 0) return res.status(404).json({ error: 'Poll not found' });
      if (cur[0].phase !== 'draft') return res.status(409).json({ error: 'Poll already launched' });
      const result = await sql`UPDATE polls SET phase = 'voting_open', launched_at = now() WHERE id = ${pollId} RETURNING *`;
      const poll = { ...result[0], options: typeof result[0].options === 'string' ? JSON.parse(result[0].options) : result[0].options };
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${poll.room_id}`;
      if (rooms.length > 0) await fire(`room-${rooms[0].code}`, 'poll:new', poll);
      return res.json(poll);
    }

    if (action === 'update') {
      const cur = await sql`SELECT phase FROM polls WHERE id = ${pollId}`;
      if (cur.length === 0) return res.status(404).json({ error: 'Poll not found' });
      if (cur[0].phase !== 'draft') return res.status(409).json({ error: 'Only drafts can be edited' });
      const opts = options ? JSON.stringify(options.map((o, i) => ({ id: i, text: o.text, is_correct: o.isCorrect }))) : null;
      const correct = options ? options.map((o, i) => o.isCorrect ? i : -1).filter((i) => i >= 0) : null;
      const result = await sql`UPDATE polls SET question = COALESCE(${question ?? null}, question), options = COALESCE(${opts}, options), correct_answers = COALESCE(${correct}, correct_answers), question_image = ${questionImage ?? null}, timer_seconds = ${timerSeconds ?? null} WHERE id = ${pollId} RETURNING *`;
      const poll = { ...result[0], options: typeof result[0].options === 'string' ? JSON.parse(result[0].options) : result[0].options };
      return res.json(poll);
    }

    if (!phase) return res.status(400).json({ error: 'phase or action required' });
    const result = await sql`UPDATE polls SET phase = ${phase} WHERE id = ${pollId} RETURNING *`;
    if (result.length === 0) return res.status(404).json({ error: 'Poll not found' });
    const poll = { ...result[0], options: typeof result[0].options === 'string' ? JSON.parse(result[0].options) : result[0].options };
    let voteResults = [];
    if (phase === 'voting_locked' || phase === 'results_shown') {
      const votes = await sql`SELECT selected_options FROM votes WHERE poll_id = ${pollId}`;
      const counts = {};
      votes.forEach((v) => {
        (Array.isArray(v.selected_options) ? v.selected_options : []).forEach((o) => { counts[o] = (counts[o] || 0) + 1; });
      });
      voteResults = Object.entries(counts).map(([idx, count]) => ({ optionIndex: parseInt(idx), count }));
    }
    const polls = await sql`SELECT room_id FROM polls WHERE id = ${pollId}`;
    if (polls.length > 0) {
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${polls[0].room_id}`;
      if (rooms.length > 0) await fire(`room-${rooms[0].code}`, 'poll:update', { ...poll, voteResults });
    }
    res.json({ ...poll, voteResults });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/polls', async (req, res) => {
  try {
    const pollId = req.query.pollId;
    if (!pollId) return res.status(400).json({ error: 'Poll ID required' });
    const cur = await sql`SELECT phase FROM polls WHERE id = ${String(pollId)}`;
    if (cur.length === 0) return res.status(404).json({ error: 'Poll not found' });
    if (cur[0].phase !== 'draft') return res.status(409).json({ error: 'Only drafts can be deleted' });
    await sql`DELETE FROM polls WHERE id = ${String(pollId)}`;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vote routes
app.get('/api/votes', async (req, res) => {
  try {
    const { pollId } = req.query;
    if (!pollId) return res.status(400).json({ error: 'Poll ID required' });
    const votes = await sql`SELECT selected_options FROM votes WHERE poll_id = ${String(pollId)}`;
    const counts = {};
    votes.forEach((v) => {
      (Array.isArray(v.selected_options) ? v.selected_options : []).forEach((o) => { counts[o] = (counts[o] || 0) + 1; });
    });
    res.json(Object.entries(counts).map(([idx, count]) => ({ optionIndex: parseInt(idx), count })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/votes', async (req, res) => {
  try {
    const { pollId, sessionId, selectedOptions } = req.body;
    if (!pollId || !sessionId || !selectedOptions) return res.status(400).json({ error: 'Missing fields' });
    const existing = await sql`SELECT id FROM votes WHERE poll_id = ${pollId} AND session_id = ${sessionId}`;
    if (existing.length > 0) return res.status(409).json({ error: 'Already voted' });
    const polls = await sql`SELECT * FROM polls WHERE id = ${pollId}`;
    if (polls.length === 0) return res.status(404).json({ error: 'Poll not found' });
    if (polls[0].phase !== 'voting_open') return res.status(403).json({ error: 'Voting is closed' });
    await sql`INSERT INTO votes (poll_id, session_id, selected_options) VALUES (${pollId}, ${sessionId}, ${selectedOptions})`;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/qa-upvotes', async (req, res) => {
  try {
    const { roomId, sessionId } = req.query;
    if (!roomId || !sessionId) return res.status(400).json({ error: 'Room ID and session ID required' });
    const mine = await sql`SELECT v.post_id FROM qa_votes v JOIN qa_posts p ON p.id = v.post_id WHERE p.room_id = ${String(roomId)} AND v.session_id = ${String(sessionId)}`;
    res.json({ postIds: mine.map((r) => r.post_id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Q&A routes
app.get('/api/qa', async (req, res) => {
  try {
    const { roomId, sessionId } = req.query;
    if (!roomId) return res.status(400).json({ error: 'Room ID required' });
    const result = await sql`SELECT * FROM qa_posts WHERE room_id = ${String(roomId)} ORDER BY created_at DESC LIMIT 100`;
    let myUpvotes = [];
    if (sessionId) {
      const mine = await sql`SELECT v.post_id FROM qa_votes v JOIN qa_posts p ON p.id = v.post_id WHERE p.room_id = ${String(roomId)} AND v.session_id = ${String(sessionId)}`;
      myUpvotes = mine.map((r) => r.post_id);
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/qa', async (req, res) => {
  try {
    const { roomId, content, displayName, isAnonymous } = req.body;
    if (!roomId || !content) return res.status(400).json({ error: 'Missing fields' });
    if (content.length > 300) return res.status(400).json({ error: 'Too long' });
    const result = await sql`INSERT INTO qa_posts (room_id, content, display_name, is_anonymous) VALUES (${roomId}, ${content}, ${displayName || 'Anonymous'}, ${isAnonymous || false}) RETURNING *`;
    const rooms = await sql`SELECT code FROM rooms WHERE id = ${roomId}`;
    if (rooms.length > 0) await fire(`room-${rooms[0].code}`, 'qa:new', result[0]);
    res.status(201).json(result[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/qa', async (req, res) => {
  try {
    const { postId, action } = req.body;
    if (!postId || !action) return res.status(400).json({ error: 'Missing fields' });
    let result;
    switch (action) {
      case 'pin': result = await sql`UPDATE qa_posts SET is_pinned = NOT is_pinned WHERE id = ${postId} RETURNING *`; break;
      case 'answering': result = await sql`UPDATE qa_posts SET is_answering = NOT is_answering WHERE id = ${postId} RETURNING *`; break;
      case 'answered': result = await sql`UPDATE qa_posts SET is_answered = true, is_answering = false WHERE id = ${postId} RETURNING *`; break;
      case 'hide': result = await sql`UPDATE qa_posts SET is_hidden = NOT is_hidden WHERE id = ${postId} RETURNING *`; break;
      case 'upvote': {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'Session ID required for upvoting' });
        const existingVote = await sql`SELECT 1 FROM qa_votes WHERE post_id = ${postId} AND session_id = ${sessionId}`;
        if (existingVote.length > 0) {
          await sql`DELETE FROM qa_votes WHERE post_id = ${postId} AND session_id = ${sessionId}`;
          result = await sql`UPDATE qa_posts SET upvotes = upvotes - 1 WHERE id = ${postId} AND upvotes > 0 RETURNING *`;
        } else {
          await sql`INSERT INTO qa_votes (post_id, session_id) VALUES (${postId}, ${sessionId}) ON CONFLICT DO NOTHING`;
          result = await sql`UPDATE qa_posts SET upvotes = upvotes + 1 WHERE id = ${postId} RETURNING *`;
        }
        break;
      }
      default: return res.status(400).json({ error: 'Invalid action' });
    }
    if (!result || result.length === 0) return res.status(404).json({ error: 'Post not found' });
    const posts = await sql`SELECT room_id FROM qa_posts WHERE id = ${postId}`;
    if (posts.length > 0) {
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${posts[0].room_id}`;
      if (rooms.length > 0) await fire(`room-${rooms[0].code}`, 'qa:update', result[0]);
    }
    res.json(result[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Participants
app.get('/api/participants', async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: 'Room ID required' });
    const counts = await sql`SELECT count(*)::int AS count FROM members WHERE room_id = ${String(roomId)} AND last_seen > now() - interval '5 minutes'`;
    res.json({ count: counts[0].count, intervalMs: intervalFor(counts[0].count) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/participants', async (req, res) => {
  try {
    const { roomId, sessionId, displayName } = req.body;
    if (!roomId || !sessionId) return res.status(400).json({ error: 'Room ID and session ID required' });
    const counts = await sql`WITH upsert AS (INSERT INTO members (room_id, session_id, display_name) VALUES (${roomId}, ${sessionId}, ${displayName || 'Anonymous'}) ON CONFLICT (room_id, session_id) DO UPDATE SET last_seen = now() RETURNING 1) SELECT count(*)::int AS count FROM members WHERE room_id = ${roomId} AND last_seen > now() - interval '5 minutes'`;
    res.json({ count: counts[0].count, intervalMs: counts[0].count > 150 ? 30000 : 2500 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const intervalFor = (count) => (count > 150 ? 30000 : 2500);

// Room state — single query: heartbeat + counts + polls + qa
app.post('/api/state', async (req, res) => {
  try {
    const { roomId, sessionId, displayName } = req.body;
    if (!roomId || !sessionId) return res.status(400).json({ error: 'Room ID and session ID required' });
    const rows = await sql`
      WITH upsert AS (
        INSERT INTO members (room_id, session_id, display_name)
        VALUES (${roomId}, ${sessionId}, ${displayName || 'Anonymous'})
        ON CONFLICT (room_id, session_id) DO UPDATE SET last_seen = now()
        RETURNING 1
      ),
      cnt AS (SELECT count(*)::int AS count FROM members WHERE room_id = ${roomId} AND last_seen > now() - interval '5 minutes'),
      pls AS (SELECT COALESCE(json_agg(pl), '[]'::json) AS polls FROM (SELECT * FROM polls WHERE room_id = ${roomId} AND phase != 'draft' ORDER BY created_at DESC LIMIT 20) pl),
      qs AS (SELECT COALESCE(json_agg(q), '[]'::json) AS qa FROM (SELECT * FROM qa_posts WHERE room_id = ${roomId} ORDER BY created_at DESC LIMIT 100) q),
      op AS (SELECT EXISTS(SELECT 1 FROM polls WHERE room_id = ${roomId} AND phase = 'voting_open') AS has_open),
      qz AS (SELECT row_to_json(qz_info) AS info FROM (SELECT q.id AS quiz_id, q.title, p.order_index, (SELECT count(*)::int FROM polls WHERE quiz_id = q.id) AS total FROM polls p JOIN quizzes q ON q.id = p.quiz_id WHERE p.room_id = ${roomId} AND p.phase = 'voting_open' LIMIT 1) qz_info)
      SELECT cnt.count AS participants, pls.polls AS polls, qs.qa AS qa, op.has_open AS has_open, qz.info AS quiz_info FROM cnt, pls, qs, op LEFT JOIN qz ON true
    `;
    const r = rows[0];
    const intervalMs = r.has_open ? 5000 : (r.participants > 150 ? 30000 : 2500);
    res.json({ participants: r.participants, polls: r.polls, qa: r.qa, quizInfo: r.quiz_info, intervalMs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Quizzes — multi-question sequential quiz
async function quizSnapshot(roomId, quizId) {
  const quizzes = await sql`SELECT * FROM quizzes WHERE id = ${quizId} AND room_id = ${roomId}`;
  if (quizzes.length === 0) return null;
  const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC`;
  return {
    quiz: quizzes[0],
    questions: questions.map((p) => ({ ...p, options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options })),
  };
}

app.post('/api/quizzes', async (req, res) => {
  try {
    const { roomId, title, questions } = req.body;
    if (!roomId || !title || !Array.isArray(questions) || questions.length === 0) return res.status(400).json({ error: 'Room ID, title, and at least 1 question required' });
    const quizResult = await sql`INSERT INTO quizzes (room_id, title) VALUES (${roomId}, ${title}) RETURNING *`;
    const quiz = quizResult[0];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await sql`INSERT INTO polls (room_id, quiz_id, order_index, question, poll_type, options, correct_answers, timer_seconds, question_image, phase)
        VALUES (${roomId}, ${quiz.id}, ${i}, ${q.question}, ${q.pollType || 'single'},
          ${JSON.stringify(q.options.map((o, j) => ({ id: j, text: o.text, is_correct: o.isCorrect })))},
          ${q.options.map((o, j) => (o.isCorrect ? j : -1)).filter((j) => j >= 0).length ? q.options.map((o, j) => (o.isCorrect ? j : -1)).filter((j) => j >= 0) : '{}'},
          ${q.timerSeconds || null}, ${q.questionImage || null}, 'draft')`;
    }
    const snap = await quizSnapshot(roomId, quiz.id);
    res.status(201).json(snap);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/quizzes', async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: 'Room ID required' });
    const quizzes = await sql`SELECT * FROM quizzes WHERE room_id = ${String(roomId)} ORDER BY created_at DESC`;
    const out = [];
    for (const quiz of quizzes) {
      const qs = await sql`SELECT * FROM polls WHERE quiz_id = ${quiz.id} ORDER BY order_index ASC`;
      out.push({ quiz, questions: qs.map((p) => ({ ...p, options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options })) });
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/quizzes', async (req, res) => {
  try {
    const { quizId, action } = req.body;
    if (!quizId || !action) return res.status(400).json({ error: 'Quiz ID and action required' });
    const quizRows = await sql`SELECT * FROM quizzes WHERE id = ${quizId}`;
    if (quizRows.length === 0) return res.status(404).json({ error: 'Quiz not found' });
    const quiz = quizRows[0];
    const launched = quiz.active_index !== null && quiz.active_index !== undefined;

    if (action === 'update') {
      if (launched) {
        return res.status(409).json({ error: 'Launched quizzes cannot be edited' });
      }
      const { title, questions } = req.body;
      if (title) {
        await sql`UPDATE quizzes SET title = ${title} WHERE id = ${quizId}`;
      }
      if (Array.isArray(questions) && questions.length > 0) {
        // Draft quiz — safe to replace questions wholesale
        await sql`DELETE FROM polls WHERE quiz_id = ${quizId}`;
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await sql`
            INSERT INTO polls (room_id, quiz_id, order_index, question, poll_type, options, correct_answers, timer_seconds, question_image, phase)
            VALUES (
              ${quiz.room_id}, ${quizId}, ${i}, ${q.question}, ${q.pollType || 'single'},
              ${JSON.stringify(q.options.map((o, j) => ({ id: j, text: o.text, is_correct: o.isCorrect })))},
              ${q.options.map((o, j) => (o.isCorrect ? j : -1)).filter((j) => j >= 0)},
              ${q.timerSeconds || null},
              ${q.questionImage || null},
              'draft'
            )
          `;
        }
      }
      const snap = await quizSnapshot(quiz.room_id, quizId);
      return res.status(200).json(snap);
    }

    if (action === 'delete') {
      await sql`DELETE FROM quizzes WHERE id = ${quizId}`;
      return res.json({ success: true });
    }

    if (action === 'launch') {
      if (launched) return res.status(409).json({ error: 'Quiz already launched' });
      const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC LIMIT 1`;
      if (questions.length === 0) return res.status(409).json({ error: 'Quiz has no questions' });
      await sql`UPDATE quizzes SET active_index = 0 WHERE id = ${quizId}`;
      await sql`UPDATE polls SET phase = 'voting_open', launched_at = now() WHERE quiz_id = ${quizId} AND order_index = 0`;
      const snap = await quizSnapshot(quiz.room_id, quizId);
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${quiz.room_id}`;
      if (rooms.length > 0) await fire(`room-${rooms[0].code}`, 'poll:new', snap.questions[0]);
      return res.json(snap);
    }

    if (action === 'lock' || action === 'reveal') {
      if (!launched) return res.status(409).json({ error: 'Quiz not launched yet' });
      const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC`;
      const current = questions[quiz.active_index];
      if (!current) return res.status(404).json({ error: 'No active question' });
      const phase = action === 'lock' ? 'voting_locked' : 'results_shown';
      await sql`UPDATE polls SET phase = ${phase} WHERE id = ${current.id}`;
      const votes = await sql`SELECT selected_options FROM votes WHERE poll_id = ${current.id}`;
      const counts = {};
      votes.forEach((v) => { (Array.isArray(v.selected_options) ? v.selected_options : []).forEach((o) => { counts[o] = (counts[o] || 0) + 1; }); });
      const voteResults = Object.entries(counts).map(([idx, count]) => ({ optionIndex: parseInt(idx), count }));
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${quiz.room_id}`;
      if (rooms.length > 0) {
        const updated = await sql`SELECT * FROM polls WHERE id = ${current.id}`;
        const poll = { ...updated[0], options: typeof updated[0].options === 'string' ? JSON.parse(updated[0].options) : updated[0].options };
        await fire(`room-${rooms[0].code}`, 'poll:update', { ...poll, voteResults });
      }
      const snap = await quizSnapshot(quiz.room_id, quizId);
      return res.json({ ...snap, voteResults });
    }

    if (action === 'next') {
      const questions = await sql`SELECT * FROM polls WHERE quiz_id = ${quizId} ORDER BY order_index ASC`;
      if (!launched) return res.status(409).json({ error: 'Quiz not launched yet' });
      const nextIndex = quiz.active_index + 1;
      if (nextIndex >= questions.length) return res.status(409).json({ error: 'Quiz finished — no more questions' });
      const current = questions[quiz.active_index];
      if (current.phase === 'voting_open') await sql`UPDATE polls SET phase = 'voting_locked' WHERE id = ${current.id}`;
      await sql`UPDATE polls SET phase = 'voting_open', launched_at = now() WHERE id = ${questions[nextIndex].id}`;
      await sql`UPDATE quizzes SET active_index = ${nextIndex} WHERE id = ${quizId}`;
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${quiz.room_id}`;
      if (rooms.length > 0) {
        const updated = await sql`SELECT * FROM polls WHERE id = ${questions[nextIndex].id}`;
        const poll = { ...updated[0], options: typeof updated[0].options === 'string' ? JSON.parse(updated[0].options) : updated[0].options };
        await fire(`room-${rooms[0].code}`, 'poll:new', poll);
      }
      const snap = await quizSnapshot(quiz.room_id, quizId);
      return res.json(snap);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const { quizId } = req.query;
    if (!quizId) return res.status(400).json({ error: 'Quiz ID required' });
    const rows = await sql`
      SELECT m.display_name AS name, v.session_id AS session_id, count(*)::int AS score
      FROM votes v JOIN polls p ON p.id = v.poll_id
      JOIN members m ON m.session_id = v.session_id AND m.room_id = p.room_id
      WHERE p.quiz_id = ${String(quizId)} AND cardinality(p.correct_answers) > 0
        AND v.selected_options @> p.correct_answers AND v.selected_options <@ p.correct_answers
        AND cardinality(v.selected_options) = cardinality(p.correct_answers)
      GROUP BY v.session_id, m.display_name ORDER BY score DESC LIMIT 20`;
    const totals = await sql`SELECT count(*)::int AS total FROM polls WHERE quiz_id = ${String(quizId)}`;
    res.json({ leaderboard: rows, totalQuestions: totals[0].total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pusher auth
app.post('/api/pusher/auth', (req, res) => {
  const { socket_id, channel_name } = req.body;
  try {
    const auth = pusher.authorizeChannel(socket_id, channel_name);
    res.json(auth);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
