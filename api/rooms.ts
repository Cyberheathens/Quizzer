import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from './_db';


function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initDB();

  if (req.method === 'POST') {
    const { name, hostName, passcode } = req.body;
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
      INSERT INTO rooms (code, name, host_name, passcode)
      VALUES (${code}, ${name}, ${hostName}, ${passcode || null})
      RETURNING *
    `;

    const room = result[0];
    return res.status(201).json(room);
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

  return res.status(405).json({ error: 'Method not allowed' });
}
