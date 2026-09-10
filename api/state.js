const { sql, initDB } = require('./_db');

function intervalFor(count, hasOpen) {
  if (hasOpen) return 5000;
  return count > 150 ? 30000 : 2500;
}

module.exports = async function handler(req, res) {
  await initDB();

  if (req.method === 'POST') {
    const { roomId, sessionId, displayName } = req.body;
    if (!roomId || !sessionId) {
      return res.status(400).json({ error: 'Room ID and session ID required' });
    }

    const rows = await sql`
      WITH upsert AS (
        INSERT INTO members (room_id, session_id, display_name)
        VALUES (${roomId}, ${sessionId}, ${displayName || 'Anonymous'})
        ON CONFLICT (room_id, session_id) DO UPDATE SET last_seen = now()
        RETURNING 1
      ),
      cnt AS (
        SELECT count(*)::int AS count FROM members
        WHERE room_id = ${roomId} AND last_seen > now() - interval '5 minutes'
      ),
      pls AS (
        SELECT COALESCE(json_agg(pl), '[]'::json) AS polls FROM (
          SELECT * FROM polls WHERE room_id = ${roomId} AND phase != 'draft' ORDER BY created_at DESC LIMIT 20
        ) pl
      ),
      qs AS (
        SELECT COALESCE(json_agg(q), '[]'::json) AS qa FROM (
          SELECT * FROM qa_posts WHERE room_id = ${roomId} ORDER BY created_at DESC LIMIT 100
        ) q
      ),
      op AS (
        SELECT EXISTS(SELECT 1 FROM polls WHERE room_id = ${roomId} AND phase = 'voting_open') AS has_open
      )
      SELECT cnt.count AS participants, pls.polls AS polls, qs.qa AS qa, op.has_open AS has_open FROM cnt, pls, qs, op
    `;

    const r = rows[0];
    return res.status(200).json({
      participants: r.participants,
      polls: r.polls,
      qa: r.qa,
      intervalMs: intervalFor(r.participants, r.has_open),
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};