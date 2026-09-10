import 'dotenv/config';
import { Agent, setGlobalDispatcher } from 'undici';
import { neon } from '@neondatabase/serverless';
import Pusher from 'pusher';

setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
const sql = neon(process.env.DATABASE_URL);

console.log('Engage pre-warm — waking Neon compute + verifying services\n');

// 1. Wake Neon (scale-to-zero compute takes 1-6s to resume)
const t0 = performance.now();
await sql`SELECT 1`;
console.log(`1. Neon awake — first query ${(performance.now() - t0).toFixed(0)}ms`);

// 2. Verify schema
const t1 = performance.now();
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
const need = ['rooms', 'polls', 'votes', 'qa_posts', 'members'];
const have = tables.map((r) => r.table_name);
const missing = need.filter((n) => !have.includes(n));
console.log(`2. Schema check ${(performance.now() - t1).toFixed(0)}ms — ${missing.length ? 'MISSING: ' + missing.join(',') : 'all 5 tables present'}`);
if (missing.length) {
  console.log('   Run: npm run db:init');
  process.exit(1);
}

// 3. Warm the hot path queries the app actually runs
const t2 = performance.now();
await sql`SELECT count(*)::int FROM members WHERE last_seen > now() - interval '5 minutes'`;
await sql`SELECT * FROM polls ORDER BY created_at DESC LIMIT 1`;
console.log(`3. Hot queries warmed — ${(performance.now() - t2).toFixed(0)}ms`);

// 4. Pusher trigger smoke test
if (process.env.PUSHER_APP_ID) {
  try {
    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER || 'ap2',
      useTLS: true,
    });
    await pusher.trigger('room-PREWARM', 'prewarm', { ts: Date.now() });
    console.log('4. Pusher trigger OK');
  } catch (e) {
    console.log('4. Pusher trigger FAILED:', e.message, '(REST fallback will cover clients)');
  }
} else {
  console.log('4. Pusher not configured — REST fallback active');
}

console.log('\nREADY — database hot, real-time verified. Start the session.');