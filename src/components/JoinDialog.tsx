import { useState } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { joinRoom } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { setDisplayName as saveDisplayName } from '@/lib/utils';
import toast from 'react-hot-toast';

interface JoinDialogProps {
  roomCode: string;
  onJoined: () => void;
}

export default function JoinDialog({ roomCode, onJoined }: JoinDialogProps) {
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { sessionId, setDisplayName } = useStore();

  const handleJoin = async () => {
    if (!name.trim()) {
      toast.error('Enter your name');
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom({
        code: roomCode,
        passcode: roomCode.toUpperCase(),
        sessionId,
        displayName: name.trim(),
      });
      saveDisplayName(name.trim());
      setDisplayName(name.trim());
      localStorage.setItem(`room_${roomCode}_joined`, 'true');
      toast.success('Joined!');
      onJoined();
    } catch (err: any) {
      toast.error(err.message || 'Failed to join');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-strong rounded-3xl p-8 max-w-sm w-full text-center"
      >
        <img src="/logo/logo-mark.svg" alt="Cyberheathens" className="w-10 h-10 mb-4" />
        <h2 className="text-2xl font-bold mb-1">Join Room</h2>
        <p className="text-text-muted text-sm mb-1">Room password</p>
        <p className="text-ramp text-lg tracking-[0.2em] font-mono font-bold mb-6">{roomCode}</p>

        <div className="space-y-3 text-left">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Display Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-strong text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-coral/50 transition-all"
                autoFocus
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={isJoining || !name.trim()}
          className="w-full mt-6 px-6 py-3.5 rounded-xl bg-ramp-x text-[#14060e] font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-ramp"
        >
          {isJoining ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Join Now'
          )}
        </button>

        <p className="mt-4 text-xs text-text-muted">
          No signup required — just join and engage
        </p>
      </motion.div>
    </div>
  );
}
