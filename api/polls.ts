import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from './_db';
import { fire } from './_pusher';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initDB();

  if (req.method === 'POST') {
    const { roomId, question, pollType, options, timerSeconds } = req.body;
    if (!roomId || !question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Room ID, question, and at least 2 options required' });
    }

    const result = await sql`
      INSERT INTO polls (room_id, question, poll_type, options, correct_answers, timer_seconds)
      VALUES (
        ${roomId},
        ${question},
        ${pollType || 'single'},
        ${JSON.stringify(options.map((o: any, i: number) => ({ id: i, text: o.text, is_correct: o.isCorrect })))},
        ${options.map((o: any, i: number) => o.isCorrect ? i : -1).filter((i: number) => i >= 0)},
        ${timerSeconds || null}
      )
      RETURNING *
    `;

    const poll = result[0];
    poll.options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

    // Get room code for Pusher channel
    const rooms = await sql`SELECT code FROM rooms WHERE id = ${roomId}`;
    if (rooms.length > 0) {
      await fire(`room-${rooms[0].code}`, 'poll:new', poll);
    }

    return res.status(201).json(poll);
  }

  if (req.method === 'GET') {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID required' });
    }

    const result = await sql`SELECT * FROM polls WHERE room_id = ${roomId} ORDER BY created_at DESC`;
    const polls = result.map((p: any) => ({
      ...p,
      options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
    }));

    return res.status(200).json(polls);
  }

  if (req.method === 'PATCH') {
    const { pollId, phase } = req.body;
    if (!pollId || !phase) {
      return res.status(400).json({ error: 'Poll ID and phase required' });
    }

    const result = await sql`
      UPDATE polls SET phase = ${phase} WHERE id = ${pollId} RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const poll = result[0];
    poll.options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

    // Aggregate results for locked/revealed phases
    let voteResults: any[] = [];
    if (phase === 'voting_locked' || phase === 'results_shown') {
      const votes = await sql`SELECT selected_options FROM votes WHERE poll_id = ${pollId}`;
      const counts: Record<number, number> = {};
      votes.forEach((v: any) => {
        const opts = Array.isArray(v.selected_options) ? v.selected_options : [];
        opts.forEach((o: number) => {
          counts[o] = (counts[o] || 0) + 1;
        });
      });
      voteResults = Object.entries(counts).map(([idx, count]) => ({
        optionIndex: parseInt(idx),
        count,
      }));
    }

    // Get room code
    const polls = await sql`SELECT room_id FROM polls WHERE id = ${pollId}`;
    if (polls.length > 0) {
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${polls[0].room_id}`;
      if (rooms.length > 0) {
        await fire(`room-${rooms[0].code}`, 'poll:update', { ...poll, voteResults });
      }
    }

    return res.status(200).json({ ...poll, voteResults });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
