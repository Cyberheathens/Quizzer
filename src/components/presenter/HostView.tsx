import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Play, Lock, Unlock, Eye, EyeOff, Pin, CheckCircle2, MessageSquare,
  BarChart3, Users, Settings, Trash2, ArrowLeft, Monitor, Copy, Check,
  Zap, Timer, XCircle,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { createPoll, updatePollPhase, updateQAPost } from '@/lib/api';
import toast from 'react-hot-toast';

type HostTab = 'polls' | 'qa' | 'settings';

export default function HostView() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { room, polls, currentPoll, qaPosts, participantCount } = useStore();
  const [activeTab, setActiveTab] = useState<HostTab>('polls');
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [copied, setCopied] = useState(false);

  // Poll creation state
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [pollType, setPollType] = useState<'single' | 'multi'>('single');
  const [timer, setTimer] = useState<number | null>(null);

  const roomUrl = `${window.location.origin}/room/${code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreatePoll = async () => {
    if (!question.trim() || options.filter((o) => o.text.trim()).length < 2 || !room) {
      toast.error('Need a question and at least 2 options');
      return;
    }
    try {
      await createPoll({
        roomId: room.id,
        question: question.trim(),
        pollType,
        options: options.filter((o) => o.text.trim()),
        timerSeconds: timer || undefined,
      });
      setQuestion('');
      setOptions([{ text: '', isCorrect: false }, { text: '', isCorrect: false }]);
      setShowCreatePoll(false);
      toast.success('Poll created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create poll');
    }
  };

  const handlePhaseChange = async (pollId: string, phase: string) => {
    try {
      await updatePollPhase(pollId, phase);
      toast.success(phase === 'voting_locked' ? 'Voting closed' : 'Results shown');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleQAAction = async (postId: string, action: 'pin' | 'answering' | 'answered' | 'hide') => {
    try {
      await updateQAPost({ postId, action });
    } catch {
      toast.error('Failed');
    }
  };

  const tabs: { key: HostTab; label: string; icon: any; count?: number }[] = [
    { key: 'polls', label: 'Polls', icon: BarChart3, count: polls.length },
    { key: 'qa', label: 'Q&A', icon: MessageSquare, count: qaPosts.length },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong sticky top-0 z-20 px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-bold text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-accent-purple" />
                Host Console
              </h1>
              <p className="text-xs text-text-muted">{room?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-secondary text-xs">
              <Users className="w-3 h-3 text-accent-cyan" />
              <span className="font-bold">{participantCount}</span>
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-secondary text-xs hover:bg-bg-card-hover transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-accent-green" /> : <Copy className="w-3 h-3" />}
              <span className="font-mono">{code}</span>
            </button>
            <button
              onClick={() => window.open(`/room/${code}/stage`, '_blank')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-purple/20 text-accent-purple text-xs font-medium hover:bg-accent-purple/30 transition-colors"
            >
              <Monitor className="w-3 h-3" />
              Stage
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-bg-secondary text-[10px]">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </motion.header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'polls' && (
            <motion.div key="polls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Polls</h2>
                <button
                  onClick={() => setShowCreatePoll(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-sm font-medium hover:opacity-90 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Poll
                </button>
              </div>

              {/* Create Poll Form */}
              <AnimatePresence>
                {showCreatePoll && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="glass rounded-2xl p-5">
                      <h3 className="font-bold mb-3">Create Poll</h3>

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setPollType('single')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            pollType === 'single' ? 'bg-accent-purple/20 text-accent-purple' : 'bg-bg-secondary text-text-muted'
                          }`}
                        >
                          Single Choice
                        </button>
                        <button
                          onClick={() => setPollType('multi')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            pollType === 'multi' ? 'bg-accent-purple/20 text-accent-purple' : 'bg-bg-secondary text-text-muted'
                          }`}
                        >
                          Multi-Select
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Your question..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-bg-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-purple/50 mb-3 transition-all"
                      />

                      <div className="space-y-2 mb-3">
                        {options.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              placeholder={`Option ${i + 1}`}
                              value={opt.text}
                              onChange={(e) => {
                                const newOpts = [...options];
                                newOpts[i].text = e.target.value;
                                setOptions(newOpts);
                              }}
                              className="flex-1 px-3 py-2 rounded-lg bg-bg-primary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-purple/50 transition-all"
                            />
                            <button
                              onClick={() => {
                                const newOpts = [...options];
                                newOpts[i].isCorrect = !newOpts[i].isCorrect;
                                setOptions(newOpts);
                              }}
                              className={`p-2 rounded-lg transition-all ${
                                opt.isCorrect ? 'bg-accent-green/20 text-accent-green' : 'bg-bg-secondary text-text-muted'
                              }`}
                              title="Mark as correct answer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            {options.length > 2 && (
                              <button
                                onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                                className="p-2 rounded-lg bg-bg-secondary text-text-muted hover:text-accent-red transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {options.length < 8 && (
                          <button
                            onClick={() => setOptions([...options, { text: '', isCorrect: false }])}
                            className="w-full py-2 rounded-lg border border-dashed border-border text-text-muted text-sm hover:border-accent-purple/50 transition-all"
                          >
                            + Add Option
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <Timer className="w-4 h-4 text-text-muted" />
                        <select
                          value={timer || ''}
                          onChange={(e) => setTimer(e.target.value ? Number(e.target.value) : null)}
                          className="px-3 py-1.5 rounded-lg bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent-purple/50"
                        >
                          <option value="">No timer</option>
                          <option value="10">10 seconds</option>
                          <option value="20">20 seconds</option>
                          <option value="30">30 seconds</option>
                          <option value="60">60 seconds</option>
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowCreatePoll(false)}
                          className="flex-1 px-4 py-2 rounded-xl glass text-sm hover:bg-bg-card-hover transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreatePoll}
                          className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-sm font-semibold hover:opacity-90 transition-all"
                        >
                          Create Poll
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Poll List */}
              <div className="space-y-3">
                {polls.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-10 h-10 text-text-muted mx-auto mb-2" />
                    <p className="text-text-secondary text-sm">No polls yet</p>
                    <p className="text-xs text-text-muted">Create your first poll to get started</p>
                  </div>
                ) : (
                  polls.map((poll) => (
                    <motion.div
                      key={poll.id}
                      layout
                      className="glass rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple">
                            {poll.phase === 'voting_open' ? 'Voting Open' : poll.phase === 'voting_locked' ? 'Locked' : 'Results Shown'}
                          </span>
                          <h3 className="font-semibold mt-1">{poll.question}</h3>
                        </div>
                      </div>

                      <div className="flex gap-1.5 mt-3">
                        {poll.phase === 'voting_open' && (
                          <button
                            onClick={() => handlePhaseChange(poll.id, 'voting_locked')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-orange/20 text-accent-orange text-xs font-medium hover:bg-accent-orange/30 transition-all"
                          >
                            <Lock className="w-3 h-3" />
                            Close Voting
                          </button>
                        )}
                        {poll.phase === 'voting_locked' && (
                          <button
                            onClick={() => handlePhaseChange(poll.id, 'results_shown')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-green/20 text-accent-green text-xs font-medium hover:bg-accent-green/30 transition-all"
                          >
                            <Eye className="w-3 h-3" />
                            Show Results
                          </button>
                        )}
                        {poll.phase === 'results_shown' && (
                          <span className="text-xs text-text-muted">Results displayed</span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'qa' && (
            <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-bold mb-4">Q&A Moderation</h2>
              <div className="space-y-2">
                {qaPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-2" />
                    <p className="text-text-secondary text-sm">No questions yet</p>
                  </div>
                ) : (
                  qaPosts.map((post) => (
                    <div
                      key={post.id}
                      className={`glass rounded-xl p-3 ${post.is_hidden ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm">{post.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-text-muted">
                              {post.is_anonymous ? 'Anonymous' : post.display_name}
                            </span>
                            <span className="text-xs text-text-muted">▲ {post.upvotes}</span>
                            {post.is_pinned && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-yellow/20 text-accent-yellow">Pinned</span>}
                            {post.is_answering && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green">Answering</span>}
                            {post.is_answered && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-cyan/20 text-accent-cyan">Answered</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {!post.is_pinned && (
                            <button onClick={() => handleQAAction(post.id, 'pin')} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-accent-yellow transition-all" title="Pin">
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!post.is_answering && !post.is_answered && (
                            <button onClick={() => handleQAAction(post.id, 'answering')} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-accent-green transition-all" title="Mark as Answering">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!post.is_answered && (
                            <button onClick={() => handleQAAction(post.id, 'answered')} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-accent-cyan transition-all" title="Mark as Answered">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleQAAction(post.id, 'hide')} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-accent-red transition-all" title="Hide">
                            {post.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-bold mb-4">Room Settings</h2>
              <div className="glass rounded-2xl p-5 space-y-4">
                <div>
                  <label className="text-sm text-text-secondary">Room Code</label>
                  <p className="font-mono text-xl font-bold text-gradient">{code}</p>
                </div>
                <div>
                  <label className="text-sm text-text-secondary">Room URL</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-bg-primary text-xs text-text-muted truncate font-mono">{roomUrl}</code>
                    <button onClick={copyLink} className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-card-hover transition-all">
                      {copied ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4 text-text-muted" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-text-secondary">QR Code</label>
                  <p className="text-xs text-text-muted mt-1">Open Stage View to display QR code for audience</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-text-muted text-xs glass border-t border-border">
        Made by <span className="font-bold text-gradient">CyberHeathens</span>
      </footer>
    </div>
  );
}
