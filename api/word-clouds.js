import db from './_db.cjs';
import pusherPkg from './_pusher.cjs';
import wordCloudPkg from './_word-cloud.cjs';

const { sql, initDB } = db;
const { fire } = pusherPkg;
const { getWordCloudSnapshot } = wordCloudPkg;

async function roomCode(roomId) {
  const rooms = await sql`SELECT code FROM rooms WHERE id = ${roomId}`;
  return rooms[0]?.code || null;
}

export default async function handler(req, res) {
  await initDB();

  if (req.method === 'GET') {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') return res.status(400).json({ error: 'Room ID required' });
    const clouds = await sql`
      SELECT c.id, c.room_id, c.prompt, c.state, c.launched_at, c.created_at,
        count(w.id)::int AS response_count,
        count(DISTINCT w.session_id)::int AS contributor_count
      FROM word_clouds c
      LEFT JOIN word_responses w ON w.cloud_id = c.id
      WHERE c.room_id = ${roomId}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    return res.status(200).json(clouds);
  }

  if (req.method === 'POST') {
    const { roomId, prompt, launch } = req.body;
    const cleanPrompt = String(prompt || '').trim();
    if (!roomId || !cleanPrompt) return res.status(400).json({ error: 'Room ID and prompt required' });
    if (cleanPrompt.length > 160) return res.status(400).json({ error: 'Prompt must be 160 characters or fewer' });

    if (launch) await sql`UPDATE word_clouds SET state = 'locked' WHERE room_id = ${roomId} AND state = 'open'`;
    const rows = await sql`
      INSERT INTO word_clouds (room_id, prompt, state, launched_at)
      VALUES (${roomId}, ${cleanPrompt}, ${launch ? 'open' : 'draft'}, ${launch ? new Date().toISOString() : null})
      RETURNING id
    `;
    const cloud = await getWordCloudSnapshot(sql, rows[0].id);
    if (launch) {
      const code = await roomCode(roomId);
      if (code) await fire(`room-${code}`, 'wordcloud:update', cloud);
    }
    return res.status(201).json(cloud);
  }

  if (req.method === 'PATCH') {
    const { cloudId, action } = req.body;
    if (!cloudId || !action) return res.status(400).json({ error: 'Cloud ID and action required' });
    const existing = await sql`SELECT * FROM word_clouds WHERE id = ${cloudId}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Word cloud not found' });
    const current = existing[0];

    if (action === 'launch') {
      await sql`UPDATE word_clouds SET state = 'locked' WHERE room_id = ${current.room_id} AND state = 'open' AND id != ${cloudId}`;
      await sql`UPDATE word_clouds SET state = 'open', launched_at = now() WHERE id = ${cloudId}`;
    } else if (action === 'lock') {
      if (current.state !== 'open') return res.status(409).json({ error: 'Only a live cloud can be locked' });
      await sql`UPDATE word_clouds SET state = 'locked' WHERE id = ${cloudId}`;
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    const cloud = await getWordCloudSnapshot(sql, cloudId);
    const code = await roomCode(current.room_id);
    if (code) await fire(`room-${code}`, 'wordcloud:update', cloud);
    return res.status(200).json(cloud);
  }

  if (req.method === 'DELETE') {
    const cloudId = req.query.cloudId;
    if (!cloudId || typeof cloudId !== 'string') return res.status(400).json({ error: 'Cloud ID required' });
    const rows = await sql`SELECT room_id, state FROM word_clouds WHERE id = ${cloudId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Word cloud not found' });
    if (rows[0].state === 'open') return res.status(409).json({ error: 'Lock the word cloud before deleting it' });
    await sql`DELETE FROM word_clouds WHERE id = ${cloudId}`;
    const replacements = await sql`
      SELECT id
      FROM word_clouds
      WHERE room_id = ${rows[0].room_id} AND state IN ('open', 'locked')
      ORDER BY (state = 'open') DESC, launched_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `;
    const replacement = replacements[0] ? await getWordCloudSnapshot(sql, replacements[0].id) : null;
    const code = await roomCode(rows[0].room_id);
    if (code) await fire(`room-${code}`, 'wordcloud:update', replacement);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
