import { useEffect, useState } from 'react';
import { useParams, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getRoom, getPolls, getQAPosts, getVoteResults, getRoomState, getMyUpvotes } from '@/lib/api';
import type { Room } from '@/types';
import { subscribeToRoom, unsubscribeFromRoom } from '@/lib/pusher';
import { useStore } from '@/store/useStore';
import ParticipantView from '@/components/participant/ParticipantView';
import HostView from '@/components/presenter/HostView';
import StageView from '@/components/stage/StageView';
import JoinDialog from '@/components/JoinDialog';
import toast from 'react-hot-toast';

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isHost = location.pathname.endsWith('/host');
  const { sessionId, displayName, room, setRoom, setPolls, setQAPosts, addPoll, updatePoll, addQAPost, updateQAPost, setVoteResults, setParticipantCount, setQuizInfo, setMyUpvotes, setConnected } = useStore();
  const [loading, setLoading] = useState(true);
  const [needsJoin, setNeedsJoin] = useState(false);

  useEffect(() => {
    if (!code) return;

    let alive = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const loadRoom = async () => {
      try {
        const r = await getRoom(code);
        setRoom(r);

        const [polls, posts] = await Promise.all([
          getPolls(r.id).catch(() => []),
          getQAPosts(r.id).catch(() => []),
        ]);

        setPolls(polls);
        setQAPosts(posts);
        getMyUpvotes(r.id, sessionId).then((m) => setMyUpvotes(m.postIds)).catch(() => {});

        if (!isHost) {
          const joined = localStorage.getItem(`room_${code}_joined`);
          if (!joined) {
            setNeedsJoin(true);
          }
        }

        if (alive) {
          const schedule = (ms: number) => {
            interval = setTimeout(async () => {
              const next = await refresh(r);
              if (alive) schedule(next ?? 2500);
            }, ms);
          };
          schedule(2500);
        }
      } catch {
        toast.error('Room not found');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    const refresh = async (r: Room): Promise<number> => {
      if (!alive) return 2500;
      try {
        const s = await getRoomState({ roomId: r.id, sessionId, displayName, includeDrafts: isHost });

        setQAPosts(s.qa || []);
        setParticipantCount(s.participants);
        setQuizInfo(s.quizInfo ?? null);

        if (s.polls) {
          setPolls(s.polls);
          const latest = s.polls[0];
          if (latest) {
            const cur = useStore.getState().currentPoll;
            if (!cur || cur.id !== latest.id || cur.phase !== latest.phase) {
              useStore.setState({ currentPoll: latest });
            }
            if (latest.phase !== 'voting_open') {
              const cached = useStore.getState().voteResults[latest.id];
              if (!cached) {
                const results = await getVoteResults(latest.id).catch(() => null);
                if (results) setVoteResults(latest.id, results);
              }
            }
          }
        }
        return s.intervalMs ?? 2500;
      } catch {
        return 5000;
      }
    };

    loadRoom();

    const channel = subscribeToRoom(code);
    channel.bind('poll:new', (data: any) => {
      const st = useStore.getState();
      if (st.polls.some((p) => p.id === data.id)) st.updatePoll(data);
      else st.addPoll(data);
    });
    channel.bind('poll:update', (data: any) => {
      updatePoll(data);
      if (data.voteResults) setVoteResults(data.id, data.voteResults);
    });
    channel.bind('qa:new', (data: any) => addQAPost(data));
    channel.bind('qa:update', (data: any) => updateQAPost(data));
    channel.bind('participants', (data: any) => setParticipantCount(data.count));
    channel.bind('room:open', () => {
      toast.success('Room is open!');
      if (room) useStore.getState().setRoom({ ...room, status: 'open' });
    });
    channel.bind('vote:update', (data: any) => setVoteResults(data.pollId, data.results));
    channel.bind('room:ended', () => {
      toast('Room has ended');
      navigate('/');
    });

    setConnected(true);

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      unsubscribeFromRoom(code);
      setConnected(false);
    };
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-12 h-12 border-2 border-coral/30 border-t-coral rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Connecting...</p>
        </motion.div>
      </div>
    );
  }

  if (needsJoin) {
    return <JoinDialog roomCode={code!} onJoined={() => setNeedsJoin(false)} />;
  }

  if (!room) return null;

  return (
    <Routes>
      <Route index element={<ParticipantView />} />
      <Route path="host" element={<HostView />} />
      <Route path="stage" element={<StageView />} />
    </Routes>
  );
}
