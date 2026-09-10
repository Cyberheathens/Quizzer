import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Play, Eye, EyeOff, Pin, CheckCircle2, MessageSquare,
  BarChart3, Users, Settings, Trash2, ArrowLeft, Monitor, Copy, Check,
  Timer, XCircle, ImageIcon, Rocket, Lock, Pencil, DoorOpen, DoorClosed,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { createPoll, updatePollPhase, updateQAPost, launchPoll, updateDraftPoll, deletePoll, roomAction } from '@/lib/api';
import toast from 'react-hot-toast';

type HostTab = 'polls' | 'qa' | 'settings';

interface DraftForm {
  id: string | null;
  question: string;
  imageUrl: string;
  options: { text: string; isCorrect: boolean }[];
  pollType: 'single' | 'multi';
  timer: number | null;
}

const EMPTY_FORM: DraftForm = {
  id: null,
  question: '',
  imageUrl: '',
  options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
  pollType: 'single',
  timer: null,
};

export default function HostView() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { room, setRoom, polls, qaPosts, participantCount } = useStore();
  const [activeTab, setActiveTab] = useState<HostTab>('polls');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const drafts = polls.filter((p) => p.phase === 'draft');
  const live = polls.filter((p) => p.phase !== 'draft');
  const roomClosed = room?.status !== 'open';

  const roomUrl = `${window.location.origin}/room/${code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const formValid = () => !!(form.question.trim() && form.options.filter((o) => o.text.trim()).length >= 2);

  const buildPayload = (launch: boolean) => ({
    roomId: room!.id,
    question: form.question.trim(),
    pollType: form.pollType,
    options: form.options.filter((o) => o.text.trim()),
    timerSeconds: form.timer || undefined,
    questionImage: form.imageUrl.trim() || undefined,
    launch,
  });

  const handleSaveDraft = async () => {
    if (!room) return;
    setSaving(true);
    try {
      if (form.id) {
        await updateDraftPoll({
          pollId: form.id,
          question: form.question.trim(),
          options: form.options.filter((o) => o.text.trim()),
          questionImage: form.imageUrl.trim() || null,
          timerSeconds: form.timer,
        });
        toast.success('Draft updated');
      } else {
        await createPoll(buildPayload(false));
        toast.success('Saved as draft — launch when ready');
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunchNow = async () => {
    if (!room) return;
    setSaving(true);
    try {
      if (form.id) {
        await updateDraftPoll({
          pollId: form.id,
          question: form.question.trim(),
          options: form.options.filter((o) => o.text.trim()),
          questionImage: form.imageUrl.trim() || null,
          timerSeconds: form.timer,
        });
        await launchPoll(form.id);
      } else {
        await createPoll(buildPayload(true));
      }
      toast.success('Poll is LIVE!');
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to launch');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
  };

  const handleLaunchDraft = async (pollId: string) => {
    try {
      await launchPoll(pollId);
      toast.success('Poll is LIVE!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to launch');
    }
  };

  const handleDeleteDraft = async (pollId: string) => {
    try {
      await deletePoll(pollId);
      toast.success('Draft deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleEditDraft = (pollId: string) => {
    const d = polls.find((p) => p.id === pollId);
    if (!d) return;
    setForm({
      id: d.id,
      question: d.question,
      imageUrl: d.question_image || '',
      options: d.options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
      pollType: d.poll_type === 'multi' ? 'multi' : 'single',
      timer: d.timer_seconds,
    });
    setShowForm(true);
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

  const handleOpenRoom = async () => {
    if (!code) return;
    try {
      const r = await roomAction(code, 'open');
      setRoom(r);
      toast.success('Room is OPEN — share the code!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to open');
    }
  };

  const handleEndRoom = async () => {
    if (!code) return;
    if (!window.confirm('End the room? Everyone will be kicked out.')) return;
    try {
      await roomAction(code, 'end');
      toast('Room ended');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  const tabs: { key: HostTab; label: string; icon: any; count?: number }[] = [
    { key: 'polls', label: 'Polls', icon: BarChart3, count: live.length },
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
            <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-bg-card transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-bold text-sm flex items-center gap-2">
                Host Console
                {roomClosed ? (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary">
                    <DoorClosed className="w-3 h-3" /> Closed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-ok/15 text-ok">
                    <DoorOpen className="w-3 h-3" /> Open
                  </span>
                )}
              </h1>
              <p className="text-xs text-text-muted">{room?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-elevated text-xs">
              <Users className="w-3 h-3 text-flame" />
              <span className="font-bold">{participantCount}</span>
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-elevated text-xs hover:bg-bg-card transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
              <span className="font-mono">{code}</span>
            </button>
            <button
              onClick={() => window.open(`/room/${code}/stage`, '_blank')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-coral/20 text-coral text-xs font-medium hover:bg-coral/30 transition-colors"
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
                  ? 'bg-coral/20 text-coral'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-bg-elevated text-[10px]">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </motion.header>

      {/* Closed-room banner */}
      {roomClosed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 pt-3"
        >
          <div className="glass rounded-xl p-4 flex items-center justify-between gap-3 border-flame/40">
            <div className="flex items-start gap-3">
              <DoorClosed className="w-5 h-5 text-flame mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Room is closed</p>
                <p className="text-xs text-text-secondary">Prepare your quiz now — participants can't join until you open.</p>
              </div>
            </div>
            <button
              onClick={handleOpenRoom}
              className="btn-solid px-4 py-2.5 text-sm shrink-0"
            >
              <DoorOpen className="w-4 h-4" />
              Open Room
            </button>
          </div>
        </motion.div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'polls' && (
            <motion.div key="polls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Polls</h2>
                <button
                  onClick={() => { setForm(EMPTY_FORM); setShowForm(!showForm); }}
                  className="btn-solid px-4 py-2.5 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Poll
                </button>
              </div>

              {/* Create/Edit Form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="glass rounded-2xl p-5">
                      <h3 className="font-bold mb-3">{form.id ? 'Edit Draft' : 'Create Poll'}</h3>

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setForm({ ...form, pollType: 'single' })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            form.pollType === 'single' ? 'bg-coral/20 text-coral' : 'bg-bg-elevated text-text-muted'
                          }`}
                        >
                          Single Choice
                        </button>
                        <button
                          onClick={() => setForm({ ...form, pollType: 'multi' })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            form.pollType === 'multi' ? 'bg-coral/20 text-coral' : 'bg-bg-elevated text-text-muted'
                          }`}
                        >
                          Multi-Select
                        </button>
                      </div>

                      <textarea
                        placeholder="Your question..."
                        value={form.question}
                        onChange={(e) => setForm({ ...form, question: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-bg-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-coral/50 mb-3 resize-none transition-all"
                      />

                      {/* Image / GIF URL */}
                      <div className="mb-3">
                        <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-1.5">
                          <ImageIcon className="w-3.5 h-3.5" />
                          Image or GIF URL <span className="text-text-muted">(optional — Giphy direct link works)</span>
                        </label>
                        <input
                          type="url"
                          placeholder="https://media.giphy.com/media/.../giphy.gif"
                          value={form.imageUrl}
                          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-bg-primary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-coral/50 transition-all font-mono"
                        />
                        {form.imageUrl.trim() && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-border bg-bg-elevated flex items-center justify-center p-2">
                            <img
                              src={form.imageUrl}
                              alt="preview"
                              className="max-h-40 object-contain rounded-lg"
                              onError={(e) => {
                                (e.target as HTMLImageElement).parentElement!.innerHTML =
                                  '<span class="text-xs text-muted-foreground p-4">Could not load that URL — check the link</span>';
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 mb-3">
                        {form.options.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              placeholder={`Option ${i + 1}`}
                              value={opt.text}
                              onChange={(e) => {
                                const newOpts = [...form.options];
                                newOpts[i].text = e.target.value;
                                setForm({ ...form, options: newOpts });
                              }}
                              className="flex-1 px-3 py-2 rounded-lg bg-bg-primary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-coral/50 transition-all"
                            />
                            <button
                              onClick={() => {
                                const newOpts = [...form.options];
                                newOpts[i].isCorrect = !newOpts[i].isCorrect;
                                setForm({ ...form, options: newOpts });
                              }}
                              className={`p-2 rounded-lg transition-all ${
                                opt.isCorrect ? 'bg-ok/20 text-ok' : 'bg-bg-elevated text-text-muted'
                              }`}
                              title="Mark as correct answer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            {form.options.length > 2 && (
                              <button
                                onClick={() => setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) })}
                                className="p-2 rounded-lg bg-bg-elevated text-text-muted hover:text-magenta transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {form.options.length < 8 && (
                          <button
                            onClick={() => setForm({ ...form, options: [...form.options, { text: '', isCorrect: false }] })}
                            className="w-full py-2 rounded-lg border border-dashed border-border text-text-muted text-sm hover:border-coral/50 transition-all"
                          >
                            + Add Option
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <Timer className="w-4 h-4 text-text-muted" />
                        <select
                          value={form.timer || ''}
                          onChange={(e) => setForm({ ...form, timer: e.target.value ? Number(e.target.value) : null })}
                          className="px-3 py-1.5 rounded-lg bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-coral/50"
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
                          onClick={resetForm}
                          className="btn-ghost px-4 py-2.5 text-sm flex-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveDraft}
                          disabled={!formValid() || saving}
                          className="btn-ghost px-4 py-2.5 text-sm flex-1 disabled:opacity-40"
                        >
                          {form.id ? 'Save Changes' : 'Save Draft'}
                        </button>
                        <button
                          onClick={handleLaunchNow}
                          disabled={!formValid() || saving}
                          className="btn-solid px-4 py-2.5 text-sm flex-1"
                        >
                          <Rocket className="w-4 h-4" />
                          Launch Now
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Drafts Queue */}
              {drafts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5" />
                    Drafts — launch when ready ({drafts.length})
                  </h3>
                  <div className="space-y-2">
                    {drafts.map((poll) => (
                      <div key={poll.id} className="glass rounded-xl p-4 border-dashed">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{poll.question}</p>
                            <p className="text-xs text-text-muted mt-0.5">
                              {poll.options.length} options · {poll.timer_seconds ? `${poll.timer_seconds}s timer` : 'no timer'}
                              {poll.question_image ? ' · has image' : ''}
                            </p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setForm({
                                  id: poll.id,
                                  question: poll.question,
                                  imageUrl: poll.question_image || '',
                                  options: poll.options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
                                  pollType: poll.poll_type === 'multi' ? 'multi' : 'single',
                                  timer: poll.timer_seconds,
                                });
                                setShowForm(true);
                              }}
                              className="p-2 rounded-lg bg-bg-elevated text-text-muted hover:text-flame transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(poll.id)}
                              className="p-2 rounded-lg bg-bg-elevated text-text-muted hover:text-magenta transition-colors"
                              title="Delete draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleLaunchDraft(poll.id)}
                              className="btn-solid px-3 py-2 text-xs"
                            >
                              <Play className="w-3 h-3" />
                              Launch
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Poll List */}
              <h3 className="text-sm font-semibold text-text-secondary mb-2">Launched ({live.length})</h3>
              <div className="space-y-3">
                {live.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-10 h-10 text-text-muted mx-auto mb-2" />
                    <p className="text-text-secondary text-sm">Nothing launched yet</p>
                    <p className="text-xs text-text-muted">Save drafts beforehand, launch live in one tap</p>
                  </div>
                ) : (
                  live.map((poll) => (
                    <motion.div key={poll.id} layout className="glass rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-coral/20 text-coral">
                            {poll.phase === 'voting_open' ? 'Voting Open' : poll.phase === 'voting_locked' ? 'Locked' : 'Results Shown'}
                          </span>
                          <h3 className="font-semibold mt-1 text-sm">{poll.question}</h3>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {poll.phase === 'voting_open' && (
                          <button
                            onClick={() => handlePhaseChange(poll.id, 'voting_locked')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber/20 text-amber text-xs font-medium hover:bg-amber/30 transition-all"
                          >
                            <Lock className="w-3 h-3" />
                            Close Voting
                          </button>
                        )}
                        {poll.phase === 'voting_locked' && (
                          <button
                            onClick={() => handlePhaseChange(poll.id, 'results_shown')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-ok/20 text-ok text-xs font-medium hover:bg-ok/30 transition-all"
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
                    <div key={post.id} className={`glass rounded-xl p-3 ${post.is_hidden ? 'opacity-40' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{post.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-text-muted">
                              {post.is_anonymous ? 'Anonymous' : post.display_name}
                            </span>
                            <span className="text-xs text-text-muted">▲ {post.upvotes}</span>
                            {post.is_pinned && <span className="text-xs px-1.5 py-0.5 rounded bg-flame/20 text-flame">Pinned</span>}
                            {post.is_answering && <span className="text-xs px-1.5 py-0.5 rounded bg-ok/20 text-ok">Answering</span>}
                            {post.is_answered && <span className="text-xs px-1.5 py-0.5 rounded bg-coral/20 text-coral">Answered</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {!post.is_pinned && (
                            <button onClick={() => handleQAAction(post.id, 'pin')} className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-flame transition-all" title="Pin">
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!post.is_answering && !post.is_answered && (
                            <button onClick={() => handleQAAction(post.id, 'answering')} className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-ok transition-all" title="Mark as Answering">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!post.is_answered && (
                            <button onClick={() => handleQAAction(post.id, 'answered')} className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-coral transition-all" title="Mark as Answered">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleQAAction(post.id, 'hide')} className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-magenta transition-all" title="Hide">
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
                  <p className="font-mono text-xl font-bold text-ramp">{code}</p>
                </div>
                <div>
                  <label className="text-sm text-text-secondary">Room URL</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-bg-primary text-xs text-text-muted truncate font-mono">{roomUrl}</code>
                    <button onClick={copyLink} className="p-2 rounded-lg bg-bg-elevated hover:bg-bg-card transition-all">
                      {copied ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4 text-text-muted" />}
                    </button>
                  </div>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-magenta font-semibold mb-1">Danger zone</p>
                  <button
                    onClick={handleEndRoom}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-magenta/40 text-magenta text-sm font-medium hover:bg-magenta/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    End Room for Everyone
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-text-muted text-xs glass border-t border-border">
        Made by <span className="font-bold text-ramp">Cyberheathens</span>
      </footer>
    </div>
  );
}

