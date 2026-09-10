import { useEffect, useState } from 'react';
import { useParams, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getRoom, getPolls, getQAPosts } from '@/lib/api';
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
  const { room, setRoom, setPolls, setQAPosts, addPoll, updatePoll, addQAPost, updateQAPost, setParticipantCount, setConnected } = useStore();
  const [loading, setLoading] = useState(true);
  const [needsJoin, setNeedsJoin] = useState(false);

  useEffect(() => {
    if (!code) return;

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

        const isHost = localStorage.getItem(`room_${code}_host`) === 'true';
        if (!isHost) {
          const joined = localStorage.getItem(`room_${code}_joined`);
          if (!joined) {
            setNeedsJoin(true);
          }
        }
      } catch {
        toast.error('Room not found');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadRoom();

    const channel = subscribeToRoom(code);
    channel.bind('poll:new', (data: any) => addPoll(data));
    channel.bind('poll:update', (data: any) => updatePoll(data));
    channel.bind('qa:new', (data: any) => addQAPost(data));
    channel.bind('qa:update', (data: any) => updateQAPost(data));
    channel.bind('participants', (data: any) => setParticipantCount(data.count));
    channel.bind('room:ended', () => {
      toast('Room has ended');
      navigate('/');
    });

    setConnected(true);

    return () => {
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
