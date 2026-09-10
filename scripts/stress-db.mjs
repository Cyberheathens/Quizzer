import 'dotenv/config';
import { Agent, setGlobalDispatcher } from 'undici';
import { neon } from '@neondatabase/serverless';

setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const sql = neon(process.env.DATABASE_URL);
const LEVELS = (process.argv[2] || '1,5,10,25,50').split(',').map(Number);
const DURATION_MS = Number(process.argv[3] || 6000);

let ok = 0, err = 0, lastErr = '';
let lat = [];
let ROOM, POLL, QA_IDS = [];

const p = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0;
};
const fmt = (n) => n.toFixed(0);

async function q(fn) {
  const t = performance.now();
  try {
    await fn();
    ok++;
    lat.push(performance.now() - t);
  } catch (e) {
    err++;
    lastErr = e.message;
  }
}

async function setup() {
  console.log('Connecting + warming up (first query may wake compute)...');
  const t0 = performance.now();
  const r = await sql`INSERT INTO rooms (code, name, host_name) VALUES (${Math.random().toString(36).slice(2, 8).toUpperCase()}, 'stress-test', 'stress') RETURNING id, code`;
  ROOM = r[0];
  console.log(`  first query: ${(performance.now() - t0).toFixed(0)}ms`);

  const poll = await sql`INSERT INTO polls (room_id, question, poll_type, options, correct_answers) VALUES (${ROOM.id}, 'stress', 'multi', ${JSON.stringify([{id:0,text:'A',is_correct:true},{id:1,text:'B',is_correct:false}])}, ${[0]}) RETURNING id`;
  POLL = poll[0];

  for (let i = 0; i < 5; i++) {
    const qa = await sql`INSERT INTO qa_posts (room_id, content) VALUES (${ROOM.id}, ${'stress post ' + i}) RETURNING id`;
    QA_IDS.push(qa[0].id);
  }
  console.log('  fixtures ready\n');
}

// Mix mirrors real app traffic: reads, vote writes, upvote races, QA posts
async function workUnit() {
  const roll = Math.random();
  if (roll < 0.30) {
    await q(() => sql`SELECT * FROM rooms WHERE code = ${ROOM.code}`);
  } else if (roll < 0.50) {
    await q(() => sql`SELECT * FROM polls WHERE room_id = ${ROOM.id} ORDER BY created_at DESC LIMIT 10`);
  } else if (roll < 0.55) {
    await q(() => sql`SELECT * FROM qa_posts WHERE room_id = ${ROOM.id} ORDER BY created_at DESC LIMIT 100`);
  } else if (roll < 0.80) {
    const sid = 'stress_' + Math.random().toString(36).slice(2, 16);
    const opts = Math.random() < 0.5 ? [0] : [0, 1];
    await q(() => sql`INSERT INTO votes (poll_id, session_id, selected_options) VALUES (${POLL.id}, ${sid}, ${opts})`);
    await q(() => sql`SELECT selected_options FROM votes WHERE poll_id = ${POLL.id}`);
  } else if (roll < 0.95) {
    const id = QA_IDS[Math.floor(Math.random() * QA_IDS.length)];
    await q(() => sql`UPDATE qa_posts SET upvotes = upvotes + 1 WHERE id = ${id} RETURNING upvotes`);
  } else {
    await q(() => sql`INSERT INTO qa_posts (room_id, content, display_name) VALUES (${ROOM.id}, 'stress q', 'stress')`);
  }
}

async function runLevel(conc) {
  ok = 0; err = 0; lat = []; lastErr = '';
  const t0 = performance.now();
  await Promise.all(Array.from({ length: conc }, async () => {
    const end = Date.now() + DURATION_MS;
    while (Date.now() < end) {
      await workUnit();
    }
  }));
  const wall = (performance.now() - t0) / 1000;
  const l = [...lat].sort((a, b) => a - b);
  console.log(
    `conc=${String(conc).padStart(3)} | reqs=${String(ok).padStart(6)} | ${fmt(ok / wall).padStart(7)} req/s | ` +
    `p50=${fmt(p(l, 0.5)).padStart(6)}ms p95=${fmt(p(l, 0.95)).padStart(6)}ms p99=${fmt(p(l, 0.99)).padStart(6)}ms max=${fmt(l[l.length - 1] || 0).padStart(6)}ms | err=${err}`
  );
  if (lastErr) console.log(`   last error: ${lastErr.slice(0, 160)}`);
}

await setup();
for (const c of LEVELS) {
  await runLevel(c);
}
await sql`DELETE FROM rooms WHERE name = 'stress-test'`;
console.log('\nTest data cleaned up.');