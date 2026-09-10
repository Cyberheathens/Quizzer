import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Check, X, Timer } from 'lucide-react';
import type { Poll } from '@/types';

interface VotingCardProps {
  poll: Poll;
  selectedOptions: number[];
  onSelectOption: (opts: number[]) => void;
  onVote: () => void;
  hasVoted: boolean;
  results?: { optionIndex: number; count: number }[];
  showResults: boolean;
}

const COLORS = ['#ff8359', '#f3586c', '#e63e7a', '#ffb86b', '#f973a1', '#d83563', '#ff6b9d', '#c22e57'];

export default function VotingCard({
  poll,
  selectedOptions,
  onSelectOption,
  onVote,
  hasVoted,
  results,
  showResults,
}: VotingCardProps) {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [now, setNow] = useState(Date.now());
  const autoSubmitted = useRef(false);
  const isMulti = poll.poll_type === 'multi';

  const deadline = poll.launched_at && poll.timer_seconds
    ? new Date(poll.launched_at).getTime() + poll.timer_seconds * 1000
    : null;
  const remaining = deadline && poll.phase === 'voting_open'
    ? Math.max(0, Math.ceil((deadline - now) / 1000))
    : null;
  const expired = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (poll.phase !== 'voting_open' || !deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [poll.phase, deadline]);

  useEffect(() => {
    if (expired && !hasVoted && selectedOptions.length > 0 && !autoSubmitted.current && onVote) {
      autoSubmitted.current = true;
      onVote();
    }
  }, [expired, hasVoted, selectedOptions.length, onVote]);
  const totalVotes = results?.reduce((sum, r) => sum + r.count, 0) || 0;

  const chartData = poll.options.map((opt, i) => {
    const count = results?.find((r) => r.optionIndex === i)?.count || 0;
    return {
      name: opt.text,
      value: count,
      percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      isCorrect: opt.is_correct,
    };
  });

  const toggleOption = (index: number) => {
    if (hasVoted) return;
    if (isMulti) {
      onSelectOption(
        selectedOptions.includes(index)
          ? selectedOptions.filter((i) => i !== index)
          : [...selectedOptions, index]
      );
    } else {
      onSelectOption([index]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      {/* Question Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-coral/20 text-coral font-medium">
            {poll.poll_type === 'multi' ? 'Multi-Select' : 'Single Choice'}
          </span>
          {poll.phase === 'voting_locked' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber/20 text-amber">
              Closed
            </span>
          )}
        </div>
        <h2 className="text-lg font-bold">{poll.question}</h2>
        {poll.question_image && (
          <img
            src={poll.question_image}
            alt=""
            loading="lazy"
            className="mt-3 w-full max-h-56 object-contain rounded-xl bg-bg-elevated"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {remaining !== null && !expired && (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-sm">
              <Timer className="w-4 h-4 text-amber" />
              <span className={`font-mono font-bold ${remaining <= 5 ? 'text-magenta' : 'text-flame'}`}>
                0:{String(remaining).padStart(2, '0')}
              </span>
              <span className="text-xs text-text-muted">left to vote</span>
            </div>
            <div className="h-1 rounded-full bg-bg-elevated mt-1.5 overflow-hidden">
              <div
                className="h-full bg-ramp-x transition-all duration-500"
                style={{ width: `${Math.min(100, (remaining / (poll.timer_seconds || 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {expired && poll.phase === 'voting_open' && (
          <p className="mt-3 text-xs text-amber">Time's up — waiting for host to reveal</p>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!showResults ? (
          /* Voting Options */
          <motion.div key="voting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-2">
            {poll.options.map((opt, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleOption(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  selectedOptions.includes(i)
                    ? 'bg-coral/20 border border-coral/50 glow-ramp'
                    : 'glass hover:bg-bg-card-hover'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    selectedOptions.includes(i)
                      ? 'bg-ramp text-white'
                      : 'bg-bg-secondary text-text-muted'
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="flex-1 text-sm">{opt.text}</span>
                {selectedOptions.includes(i) && (
                  <Check className="w-4 h-4 text-coral" />
                )}
              </motion.button>
            ))}

            {!hasVoted && (
              <button
                onClick={onVote}
                disabled={selectedOptions.length === 0 || expired}
                className="w-full mt-3 px-4 py-3 rounded-xl bg-ramp-x text-[#14060e] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-ramp"
              >
                Submit Vote
              </button>
            )}
          </motion.div>
        ) : (
          /* Results */
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  chartType === 'bar' ? 'bg-coral/20 text-coral' : 'text-text-muted'
                }`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  chartType === 'pie' ? 'bg-coral/20 text-coral' : 'text-text-muted'
                }`}
              >
                Pie
              </button>
              <span className="ml-auto text-xs text-text-muted">{totalVotes} votes</span>
            </div>

            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={80}
                      tick={{ fill: '#a393a0', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#150d1d', border: '1px solid rgb(255 240 236 / 10%)', borderRadius: 12 }}
                      labelStyle={{ color: '#f1f5f9' }}
                      formatter={(value: any) => [`${value} votes`, '']}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percentage }: any) => `${name} (${percentage}%)`}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Option breakdown */}
            <div className="space-y-1.5">
              {chartData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  {showResults && d.isCorrect && (
                    <Check className="w-4 h-4 text-ok" />
                  )}
                  <span className="font-mono text-text-secondary">{d.percentage}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
