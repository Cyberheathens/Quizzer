// Common English + Hindi (romanized) filler words excluded from word clouds.
// Words shorter than 4 chars are dropped by length filter already.
export const STOPWORDS = new Set([
  // question/function words
  'what', 'which', 'whats', 'when', 'where', 'does', 'would', 'could', 'should',
  'will', 'shall', 'have', 'having', 'this', 'that', 'these', 'those', 'there',
  'their', 'them', 'they', 'were', 'been', 'being', 'with', 'from', 'about',
  'into', 'than', 'then', 'also', 'very', 'just', 'like', 'some', 'more',
  'most', 'much', 'many', 'such', 'only', 'over', 'after', 'before', 'because',
  'why', 'how', 'who', 'whom', 'whose', 'and', 'but', 'for', 'not', 'are',
  'was', 'the', 'you', 'your', 'can', 'get', 'got', 'has', 'had', 'did',
  'out', 'all', 'any', 'our', 'his', 'her', 'him', 'she', 'its', 'it\'s',
  // filler / common verbs
  'make', 'made', 'want', 'need', 'know', 'think', 'tell', 'give', 'take',
  'please', 'thanks', 'thank', 'okay', 'yeah', 'hello', 'guys', 'sir',
  'really', 'actually', 'maybe', 'kind', 'good', 'best', 'nice', 'great',
  'here', 'even', 'also', 'still', 'well', 'much', 'many', 'thing', 'things',
  'something', 'anything', 'everything', 'nothing', 'everyone', 'someone',
  'possible', 'true', 'false', 'correct', 'wrong', 'right', 'answer',
  'question', 'questions', 'quiz',
]);

export function filterStopwords(words: string[]): string[] {
  return words.filter((w) => !STOPWORDS.has(w));
}