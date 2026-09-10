import db from './_db.cjs';
const { sql, initDB } = db;

export default async function handler(req, res) {
  await initDB();

  if (req.method === 'GET') {
    const { roomId, sessionId } = req.query;
    if (!roomId || !sessionId || typeof roomId !== 'string' || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Room ID and session ID required' });
    }

    const mine = await sql`
      SELECT v.post_id FROM qa_votes v
      JOIN qa_posts p ON p.id = v.post_id
      WHERE p.room_id = ${roomId} AND v.session_id = ${sessionId}
    `;

    return res.status(200).json({ postIds: mine.map((r) => r.post_id) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};