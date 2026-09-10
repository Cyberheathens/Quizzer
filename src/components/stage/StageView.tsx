import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { Zap, Users, CheckCircle2, Cloud, MessageSquare, Trophy, BarChart3, Timer } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { filterStopwords } from '@/lib/stopwords';
import { useParams } from 'react-router-dom';

const COLORS = ['#ff8359', '#f3586c', '#e63e7a', '#ffb86b', '#f973a1', '#d83563', '#ff6b9d', '#c22e57'];

export default function StageView() {
  const { code } = useParams<{ code: string }>();
  const { room, currentPoll, qaPosts, participantCount, quizInfo, voteResults } = useStore();
  const [view, setView] = useState<'poll' | 'qa' | 'cloud' | 'qr' | 'board'>('qr');
  const [board, setBoard] = useState<{ leaderboard: { name: string; score: number }[]; totalQuestions: number; _quizId?: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  const deadline = currentPoll?.launched_at && currentPoll?.timer_seconds
    ? new Date(currentPoll.launched_at).getTime() + currentPoll.timer_seconds * 1000
    : null;
  const remaining = deadline && currentPoll?.phase === 'voting_open'
    ? Math.max(0, Math.ceil((deadline - now) / 1000))
    : null;
  useEffect(() => {
    if (view === 'board' && quizInfo && (!board || board._quizId !== quizInfo.quiz_id)) {
      fetch(`/api/leaderboard?quizId=${quizInfo.quiz_id}`)
        .then((r) => r.json())
        .then((d) => setBoard({ ...d, _quizId: quizInfo.quiz_id }))
        .catch(() => {});
    }
    if (view === 'board' && quizInfo) {
      const t = setInterval(() => {
        fetch(`/api/leaderboard?quizId=${quizInfo.quiz_id}`)
          .then((r) => r.json())
          .then((d) => setBoard({ ...d, _quizId: quizInfo.quiz_id }))
          .catch(() => {});
      }, 5000);
      return () => clearInterval(t);
    }
  }, [view, quizInfo]);

  useEffect(() => {
    if (!deadline || currentPoll?.phase !== 'voting_open') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline, currentPoll?.phase]);

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
    const words = filterStopwords(allText.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
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
          <img src="/logo/logo-mark.svg" alt="Cyberheathens" className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold">{room?.name || 'Live Session'}</h1>
            <p className="text-sm text-text-muted">Powered by <span className="font-bold text-ramp">Engage</span></p>
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
              { key: 'board', label: 'Board', icon: Trophy },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  effectiveView === v.key
                    ? 'bg-coral/30 text-coral'
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
            <Users className="w-5 h-5 text-flame" />
            <span className="text-2xl font-bold">{participantCount}</span>
            <span className="text-sm text-text-muted">connected</span>
          </div>
        </div>
      </motion.header>

      {/* Quiz banner */}
      {quizInfo && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-4 py-3">
          <span className="text-xl font-semibold text-flame">{quizInfo.title}</span>
          <span className="chip">Question {quizInfo.order_index + 1} / {quizInfo.total}</span>
        </motion.div>
      )}

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
<div className="bg-white rounded-3xl p-8 glow-ramp">
                  <QRCodeSVG value={roomUrl} size={280} bgColor="#ffffff" fgColor="#0a0710" />
                </div>

              <h2 className="text-5xl font-bold mb-3">
                Join with code: <span className="text-ramp font-mono tracking-[0.2em]">{code}</span>
              </h2>
              <p className="text-xl text-text-secondary mb-6">
                Scan QR code or visit <span className="font-mono text-flame">{window.location.host}/room/{code}</span>
              </p>

              <div className="flex items-center justify-center gap-3 text-text-muted">
                <Zap className="w-5 h-5 text-coral" />
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
                <span className="text-sm px-3 py-1 rounded-full bg-coral/20 text-coral font-medium">
                  {currentPoll.poll_type === 'multi' ? 'Multi-Select' : 'Single Choice'}
                </span>
                <h2 className="text-4xl font-bold mt-3">{currentPoll.question}</h2>
                {currentPoll.question_image && (
                  <img
                    src={currentPoll.question_image}
                    alt=""
                    className="mt-6 mx-auto max-h-72 object-contain rounded-2xl bg-bg-elevated p-2"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {remaining !== null && remaining > 0 && (
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <Timer className={`w-8 h-8 ${remaining <= 5 ? 'text-magenta' : 'text-flame'}`} />
                    <span className={`text-6xl font-bold font-mono ${remaining <= 5 ? 'text-magenta' : 'text-flame'}`}>
                      0:{String(remaining).padStart(2, '0')}
                    </span>
                  </div>
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
                      <div className="w-12 h-12 rounded-xl bg-ramp-x text-[#14060e] flex items-center justify-center text-xl font-bold font-display mx-auto mb-3">
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
                      <XAxis dataKey="name" tick={{ fill: '#a393a0', fontSize: 16 }} />
                      <YAxis tick={{ fill: '#a393a0', fontSize: 14 }} />
                      <Tooltip
                        contentStyle={{ background: '#150d1d', border: '1px solid rgb(255 240 236 / 10%)', borderRadius: 12, fontSize: 14 }}
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
                          {d.isCorrect && <CheckCircle2 className="w-5 h-5 text-ok" />}
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
                  className="glass-strong rounded-3xl p-10 text-center glow-ramp"
                >
                  <div className="inline-flex p-4 rounded-2xl bg-ok/10 mb-4">
                    <MessageSquare className="w-10 h-10 text-ok" />
                  </div>
                  <p className="text-xs text-ok font-medium mb-2">NOW ANSWERING</p>
                  <h2 className="text-3xl font-bold mb-3">{answeringPost.content}</h2>
                  <p className="text-text-secondary">— {answeringPost.is_anonymous ? 'Anonymous' : answeringPost.display_name}</p>
                </motion.div>
              ) : pinnedPost ? (
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className="glass-strong rounded-3xl p-10 text-center glow-ramp"
                >
                  <div className="inline-flex p-4 rounded-2xl bg-flame/10 mb-4">
                    <Trophy className="w-10 h-10 text-flame" />
                  </div>
                  <p className="text-xs text-flame font-medium mb-2">PINNED QUESTION</p>
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
                    const colors = ['text-coral', 'text-flame', 'text-magenta', 'text-ok', 'text-amber'];
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

          {view === 'board' && (
            <motion.div key="board" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-2xl">
              <Trophy className="w-14 h-14 text-amber mx-auto mb-4" />
              <h2 className="text-4xl font-bold text-center mb-8">Leaderboard</h2>
              {board && board.leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {board.leaderboard.slice(0, 10).map((row, i) => (
                    <motion.div
                      key={row.name + i}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.06 }}
                      className={`panel rounded-xl px-6 py-3 flex items-center justify-between ${i === 0 ? 'border-flame/60' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`text-xl font-bold font-mono w-8 ${i === 0 ? 'text-flame' : i === 1 ? 'text-text-secondary' : i === 2 ? 'text-amber' : 'text-text-muted'}`}>
                          {i + 1}
                        </span>
                        <span className="text-lg font-semibold">{row.name}</span>
                      </div>
                      <span className={`text-2xl font-bold font-mono ${i === 0 ? 'text-ramp' : 'text-text-secondary'}`}>{row.score}/{board.totalQuestions}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-text-secondary text-xl">No scores yet — finish a question first</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <footer className="flex items-center justify-between px-8 py-3 glass-strong">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Zap className="w-4 h-4 text-coral" />
          <span>Real-time sync active</span>
          <div className="w-2 h-2 rounded-full bg-ok animate-pulse-glow" />
        </div>
        <div className="text-sm text-text-muted">
          Made by <span className="font-bold text-ramp">Cyberheathens</span> — IISER Bhopal
        </div>
      </footer>
    </div>
  );
}
