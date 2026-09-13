const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWordResponse,
  validateWordResponse,
  getWordCloudSnapshot,
} = require('../api/_word-cloud.cjs');

test('normalizes case, spacing, Unicode, and edge punctuation', () => {
  assert.equal(normalizeWordResponse('  Innovation!!!  '), 'innovation');
  assert.equal(normalizeWordResponse('TEAM    WORK'), 'team work');
  assert.equal(normalizeWordResponse('Ｆｏｃｕｓ'), 'focus');
});

test('keeps meaningful punctuation inside a phrase', () => {
  assert.equal(normalizeWordResponse('student-led learning'), 'student-led learning');
  assert.equal(normalizeWordResponse('design & research'), 'design & research');
});

test('rejects empty and oversized responses', () => {
  assert.match(validateWordResponse('!!!').error, /enter/i);
  assert.match(validateWordResponse('one two three four five six').error, /five words/i);
  assert.match(validateWordResponse('x'.repeat(41)).error, /40 characters/i);
});

test('rejects direct, inflected, leetspeak, and separator-obfuscated profanity', () => {
  for (const value of ['fuck', 'fucking', 'sh1t', 'f.u.c.k', 'a$$hole']) {
    assert.match(validateWordResponse(value).error, /cannot be added/i, value);
  }
});

test('returns original display text and a normalized aggregate key', () => {
  assert.deepEqual(validateWordResponse('  Innovation!!!  '), {
    text: 'Innovation!!!',
    normalized: 'innovation',
  });
});

test('builds a complete word-cloud snapshot from database results', async () => {
  const calls = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    calls.push({ query, values });

    if (query.includes('FROM word_clouds WHERE id')) {
      return [{
        id: 'cloud-1',
        room_id: 'room-1',
        prompt: 'Describe the session',
        state: 'open',
        launched_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
      }];
    }
    if (query.includes('GROUP BY normalized_text')) {
      return [{ text: 'clear', value: 3 }, { text: 'useful', value: 1 }];
    }
    if (query.includes('count(DISTINCT session_id)')) {
      return [{ responses: 4, contributors: 3 }];
    }
    throw new Error(`Unexpected query: ${query}`);
  };

  const snapshot = await getWordCloudSnapshot(sql, 'cloud-1');

  assert.equal(calls.length, 3);
  assert.deepEqual(snapshot.words, [
    { text: 'clear', value: 3 },
    { text: 'useful', value: 1 },
  ]);
  assert.equal(snapshot.response_count, 4);
  assert.equal(snapshot.contributor_count, 3);
});

test('returns null when the requested word cloud does not exist', async () => {
  const sql = async () => [];
  assert.equal(await getWordCloudSnapshot(sql, 'missing'), null);
});
