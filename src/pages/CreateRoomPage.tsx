import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Copy, Check, ExternalLink } from 'lucide-react';
import { createRoom } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [hostName, setHostName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{ code: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!roomName.trim() || !hostName.trim()) {
      toast.error('Fill in room name and your name');
      return;
    }
    setIsCreating(true);
    try {
      const room = await createRoom({
        name: roomName.trim(),
        hostName: hostName.trim(),
        passcode: passcode.trim() || undefined,
      });
      setCreatedRoom({ code: room.code, name: room.name });
      toast.success('Room created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const copyCode = () => {
    if (createdRoom) {
      navigator.clipboard.writeText(createdRoom.code);
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const roomUrl = createdRoom ? `${window.location.origin}/room/${createdRoom.code}` : '';

  if (createdRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-strong rounded-3xl p-8 max-w-md w-full text-center"
        >
          <div className="inline-flex p-4 rounded-2xl bg-accent-green/10 mb-4">
            <Check className="w-8 h-8 text-accent-green" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Room Ready!</h2>
          <p className="text-text-secondary mb-6">{createdRoom.name}</p>

          <div className="bg-white rounded-2xl p-4 inline-block mb-4">
            <QRCodeSVG value={roomUrl} size={180} bgColor="#ffffff" fgColor="#0a0a0f" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-4xl font-mono font-bold tracking-[0.3em] text-gradient">
              {createdRoom.code}
            </span>
            <button onClick={copyCode} className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
              {copied ? <Check className="w-5 h-5 text-accent-green" /> : <Copy className="w-5 h-5 text-text-muted" />}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-3 rounded-xl glass hover:bg-bg-card-hover transition-all text-sm"
            >
              Back
            </button>
            <button
              onClick={() => navigate(`/room/${createdRoom.code}/host`)}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all glow-purple"
            >
              Open Console <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        <p className="mt-6 text-text-muted text-sm">
          Made by <span className="font-bold text-gradient">CyberHeathens</span>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <motion.button
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 p-2 rounded-lg glass hover:bg-bg-card-hover transition-all"
      >
        <ArrowLeft className="w-5 h-5" />
      </motion.button>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong rounded-3xl p-8 max-w-md w-full"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Create a Room</h2>
            <p className="text-sm text-text-muted">Set up your live session</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Room Name</label>
            <input
              type="text"
              placeholder="e.g. CS101 Lecture Poll"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass-strong text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Your Name (Host)</label>
            <input
              type="text"
              placeholder="e.g. Prof. Smith"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass-strong text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Passcode <span className="text-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Optional room passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass-strong text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple/50 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={isCreating || !roomName.trim() || !hostName.trim()}
          className="w-full mt-6 px-6 py-3.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-purple"
        >
          {isCreating ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Create Room'
          )}
        </button>
      </motion.div>

      <p className="mt-6 text-text-muted text-sm">
        Made by <span className="font-bold text-gradient">CyberHeathens</span>
      </p>
    </div>
  );
}
