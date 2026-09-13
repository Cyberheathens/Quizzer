import db from './_db.cjs';
import pusherPkg from './_pusher.cjs';
import wordCloudPkg from './_word-cloud.cjs';

const { sql, initDB } = db;
const { fire } = pusherPkg;
const { validateWordResponse, getWordCloudSnapshot } = wordCloudPkg;

export default async function handler(req, res) {
  await initDB();

  if (req.method === 'GET') {
    const { cloudId } = req.query;
    if (!cloudId || typeof cloudId !== 'string') return res.status(400).json({ error: 'Cloud ID required' });
    const cloud = await getWordCloudSnapshot(sql, cloudId);
    if (!cloud) return res.status(404).json({ error: 'Word cloud not found' });
    return res.status(200).json(cloud);
  }

  if (req.method === 'POST') {
    const { cloudId, sessionId, text } = req.body;
    if (!cloudId || !sessionId) return res.status(400).json({ error: 'Cloud ID and session ID required' });
    const validated = validateWordResponse(text);
    if (validated.error) return res.status(400).json({ error: validated.error });

    const clouds = await sql`
      SELECT c.*, r.code AS room_code
      FROM word_clouds c JOIN rooms r ON r.id = c.room_id
      WHERE c.id = ${cloudId}
    `;
    if (clouds.length === 0) return res.status(404).json({ error: 'Word cloud not found' });
    if (clouds[0].state !== 'open') return res.status(403).json({ error: 'This word cloud is not accepting responses' });

    const recent = await sql`
      SELECT 1 FROM word_responses
      WHERE cloud_id = ${cloudId} AND session_id = ${sessionId}
        AND created_at > now() - interval '2 seconds'
      LIMIT 1
    `;
    if (recent.length > 0) return res.status(429).json({ error: 'Please wait a moment before adding another response' });

    try {
      await sql`
        INSERT INTO word_responses (cloud_id, session_id, text, normalized_text)
        VALUES (${cloudId}, ${sessionId}, ${validated.text}, ${validated.normalized})
      `;
    } catch (error) {
      if (error?.code === '23505' || String(error?.message || '').includes('unique')) {
        return res.status(409).json({ error: 'You already added that response' });
      }
      throw error;
    }

    const cloud = await getWordCloudSnapshot(sql, cloudId);
    await fire(`room-${clouds[0].room_code}`, 'wordcloud:update', cloud);
    return res.status(201).json(cloud);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
