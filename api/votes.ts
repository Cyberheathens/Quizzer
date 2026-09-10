import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from './_db';
import { fire } from './_pusher';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initDB();

  if (req.method === 'POST') {
    const { pollId, sessionId, selectedOptions } = req.body;
    if (!pollId || !sessionId || !selectedOptions) {
      return res.status(400).json({ error: 'Poll ID, session ID, and selections required' });
    }

    // Check if already voted
    const existing = await sql`SELECT id FROM votes WHERE poll_id = ${pollId} AND session_id = ${sessionId}`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Already voted' });
    }

    // Check poll is open
    const polls = await sql`SELECT * FROM polls WHERE id = ${pollId}`;
    if (polls.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    if (polls[0].phase !== 'voting_open') {
      return res.status(403).json({ error: 'Voting is closed' });
    }

    await sql`
      INSERT INTO votes (poll_id, session_id, selected_options)
      VALUES (${pollId}, ${sessionId}, ${selectedOptions})
    `;

    // Results are aggregated on phase lock (PATCH /polls) — no per-vote
    // aggregation keeps a 1000-vote surge at 1 query per vote.

    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    const { pollId } = req.query;
    if (!pollId || typeof pollId !== 'string') {
      return res.status(400).json({ error: 'Poll ID required' });
    }

    const votes = await sql`SELECT selected_options FROM votes WHERE poll_id = ${pollId}`;
    const counts: Record<number, number> = {};
    votes.forEach((v: any) => {
      const opts = Array.isArray(v.selected_options) ? v.selected_options : [];
      opts.forEach((o: number) => {
        counts[o] = (counts[o] || 0) + 1;
      });
    });

    const results = Object.entries(counts).map(([idx, count]) => ({
      optionIndex: parseInt(idx),
      count,
    }));

    return res.status(200).json(results);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
