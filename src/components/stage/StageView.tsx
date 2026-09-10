import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { Zap, Users, CheckCircle2, Cloud, MessageSquare, Trophy, BarChart3 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useParams } from 'react-router-dom';

const COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'];

export default function StageView() {
  const { code } = useParams<{ code: string }>();
  const { room, currentPoll, qaPosts, participantCount, voteResults } = useStore();
  const [view, setView] = useState<'poll' | 'qa' | 'cloud' | 'qr'>('qr');

  const results = currentPoll ? voteResults[currentPoll.id] : undefined;
  const totalVotes = results?.reduce((sum, r) => sum + r.count, 0) || 0;

  const chartData = currentPoll?.options.map((opt, i) => {
    const count = results?.find((r) => r.optionIndex === i)?.count || 0;
    return {
      name: opt.text,
      value: count,
      percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      isCorrect: opt.is_correct,
    };
  }) || [];

  const pinnedPost = qaPosts.find((p) => p.is_pinned && !p.is_hidden);
  const answeringPost = qaPosts.find((p) => p.is_answering && !p.is_hidden);

  const wordCloudData = useMemo(() => {
    const allText = qaPosts.map((p) => p.content).join(' ');
    const words = allText.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const freq: Record<string, number> = {};
    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word, count]) => ({ word, count }));
  }, [qaPosts]);

  const roomUrl = `${window.location.origin}/room/${code}`;

  // Auto-switch to poll view when there's an active poll
  const effectiveView = currentPoll && currentPoll.phase !== 'results_shown' && view === 'qr' ? 'poll' : view;

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Top Bar */}
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-8 py-4 glass-strong"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{room?.name || 'Live Session'}</h1>
            <p className="text-sm text-text-muted">Powered by <span className="font-bold text-gradient">Engage</span></p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex gap-1 glass rounded-xl p-1">
            {[
              { key: 'qr', label: 'QR', icon: null },
              { key: 'poll', label: 'Poll', icon: BarChart3 },
              { key: 'qa', label: 'Q&A', icon: MessageSquare },
              { key: 'cloud', label: 'Cloud', icon: Cloud },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  effectiveView === v.key
                    ? 'bg-accent-purple/30 text-accent-purple'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {v.icon && <v.icon className="w-4 h-4" />}
                {!v.icon && <span className="text-lg">⬡</span>}
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl">
            <Users className="w-5 h-5 text-accent-cyan" />
            <span className="text-2xl font-bold">{participantCount}</span>
            <span className="text-sm text-text-muted">connected</span>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {effectiveView === 'qr' && (
            <motion.div
              key="qr"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="inline-block mb-6"
              >
                <div className="bg-white rounded-3xl p-8 glow-purple">
                  <QRCodeSVG value={roomUrl} size={280} bgColor="#ffffff" fgColor="#0a0a0f" />
                </div>
              </motion.div>

              <h2 className="text-5xl font-bold mb-3">
                Join with code: <span className="text-gradient font-mono tracking-[0.2em]">{code}</span>
              </h2>
              <p className="text-xl text-text-secondary mb-6">
                Scan QR code or visit <span className="font-mono text-accent-cyan">{window.location.host}/room/{code}</span>
              </p>

              <div className="flex items-center justify-center gap-3 text-text-muted">
                <Zap className="w-5 h-5 text-accent-purple" />
                <span>No signup required — instant access</span>
              </div>
            </motion.div>
          )}

          {effectiveView === 'poll' && currentPoll && (
            <motion.div
              key="poll"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl"
            >
              <div className="text-center mb-8">
                <span className="text-sm px-3 py-1 rounded-full bg-accent-purple/20 text-accent-purple font-medium">
                  {currentPoll.poll_type === 'multi' ? 'Multi-Select' : 'Single Choice'}
                </span>
                <h2 className="text-4xl font-bold mt-3">{currentPoll.question}</h2>
                {totalVotes > 0 && (
                  <p className="text-lg text-text-secondary mt-2">{totalVotes} votes</p>
                )}
              </div>

              {currentPoll.phase === 'voting_open' ? (
                <div className="grid grid-cols-2 gap-4">
                  {currentPoll.options.map((opt, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="glass rounded-2xl p-6 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center text-xl font-bold mx-auto mb-3">
                        {String.fromCharCode(65 + i)}
                      </div>
                      <p className="text-xl font-medium">{opt.text}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="glass rounded-2xl p-8">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 16 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 14 }} />
                      <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 12, fontSize: 14 }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={COLORS[i % COLORS.length]}
                            opacity={currentPoll.phase === 'results_shown' && entry.isCorrect ? 1 : 0.8}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {currentPoll.phase === 'results_shown' && (
                    <div className="flex justify-center gap-6 mt-4">
                      {chartData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-sm">{d.name}</span>
                          {d.isCorrect && <CheckCircle2 className="w-5 h-5 text-accent-green" />}
                          <span className="font-mono font-bold">{d.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {effectiveView === 'qa' && (
            <motion.div
              key="qa"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-3xl"
            >
              {answeringPost ? (
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className="glass-strong rounded-3xl p-10 text-center glow-green"
                >
                  <div className="inline-flex p-4 rounded-2xl bg-accent-green/10 mb-4">
                    <MessageSquare className="w-10 h-10 text-accent-green" />
                  </div>
                  <p className="text-xs text-accent-green font-medium mb-2">NOW ANSWERING</p>
                  <h2 className="text-3xl font-bold mb-3">{answeringPost.content}</h2>
                  <p className="text-text-secondary">— {answeringPost.is_anonymous ? 'Anonymous' : answeringPost.display_name}</p>
                </motion.div>
              ) : pinnedPost ? (
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className="glass-strong rounded-3xl p-10 text-center glow-purple"
                >
                  <div className="inline-flex p-4 rounded-2xl bg-accent-yellow/10 mb-4">
                    <Trophy className="w-10 h-10 text-accent-yellow" />
                  </div>
                  <p className="text-xs text-accent-yellow font-medium mb-2">PINNED QUESTION</p>
                  <h2 className="text-3xl font-bold mb-3">{pinnedPost.content}</h2>
                  <p className="text-text-secondary">— {pinnedPost.is_anonymous ? 'Anonymous' : pinnedPost.display_name}</p>
                </motion.div>
              ) : (
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-text-muted mx-auto mb-4" />
                  <h2 className="text-3xl font-bold mb-2">Live Q&A</h2>
                  <p className="text-xl text-text-secondary">Questions from the audience will appear here</p>
                </div>
              )}
            </motion.div>
          )}

          {effectiveView === 'cloud' && (
            <motion.div
              key="cloud"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl"
            >
              {wordCloudData.length > 0 ? (
                <div className="glass rounded-3xl p-12 min-h-[400px] flex flex-wrap items-center justify-center gap-4">
                  {wordCloudData.map(({ word, count }, i) => {
                    const maxCount = wordCloudData[0].count;
                    const size = 1 + (count / maxCount) * 3.5;
                    const colors = ['text-accent-purple', 'text-accent-cyan', 'text-accent-pink', 'text-accent-green', 'text-accent-orange'];
                    return (
                      <motion.span
                        key={word}
                        initial={{ scale: 0, rotate: Math.random() * 20 - 10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: i * 0.03, type: 'spring' }}
                        className={`${colors[i % colors.length]} font-bold`}
                        style={{ fontSize: `${size}rem` }}
                      >
                        {word}
                      </motion.span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center">
                  <Cloud className="w-16 h-16 text-text-muted mx-auto mb-4" />
                  <h2 className="text-3xl font-bold mb-2">Word Cloud</h2>
                  <p className="text-xl text-text-secondary">Words from audience questions will form here</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <footer className="flex items-center justify-between px-8 py-3 glass-strong">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Zap className="w-4 h-4 text-accent-purple" />
          <span>Real-time sync active</span>
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-glow" />
        </div>
        <div className="text-sm text-text-muted">
          Made by <span className="font-bold text-gradient">CyberHeathens</span> — IISER Bhopal
        </div>
      </footer>
    </div>
  );
}
