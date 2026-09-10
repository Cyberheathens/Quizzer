import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart3, Cloud, Send, ThumbsUp, User, Eye, EyeOff, Zap, Wifi, WifiOff } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { submitVote, createQAPost, updateQAPost } from '@/lib/api';
import VotingCard from './VotingCard';
import toast from 'react-hot-toast';

type Tab = 'poll' | 'qa' | 'cloud';

export default function ParticipantView() {
  const { room, currentPoll, qaPosts, sessionId, displayName, isConnected, participantCount, hasVoted, voteResults } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('poll');
  const [qaText, setQaText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'poll', label: 'Poll', icon: BarChart3 },
    { key: 'qa', label: 'Q&A', icon: MessageSquare },
    { key: 'cloud', label: 'Cloud', icon: Cloud },
  ];

  const handleVote = async () => {
    if (!currentPoll || selectedOptions.length === 0) return;
    try {
      await submitVote({ pollId: currentPoll.id, sessionId, selectedOptions });
      useStore.getState().markVoted(currentPoll.id);
      toast.success('Vote submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to vote');
    }
  };

  const handlePostQA = async () => {
    if (!qaText.trim() || !room) return;
    setIsPosting(true);
    try {
      await createQAPost({
        roomId: room.id,
        content: qaText.trim(),
        displayName: isAnonymous ? 'Anonymous' : displayName || 'Anonymous',
        isAnonymous,
      });
      setQaText('');
      toast.success('Posted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleUpvote = async (postId: string) => {
    try {
      await updateQAPost({ postId, action: 'upvote' });
    } catch {
      // silent
    }
  };

  const wordCloudData = useMemo(() => {
    const allText = qaPosts.map((p) => p.content).join(' ');
    const words = allText.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const freq: Record<string, number> = {};
    words.forEach((w) => {
      freq[w] = (freq[w] || 0) + 1;
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([word, count]) => ({ word, count }));
  }, [qaPosts]);

  const voted = currentPoll ? hasVoted[currentPoll.id] : false;
  const results = currentPoll ? voteResults[currentPoll.id] : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong sticky top-0 z-20 px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm">{room?.name || 'Room'}</h1>
            <p className="text-xs text-text-muted font-mono">{room?.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            {isConnected ? <Wifi className="w-3.5 h-3.5 text-accent-green" /> : <WifiOff className="w-3.5 h-3.5 text-accent-orange" />}
            <span>{participantCount}</span>
            <span className="hidden sm:inline">online</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-glow" />
        </div>
      </motion.header>

      {/* Tab Bar */}
      <div className="flex gap-1 px-4 py-2 glass border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-accent-purple/20 text-accent-purple'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'poll' && (
            <motion.div key="poll" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {currentPoll ? (
                <VotingCard
                  poll={currentPoll}
                  selectedOptions={selectedOptions}
                  onSelectOption={setSelectedOptions}
                  onVote={handleVote}
                  hasVoted={voted}
                  results={results}
                  showResults={currentPoll.phase !== 'voting_open'}
                />
              ) : (
                <div className="text-center py-20">
                  <BarChart3 className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <p className="text-text-secondary">No active poll</p>
                  <p className="text-sm text-text-muted">Wait for the host to start one</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'qa' && (
            <motion.div key="qa" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Post Input */}
              <div className="glass rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setIsAnonymous(!isAnonymous)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
                      isAnonymous ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-bg-secondary text-text-muted'
                    }`}
                  >
                    {isAnonymous ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isAnonymous ? 'Anonymous' : displayName || 'Your name'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask a question..."
                    value={qaText}
                    onChange={(e) => setQaText(e.target.value.slice(0, 300))}
                    onKeyDown={(e) => e.key === 'Enter' && handlePostQA()}
                    className="flex-1 px-3 py-2 rounded-xl bg-bg-primary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-purple/50 transition-all"
                  />
                  <button
                    onClick={handlePostQA}
                    disabled={isPosting || !qaText.trim()}
                    className="p-2 rounded-xl bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1 text-right">{qaText.length}/300</p>
              </div>

              {/* Posts */}
              <div className="space-y-2">
                {qaPosts.filter((p) => !p.is_hidden).length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-2" />
                    <p className="text-text-secondary text-sm">No questions yet</p>
                  </div>
                ) : (
                  qaPosts
                    .filter((p) => !p.is_hidden)
                    .sort((a, b) => {
                      if (a.is_pinned && !b.is_pinned) return -1;
                      if (!a.is_pinned && b.is_pinned) return 1;
                      return b.upvotes - a.upvotes;
                    })
                    .map((post) => (
                      <motion.div
                        key={post.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`glass rounded-xl p-3 ${
                          post.is_pinned ? 'ring-1 ring-accent-yellow/50' : ''
                        } ${post.is_answering ? 'ring-1 ring-accent-green/50' : ''} ${
                          post.is_answered ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleUpvote(post.id)}
                            className="flex flex-col items-center gap-0.5 min-w-[40px] pt-0.5"
                          >
                            <ThumbsUp className="w-4 h-4 text-text-muted hover:text-accent-purple transition-colors" />
                            <span className="text-xs font-bold text-text-secondary">{post.upvotes}</span>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{post.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-text-muted">
                                {post.is_anonymous ? 'Anonymous' : post.display_name}
                              </span>
                              {post.is_pinned && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-accent-yellow/20 text-accent-yellow">Pinned</span>
                              )}
                              {post.is_answering && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green">Answering</span>
                              )}
                              {post.is_answered && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-accent-cyan/20 text-accent-cyan">Answered</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'cloud' && (
            <motion.div key="cloud" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {wordCloudData.length > 0 ? (
                <div className="glass rounded-2xl p-6 min-h-[300px] flex flex-wrap items-center justify-center gap-3">
                  {wordCloudData.map(({ word, count }, i) => {
                    const maxCount = wordCloudData[0].count;
                    const size = 0.75 + (count / maxCount) * 2;
                    const colors = ['text-accent-purple', 'text-accent-cyan', 'text-accent-pink', 'text-accent-green', 'text-accent-orange'];
                    return (
                      <motion.span
                        key={word}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={`${colors[i % colors.length]} font-bold`}
                        style={{ fontSize: `${size}rem` }}
                      >
                        {word}
                      </motion.span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Cloud className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <p className="text-text-secondary">Word cloud will appear as questions come in</p>
                </div>
              )}
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
