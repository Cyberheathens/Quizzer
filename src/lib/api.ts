import type { Room, Poll, QAPost, QuizSnapshot } from '@/types';

const BASE = '/api';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Room APIs
export const createRoom = (data: { name: string; hostName: string; passcode?: string }) =>
  fetchJSON<Room>(`${BASE}/rooms`, { method: 'POST', body: JSON.stringify(data) });

export const getRoom = (code: string) =>
  fetchJSON<Room>(`${BASE}/rooms?code=${code}`);

export const joinRoom = (data: { code: string; passcode?: string; sessionId: string; displayName: string }) =>
  fetchJSON<{ room: Room; sessionId: string }>(`${BASE}/rooms/join`, { method: 'POST', body: JSON.stringify(data) });

// Poll APIs
export const createPoll = (data: {
  roomId: string;
  question: string;
  pollType: string;
  options: { text: string; isCorrect: boolean }[];
  timerSeconds?: number;
  questionImage?: string;
  launch?: boolean;
}) => fetchJSON<Poll>(`${BASE}/polls`, { method: 'POST', body: JSON.stringify(data) });

export const getPolls = (roomId: string) =>
  fetchJSON<Poll[]>(`${BASE}/polls?roomId=${roomId}`);

export const updatePollPhase = (pollId: string, phase: string) =>
  fetchJSON<Poll>(`${BASE}/polls`, { method: 'PATCH', body: JSON.stringify({ pollId, phase }) });

export const submitVote = (data: {
  pollId: string;
  sessionId: string;
  selectedOptions: number[];
}) => fetchJSON<{ success: boolean }>(`${BASE}/votes`, { method: 'POST', body: JSON.stringify(data) });

export const getVoteResults = (pollId: string) =>
  fetchJSON<{ optionIndex: number; count: number }[]>(`${BASE}/votes?pollId=${pollId}`);

// Q&A APIs
export const createQAPost = (data: {
  roomId: string;
  content: string;
  displayName: string;
  isAnonymous: boolean;
}) => fetchJSON<QAPost>(`${BASE}/qa`, { method: 'POST', body: JSON.stringify(data) });

export const getQAPosts = (roomId: string) =>
  fetchJSON<QAPost[]>(`${BASE}/qa?roomId=${roomId}`);

export const updateQAPost = (data: {
  postId: string;
  action: 'pin' | 'answering' | 'answered' | 'hide' | 'upvote';
}) => fetchJSON<QAPost>(`${BASE}/qa`, { method: 'PATCH', body: JSON.stringify(data) });

export const heartbeatParticipant = (data: {
  roomId: string;
  sessionId: string;
  displayName?: string;
}) => fetchJSON<{ count: number; intervalMs?: number }>(`${BASE}/participants`, { method: 'POST', body: JSON.stringify(data) });

export const getRoomState = (data: {
  roomId: string;
  sessionId: string;
  displayName?: string;
  includeDrafts?: boolean;
}) => fetchJSON<{ participants: number; polls: Poll[]; qa: QAPost[]; quizInfo: { quiz_id: string; title: string; order_index: number; total: number } | null; intervalMs: number }>(`${BASE}/state`, { method: 'POST', body: JSON.stringify(data) });

export const roomAction = (code: string, action: 'open' | 'end') =>
  fetchJSON<Room>(`${BASE}/rooms`, { method: 'PATCH', body: JSON.stringify({ code, action }) });

export const launchPoll = (pollId: string) =>
  fetchJSON<Poll>(`${BASE}/polls`, { method: 'PATCH', body: JSON.stringify({ pollId, action: 'launch' }) });

export const updateDraftPoll = (data: {
  pollId: string;
  question?: string;
  options?: { text: string; isCorrect: boolean }[];
  questionImage?: string | null;
  timerSeconds?: number | null;
}) => fetchJSON<Poll>(`${BASE}/polls`, { method: 'PATCH', body: JSON.stringify({ ...data, action: 'update' }) });

export const deletePoll = (pollId: string) =>
  fetchJSON<{ success: boolean }>(`${BASE}/polls?pollId=${pollId}`, { method: 'DELETE' });

export const createQuiz = (data: {
  roomId: string;
  title: string;
  questions: {
    question: string;
    questionImage?: string;
    pollType?: 'single' | 'multi';
    options: { text: string; isCorrect: boolean }[];
    timerSeconds?: number | null;
  }[];
}) => fetchJSON<QuizSnapshot>(`${BASE}/quizzes`, { method: 'POST', body: JSON.stringify(data) });

export const getQuizzes = (roomId: string) =>
  fetchJSON<QuizSnapshot[]>(`${BASE}/quizzes?roomId=${roomId}`);

export const updateQuiz = (data: {
  quizId: string;
  title?: string;
  questions?: {
    question: string;
    questionImage?: string;
    pollType?: 'single' | 'multi';
    options: { text: string; isCorrect: boolean }[];
    timerSeconds?: number | null;
  }[];
}) => fetchJSON<QuizSnapshot>(`${BASE}/quizzes`, { method: 'PATCH', body: JSON.stringify({ ...data, action: 'update' }) });

export const quizAction = (quizId: string, action: 'launch' | 'lock' | 'reveal' | 'next' | 'delete') =>
  fetchJSON<QuizSnapshot>(`${BASE}/quizzes`, { method: 'PATCH', body: JSON.stringify({ quizId, action }) });

export const getLeaderboard = (quizId: string) =>
  fetchJSON<{ leaderboard: { name: string; session_id: string; score: number }[]; totalQuestions: number }>(`${BASE}/leaderboard?quizId=${quizId}`);
