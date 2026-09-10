import 'dotenv/config';
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const BASE = process.env.API_BASE || 'http://localhost:3001/api';
const N = Number(process.argv[2] || 400);

const stats = { join: [], vote: [], state: [] };
let joinErr = 0, voteErr = 0, stateErr = 0;

async function timed(bucket, fn) {
  const t = performance.now();
  try {
    const r = await fn();
    stats[bucket].push(performance.now() - t);
    return r;
  } catch (e) {
    if (bucket === 'join') joinErr++;
    if (bucket === 'vote') voteErr++;
    if (bucket === 'state') stateErr++;
    lastErr[bucket] = e.message;
    return null;
  }
}
const lastErr = {};

const j = async (u, o) => {
  const r = await fetch(BASE + u, o && { headers: { 'Content-Type': 'application/json' }, ...o });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || r.status);
  return d;
};

const p = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length * Math.min(q, 1))] : 0;
};

console.log(`\n=== ENGAGE 400-PARTICIPANT SIMULATION ===`);
console.log(`Target: ${BASE} | participants: ${N}\n`);

// ---- Setup ----
const room = await timed('join', () =>
  j2('/rooms', { method: 'POST', body: JSON.stringify({ name: 'SIM-400', hostName: 'SimHost' }) })
);
console.log(`Room ${room.code} created`);

// ---- Phase 1: Join stampede (realistic QR-scan ramp, ~20 joins/s) ----
console.log(`\nPhase 1: ${N} participants joining (ramped ~20/s)...`);
const joinStart = Date.now();
const joiners = Array.from({ length: N }, (_, i) => i);
await Promise.all(
  joiners.map(async (i) => {
    await new Promise((r) => setTimeout(r, (i / 20) * 1000 * Math.random()));
    await timed('join', () =>
      j2('/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code: room.code, sessionId: 'sim_' + i, displayName: 'User' + i }),
      })
    );
  })
);
const joinWall = (Date.now() - joinStart) / 1000;

// ---- Phase 2: Poll opens, everyone votes over 30s (ramped like a live countdown) ----
const poll = await j2('/polls', {
  method: 'POST',
  body: JSON.stringify({
    roomId: room.id,
    question: 'Sim: pick your courses',
    pollType: 'multi',
    options: [
      { text: 'Math', isCorrect: true },
      { text: 'Physics', isCorrect: false },
      { text: 'CS', isCorrect: true },
      { text: 'Chem', isCorrect: false },
    ],
  }),
});
console.log(`\nPhase 2: poll open — ${N} votes over 30s (realistic surge)...`);
const voteStart = Date.now();
await Promise.all(
  joiners.map(async (i) => {
    await new Promise((r) => setTimeout(r, Math.random() * 30000));
    const opts = [[0], [0, 2], [2], [1], [0, 1, 2]][i % 5];
    await timed('vote', () =>
      j2('/votes', { method: 'POST', body: JSON.stringify({ pollId: poll.id, sessionId: 'sim_' + i, selectedOptions: opts }) })
    );
    // each participant heartbeats 1-2x during the poll via /state
    if (Math.random() < 0.5) {
      await timed('state', () =>
        j2('/state', { method: 'POST', body: JSON.stringify({ roomId: room.id, sessionId: 'sim_' + i }) })
      );
    }
  })
);
const voteWall = (Date.now() - voteStart) / 1000;

// ---- Phase 3: Host locks, everyone's next refresh reveals ----
console.log(`\nPhase 3: host locks voting + reveal...`);
const lockStart = performance.now();
const locked = await j2('/polls', { method: 'PATCH', body: JSON.stringify({ pollId: poll.id, phase: 'voting_locked' }) });
const lockMs = performance.now() - lockStart;
console.log(`lock+aggregate: ${lockMs.toFixed(0)}ms | results: ${JSON.stringify(locked.voteResults)}`);

// 100 participants refresh simultaneously for results (WS-less worst case)
const revealStart = Date.now();
await Promise.all(
  joiners.slice(0, 100).map((i) =>
    timed('state', () => j2('/state', { method: 'POST', body: JSON.stringify({ roomId: room.id, sessionId: 'sim_' + i }) }))
  )
);
const revealWall = (Date.now() - revealStart) / 1000;

// ---- Report ----
const line = (name, arr, errs, wall, n) => {
  if (!arr.length) return console.log(`${name}: NO DATA (all failed)`);
  const l = [...arr].sort((a, b) => a - b);
  console.log(
    `${name.padEnd(10)} | n=${String(n).padStart(4)} err=${errs} | ${((n - errs) / wall).toFixed(1)} ok/s | ` +
      `p50=${l[Math.floor(l.length * 0.5)].toFixed(0).padStart(5)}ms p95=${l[Math.floor(l.length * 0.95)].toFixed(0).padStart(5)}ms ` +
      `p99=${l[Math.floor(l.length * 0.99)].toFixed(0).padStart(5)}ms max=${l[l.length - 1].toFixed(0)}ms`
  );
};

console.log(`\n=== RESULTS ===`);
line('joins', stats.join, joinErr, joinWall, N);
line('votes', stats.vote, voteErr, voteWall, N);
line('state', stats.state, stateErr, voteWall + revealWall, stats.state.length);
line('reveal(100x state)', stats.state.slice(-100), stateErr, revealWall, 100);

// cleanup
await j2('/qa', { method: 'POST', body: JSON.stringify({ roomId: room.id, content: 'cleanup-marker' }) });
console.log(`\nSim room ${room.code} left in DB for inspection (harmless).`);

async function j2(u, o) {
  const r = await fetch(BASE + u, o && { headers: { 'Content-Type': 'application/json' }, ...o });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(u + ' -> ' + (d.error || r.status));
  return d;
}