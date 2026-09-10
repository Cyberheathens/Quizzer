import type { Room, Poll, QAPost } from '@/types';

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
}) => fetchJSON<{ count: number }>(`${BASE}/participants`, { method: 'POST', body: JSON.stringify(data) });
