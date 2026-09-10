import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from '../_db';
import { fire } from '../_pusher';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initDB();

  if (req.method === 'POST') {
    const { code, passcode, sessionId, displayName } = req.body;
    if (!code || !sessionId || !displayName) {
      return res.status(400).json({ error: 'Code, session ID, and display name required' });
    }

    const rooms = await sql`SELECT * FROM rooms WHERE code = ${code.toUpperCase()} AND is_active = true`;
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = rooms[0];
    if (room.passcode && room.passcode !== passcode) {
      return res.status(403).json({ error: 'Invalid passcode' });
    }

    await sql`
      INSERT INTO members (room_id, session_id, display_name)
      VALUES (${room.id}, ${sessionId}, ${displayName})
      ON CONFLICT (room_id, session_id) DO UPDATE SET last_seen = now()
    `;

    const counts = await sql`
      SELECT count(*)::int AS count FROM members
      WHERE room_id = ${room.id} AND last_seen > now() - interval '5 minutes'
    `;

    await fire(`room-${room.code}`, 'participants', { count: counts[0].count });

    return res.status(200).json({ room, sessionId, participantCount: counts[0].count });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}