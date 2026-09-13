import { create } from 'zustand';
import type { Room, Poll, QAPost, WordCloud } from '@/types';
import { getSessionId, getDisplayName } from '@/lib/utils';

interface AppStore {
  room: Room | null;
  polls: Poll[];
  currentPoll: Poll | null;
  qaPosts: QAPost[];
  sessionId: string;
  displayName: string;
  isConnected: boolean;
  participantCount: number;
  quizInfo: { quiz_id: string; title: string; order_index: number; total: number } | null;
  myUpvotes: string[];
  hasVoted: Record<string, boolean>;
  voteResults: Record<string, { optionIndex: number; count: number }[]>;
  wordCloud: WordCloud | null;

  setRoom: (room: Room | null) => void;
  setPolls: (polls: Poll[]) => void;
  addPoll: (poll: Poll) => void;
  updatePoll: (poll: Poll) => void;
  setCurrentPoll: (poll: Poll | null) => void;
  setQAPosts: (posts: QAPost[]) => void;
  addQAPost: (post: QAPost) => void;
  updateQAPost: (post: QAPost) => void;
  setConnected: (connected: boolean) => void;
  setParticipantCount: (count: number) => void;
  setQuizInfo: (info: { quiz_id: string; title: string; order_index: number; total: number } | null) => void;
  setMyUpvotes: (ids: string[]) => void;
  toggleMyUpvote: (postId: string) => void;
  markVoted: (pollId: string) => void;
  setVoteResults: (pollId: string, results: { optionIndex: number; count: number }[]) => void;
  setDisplayName: (name: string) => void;
  setWordCloud: (cloud: WordCloud | null) => void;
  reset: () => void;
}

export const useStore = create<AppStore>((set) => ({
  room: null,
  polls: [],
  currentPoll: null,
  qaPosts: [],
  sessionId: getSessionId(),
  displayName: getDisplayName(),
  isConnected: false,
  participantCount: 0,
  quizInfo: null,
  myUpvotes: [],
  hasVoted: {},
  voteResults: {},
  wordCloud: null,

  setRoom: (room) => set({ room }),
  setPolls: (polls) => set({ polls }),
  addPoll: (poll) => set((s) => ({ polls: [...s.polls, poll], currentPoll: poll })),
  updatePoll: (poll) =>
    set((s) => ({
      polls: s.polls.map((p) => (p.id === poll.id ? poll : p)),
      currentPoll: s.currentPoll?.id === poll.id ? poll : s.currentPoll,
    })),
  setCurrentPoll: (poll) => set({ currentPoll: poll }),
  setQAPosts: (posts) => set({ qaPosts: posts }),
  addQAPost: (post) => set((s) => ({ qaPosts: [post, ...s.qaPosts] })),
  updateQAPost: (post) =>
    set((s) => ({
      qaPosts: s.qaPosts.map((p) => (p.id === post.id ? post : p)),
    })),
  setConnected: (connected) => set({ isConnected: connected }),
  setParticipantCount: (count) => set({ participantCount: count }),
  setQuizInfo: (quizInfo) => set({ quizInfo }),
  setMyUpvotes: (myUpvotes) => set({ myUpvotes }),
  toggleMyUpvote: (postId) => set((s) => ({ myUpvotes: s.myUpvotes.includes(postId) ? s.myUpvotes.filter((id) => id !== postId) : [...s.myUpvotes, postId] })),
  markVoted: (pollId) => set((s) => ({ hasVoted: { ...s.hasVoted, [pollId]: true } })),
  setVoteResults: (pollId, results) =>
    set((s) => ({ voteResults: { ...s.voteResults, [pollId]: results } })),
  setDisplayName: (name) => set({ displayName: name }),
  setWordCloud: (wordCloud) => set({ wordCloud }),
  reset: () =>
    set({
      room: null,
      polls: [],
      currentPoll: null,
      qaPosts: [],
      isConnected: false,
      participantCount: 0,
      quizInfo: null,
      myUpvotes: [],
      hasVoted: {},
      voteResults: {},
      wordCloud: null,
    }),
}));
