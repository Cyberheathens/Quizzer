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
    const result = await sql`INSERT INTO rooms (code, name, host_name, passcode) VALUES (${code}, ${name}, ${hostName}, ${passcode || null}) RETURNING *`;
    res.status(201).json(result[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rooms/join', async (req, res) => {
  try {
    const { code, passcode, sessionId, displayName } = req.body;
    const rooms = await sql`SELECT * FROM rooms WHERE code = ${String(code).toUpperCase()} AND is_active = true`;
    if (rooms.length === 0) return res.status(404).json({ error: 'Room not found' });
    const room = rooms[0];
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
    const result = await sql`SELECT * FROM polls WHERE room_id = ${String(roomId)} ORDER BY created_at DESC`;
    res.json(result.map((p) => ({ ...p, options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/polls', async (req, res) => {
  try {
    const { roomId, question, pollType, options, timerSeconds } = req.body;
    if (!roomId || !question || !options || options.length < 2) return res.status(400).json({ error: 'Missing fields' });
    const opts = options.map((o, i) => ({ id: i, text: o.text, is_correct: o.isCorrect }));
    const correct = options.map((o, i) => o.isCorrect ? i : -1).filter((i) => i >= 0);
    const result = await sql`INSERT INTO polls (room_id, question, poll_type, options, correct_answers, timer_seconds) VALUES (${roomId}, ${question}, ${pollType || 'single'}, ${JSON.stringify(opts)}, ${correct}, ${timerSeconds || null}) RETURNING *`;
    const poll = { ...result[0], options: typeof result[0].options === 'string' ? JSON.parse(result[0].options) : result[0].options };
    const rooms = await sql`SELECT code FROM rooms WHERE id = ${roomId}`;
    if (rooms.length > 0) await fire(`room-${rooms[0].code}`, 'poll:new', poll);
    res.status(201).json(poll);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/polls', async (req, res) => {
  try {
    const { pollId, phase } = req.body;
    if (!pollId || !phase) return res.status(400).json({ error: 'Poll ID and phase required' });
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

// Q&A routes
app.get('/api/qa', async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: 'Room ID required' });
    const result = await sql`SELECT * FROM qa_posts WHERE room_id = ${String(roomId)} ORDER BY created_at DESC LIMIT 100`;
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
      case 'upvote': result = await sql`UPDATE qa_posts SET upvotes = upvotes + 1 WHERE id = ${postId} RETURNING *`; break;
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
