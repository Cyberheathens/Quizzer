const { sql, initDB } = require('./_db.cjs');

module.exports = async function handler(req, res) {
  await initDB();

  if (req.method === 'GET') {
    const { quizId } = req.query;
    if (!quizId || typeof quizId !== 'string') {
      return res.status(400).json({ error: 'Quiz ID required' });
    }

    const quizzes = await sql`SELECT * FROM quizzes WHERE id = ${quizId}`;
    if (quizzes.length === 0) return res.status(404).json({ error: 'Quiz not found' });

    const rows = await sql`
      SELECT m.display_name AS name, v.session_id AS session_id, count(*)::int AS score
      FROM votes v
      JOIN polls p ON p.id = v.poll_id
      JOIN members m ON m.session_id = v.session_id AND m.room_id = p.room_id
      WHERE p.quiz_id = ${quizId}
        AND cardinality(p.correct_answers) > 0
        AND v.selected_options @> p.correct_answers
        AND v.selected_options <@ p.correct_answers
        AND cardinality(v.selected_options) = cardinality(p.correct_answers)
      GROUP BY v.session_id, m.display_name
      ORDER BY score DESC
      LIMIT 20
    `;

    const totals = await sql`
      SELECT count(*)::int AS total FROM polls WHERE quiz_id = ${quizId}
    `;

    return res.status(200).json({ leaderboard: rows, totalQuestions: totals[0].total });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};