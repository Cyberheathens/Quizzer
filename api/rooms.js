import db from './_db.cjs';
const { sql, initDB } = db;
import pusherPkg from './_pusher.cjs';
const { fire } = pusherPkg;


function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default async function handler(req, res) {
  await initDB();

  if (req.method === 'POST') {
    const { name, hostName } = req.body;
    if (!name || !hostName) {
      return res.status(400).json({ error: 'Name and host name required' });
    }

    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      try {
        const existing = await sql`SELECT id FROM rooms WHERE code = ${code}`;
        if (existing.length === 0) break;
        code = generateCode();
        attempts++;
      } catch {
        break;
      }
    }

    const result = await sql`
      INSERT INTO rooms (code, name, host_name, passcode, status)
      VALUES (${code}, ${name}, ${hostName}, ${code}, 'draft')
      RETURNING *
    `;

    return res.status(201).json(result[0]);
  }

  if (req.method === 'GET') {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code required' });
    }

    const result = await sql`SELECT * FROM rooms WHERE code = ${code.toUpperCase()} AND is_active = true`;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    return res.status(200).json(result[0]);
  }

  if (req.method === 'PATCH') {
    const { code, action } = req.body;
    if (!code || !action) {
      return res.status(400).json({ error: 'Code and action required' });
    }
    const upper = String(code).toUpperCase();

    if (action === 'open') {
      const result = await sql`UPDATE rooms SET status = 'open' WHERE code = ${upper} AND is_active = true RETURNING *`;
      if (result.length === 0) return res.status(404).json({ error: 'Room not found' });
      await fire(`room-${upper}`, 'room:open', { code: upper });
      return res.status(200).json(result[0]);
    }

    if (action === 'end') {
      const result = await sql`UPDATE rooms SET is_active = false, status = 'draft' WHERE code = ${upper} RETURNING *`;
      if (result.length === 0) return res.status(404).json({ error: 'Room not found' });
      await fire(`room-${upper}`, 'room:ended', {});
      return res.status(200).json(result[0]);
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
