export interface Room {
  id: string;
  code: string;
  name: string;
  host_name: string;
  passcode: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Poll {
  id: string;
  room_id: string;
  question: string;
  poll_type: 'single' | 'multi' | 'rating' | 'open_text';
  options: PollOption[];
  phase: 'voting_open' | 'voting_locked' | 'results_shown';
  correct_answers: number[];
  timer_seconds: number | null;
  created_at: string;
}

export interface PollOption {
  id: number;
  text: string;
  is_correct: boolean;
}

export interface Vote {
  id: string;
  poll_id: string;
  session_id: string;
  selected_options: number[];
  created_at: string;
}

export interface QAPost {
  id: string;
  room_id: string;
  content: string;
  display_name: string;
  is_anonymous: boolean;
  upvotes: number;
  is_pinned: boolean;
  is_answering: boolean;
  is_answered: boolean;
  is_hidden: boolean;
  created_at: string;
}

export interface RoomState {
  room: Room | null;
  polls: Poll[];
  currentPoll: Poll | null;
  qaPosts: QAPost[];
  sessionId: string;
  displayName: string;
  isConnected: boolean;
  participantCount: number;
}
