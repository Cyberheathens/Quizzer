import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from './_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initDB();

  if (req.method === 'GET') {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID required' });
    }

    const counts = await sql`
      SELECT count(*)::int AS count FROM members
      WHERE room_id = ${roomId} AND last_seen > now() - interval '5 minutes'
    `;

    return res.status(200).json({ count: counts[0].count });
  }

  if (req.method === 'POST') {
    const { roomId, sessionId, displayName } = req.body;
    if (!roomId || !sessionId) {
      return res.status(400).json({ error: 'Room ID and session ID required' });
    }

    await sql`
      INSERT INTO members (room_id, session_id, display_name)
      VALUES (${roomId}, ${sessionId}, ${displayName || 'Anonymous'})
      ON CONFLICT (room_id, session_id) DO UPDATE SET last_seen = now()
    `;

    const counts = await sql`
      SELECT count(*)::int AS count FROM members
      WHERE room_id = ${roomId} AND last_seen > now() - interval '5 minutes'
    `;

    return res.status(200).json({ count: counts[0].count });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}