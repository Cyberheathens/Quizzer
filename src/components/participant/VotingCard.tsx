import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Check, X } from 'lucide-react';
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

const COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'];

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
  const isMulti = poll.poll_type === 'multi';
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple font-medium">
            {poll.poll_type === 'multi' ? 'Multi-Select' : 'Single Choice'}
          </span>
          {poll.phase === 'voting_locked' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-orange/20 text-accent-orange">
              Closed
            </span>
          )}
        </div>
        <h2 className="text-lg font-bold">{poll.question}</h2>
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
                    ? 'bg-accent-purple/20 border border-accent-purple/50 glow-purple'
                    : 'glass hover:bg-bg-card-hover'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    selectedOptions.includes(i)
                      ? 'bg-accent-purple text-white'
                      : 'bg-bg-secondary text-text-muted'
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="flex-1 text-sm">{opt.text}</span>
                {selectedOptions.includes(i) && (
                  <Check className="w-4 h-4 text-accent-purple" />
                )}
              </motion.button>
            ))}

            {!hasVoted && (
              <button
                onClick={onVote}
                disabled={selectedOptions.length === 0}
                className="w-full mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-purple"
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
                  chartType === 'bar' ? 'bg-accent-purple/20 text-accent-purple' : 'text-text-muted'
                }`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  chartType === 'pie' ? 'bg-accent-purple/20 text-accent-purple' : 'text-text-muted'
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
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 12 }}
                      labelStyle={{ color: '#f1f5f9' }}
                      formatter={(value: number) => [`${value} votes`, '']}
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
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
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
                    <Check className="w-4 h-4 text-accent-green" />
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
