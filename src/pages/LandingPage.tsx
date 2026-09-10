import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Users, BarChart3, MessageSquare, ArrowRight, Sparkles, QrCode } from 'lucide-react';
import { getRoom } from '@/lib/api';
import toast from 'react-hot-toast';

export default function LandingPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (code.length !== 6) {
      toast.error('Enter a 6-digit room code');
      return;
    }
    setIsJoining(true);
    try {
      await getRoom(code.toUpperCase());
      navigate(`/room/${code.toUpperCase()}`);
    } catch {
      toast.error('Room not found');
    } finally {
      setIsJoining(false);
    }
  };

  const features = [
    { icon: BarChart3, label: 'Live Polling', desc: 'Real-time voting with instant results', color: 'text-accent-purple' },
    { icon: MessageSquare, label: 'Q&A Text Wall', desc: 'Audience questions with upvoting', color: 'text-accent-cyan' },
    { icon: Users, label: 'Zero Signup', desc: 'Join instantly with 6-digit code', color: 'text-accent-pink' },
    { icon: Zap, label: 'Sub-150ms Sync', desc: 'Lightning-fast real-time updates', color: 'text-accent-green' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-6 py-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">Engage</span>
        </div>
        <button
          onClick={() => navigate('/create')}
          className="px-4 py-2 rounded-lg glass hover:bg-accent-purple/20 transition-all text-sm font-medium"
        >
          Host a Room
        </button>
      </motion.header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6 text-sm text-accent-cyan"
          >
            <Sparkles className="w-4 h-4" />
            Real-time audience engagement
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
          >
            Make Every Voice{' '}
            <span className="text-gradient">Count</span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-xl text-text-secondary mb-10 max-w-xl mx-auto"
          >
            Interactive polls, live Q&A, and word clouds — no signups, no downloads.
            Just scan, join, and engage.
          </motion.p>

          {/* Join Box */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <div className="relative flex-1">
              <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl glass-strong text-center text-2xl font-mono tracking-[0.3em] text-text-primary placeholder:text-text-muted placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-accent-purple/50 transition-all"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={isJoining || code.length !== 6}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-purple"
            >
              {isJoining ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Join <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full px-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="glass rounded-2xl p-5 text-center hover:bg-bg-card-hover transition-all group cursor-default"
            >
              <div className={`inline-flex p-3 rounded-xl bg-bg-secondary mb-3 ${f.color} group-hover:scale-110 transition-transform`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{f.label}</h3>
              <p className="text-xs text-text-muted">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-text-muted text-sm">
        <div className="flex items-center justify-center gap-2">
          <span>Made with</span>
          <span className="text-accent-pink animate-pulse-glow">⚡</span>
          <span>by</span>
          <span className="font-bold text-gradient">CyberHeathens</span>
        </div>
        <p className="text-xs mt-1 opacity-60">IISER Bhopal Coding Club</p>
      </footer>
    </div>
  );
}
