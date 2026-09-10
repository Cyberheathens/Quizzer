import db from './_db.cjs';
const { sql, initDB } = db;
import pusherPkg from './_pusher.cjs';
const { fire } = pusherPkg;



export default async function handler(req, res) {
  await initDB();

  if (req.method === 'POST') {
    const { roomId, content, displayName, isAnonymous } = req.body;
    if (!roomId || !content) {
      return res.status(400).json({ error: 'Room ID and content required' });
    }

    if (content.length > 300) {
      return res.status(400).json({ error: 'Content too long (max 300 chars)' });
    }

    const result = await sql`
      INSERT INTO qa_posts (room_id, content, display_name, is_anonymous)
      VALUES (${roomId}, ${content}, ${displayName || 'Anonymous'}, ${isAnonymous || false})
      RETURNING *
    `;

    const post = result[0];

    const rooms = await sql`SELECT code FROM rooms WHERE id = ${roomId}`;
    if (rooms.length > 0) {
      await fire(`room-${rooms[0].code}`, 'qa:new', post);
    }

    return res.status(201).json(post);
  }

  if (req.method === 'GET') {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID required' });
    }

    const result = await sql`
      SELECT * FROM qa_posts WHERE room_id = ${roomId} ORDER BY created_at DESC LIMIT 100
    `;

    const { sessionId } = req.query;
    let myUpvotes = [];
    if (sessionId && typeof sessionId === 'string') {
      const mine = await sql`
        SELECT v.post_id FROM qa_votes v
        JOIN qa_posts p ON p.id = v.post_id
        WHERE p.room_id = ${roomId} AND v.session_id = ${sessionId}
      `;
      myUpvotes = mine.map((r) => r.post_id);
    }

    res.setHeader('X-My-Upvotes', myUpvotes.join(','));
    return res.status(200).json(result);
  }

  if (req.method === 'PATCH') {
    const { postId, action } = req.body;
    if (!postId || !action) {
      return res.status(400).json({ error: 'Post ID and action required' });
    }

    let result;
    switch (action) {
      case 'pin':
        result = await sql`UPDATE qa_posts SET is_pinned = NOT is_pinned WHERE id = ${postId} RETURNING *`;
        break;
      case 'answering':
        result = await sql`UPDATE qa_posts SET is_answering = NOT is_answering WHERE id = ${postId} RETURNING *`;
        break;
      case 'answered':
        result = await sql`UPDATE qa_posts SET is_answered = true, is_answering = false WHERE id = ${postId} RETURNING *`;
        break;
      case 'hide':
        result = await sql`UPDATE qa_posts SET is_hidden = NOT is_hidden WHERE id = ${postId} RETURNING *`;
        break;
      case 'upvote': {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'Session ID required for upvoting' });
        const existingVote = await sql`SELECT 1 FROM qa_votes WHERE post_id = ${postId} AND session_id = ${sessionId}`;
        if (existingVote.length > 0) {
          // toggle off
          await sql`DELETE FROM qa_votes WHERE post_id = ${postId} AND session_id = ${sessionId}`;
          result = await sql`UPDATE qa_posts SET upvotes = upvotes - 1 WHERE id = ${postId} AND upvotes > 0 RETURNING *`;
        } else {
          await sql`INSERT INTO qa_votes (post_id, session_id) VALUES (${postId}, ${sessionId}) ON CONFLICT DO NOTHING`;
          result = await sql`UPDATE qa_posts SET upvotes = upvotes + 1 WHERE id = ${postId} RETURNING *`;
        }
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = result[0];

    const posts = await sql`SELECT room_id FROM qa_posts WHERE id = ${postId}`;
    if (posts.length > 0) {
      const rooms = await sql`SELECT code FROM rooms WHERE id = ${posts[0].room_id}`;
      if (rooms.length > 0) {
        await fire(`room-${rooms[0].code}`, 'qa:update', post);
      }
    }

    return res.status(200).json(post);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};