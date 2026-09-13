const BLOCKLIST = [
  'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'cunt', 'nigger', 'faggot',
  'retard', 'whore', 'slut', 'motherfucker',
];

const LEET = { a: '[a@4]', e: '[e3]', i: '[i!1]', o: '[o0]', s: '[s$5]' };
const PROFANITY_PATTERNS = BLOCKLIST.map((word) => new RegExp(
  `\\b${word.split('').map((char) => LEET[char] || char).join('[^a-z]*')}(?:s|es|ing|ed|er)?\\b`,
  'i',
));

function normalizeWordResponse(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
    .toLowerCase();
}

function validateWordResponse(value) {
  const text = String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const normalized = normalizeWordResponse(text);
  if (!normalized) return { error: 'Enter a word or short phrase.' };
  if (normalized.length > 40) return { error: 'Keep responses to 40 characters or fewer.' };
  if (normalized.split(' ').length > 5) return { error: 'Keep responses to five words or fewer.' };
  if (PROFANITY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { error: 'That response cannot be added.' };
  }
  return { text, normalized };
}

async function getWordCloudSnapshot(sql, cloudId) {
  const clouds = await sql`
    SELECT id, room_id, prompt, state, launched_at, created_at
    FROM word_clouds WHERE id = ${cloudId}
  `;
  if (clouds.length === 0) return null;

  const words = await sql`
    SELECT normalized_text AS text, count(*)::int AS value
    FROM word_responses
    WHERE cloud_id = ${cloudId}
    GROUP BY normalized_text
    ORDER BY value DESC, normalized_text ASC
    LIMIT 60
  `;
  const totals = await sql`
    SELECT count(*)::int AS responses, count(DISTINCT session_id)::int AS contributors
    FROM word_responses WHERE cloud_id = ${cloudId}
  `;

  return {
    ...clouds[0],
    words,
    response_count: totals[0]?.responses || 0,
    contributor_count: totals[0]?.contributors || 0,
  };
}

exports.normalizeWordResponse = normalizeWordResponse;
exports.validateWordResponse = validateWordResponse;
exports.getWordCloudSnapshot = getWordCloudSnapshot;
