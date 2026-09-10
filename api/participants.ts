import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from './_db';

function intervalFor(count: number): number {
  return count > 150 ? 30000 : 2500;
}

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

    return res.status(200).json({ count: counts[0].count, intervalMs: intervalFor(counts[0].count) });
  }

  if (req.method === 'POST') {
    const { roomId, sessionId, displayName } = req.body;
    if (!roomId || !sessionId) {
      return res.status(400).json({ error: 'Room ID and session ID required' });
    }

    const counts = await sql`
      WITH upsert AS (
        INSERT INTO members (room_id, session_id, display_name)
        VALUES (${roomId}, ${sessionId}, ${displayName || 'Anonymous'})
        ON CONFLICT (room_id, session_id) DO UPDATE SET last_seen = now()
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM members
      WHERE room_id = ${roomId} AND last_seen > now() - interval '5 minutes'
    `;

    return res.status(200).json({ count: counts[0].count, intervalMs: intervalFor(counts[0].count) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}