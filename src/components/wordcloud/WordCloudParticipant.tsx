import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Lock, Send, Sparkles, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { submitWordResponse } from '@/lib/api';
import type { WordCloud } from '@/types';
import WordCloudDisplay from './WordCloudDisplay';

interface WordCloudParticipantProps {
  cloud: WordCloud | null;
  sessionId: string;
  onUpdate: (cloud: WordCloud) => void;
}

export default function WordCloudParticipant({ cloud, sessionId, onUpdate }: WordCloudParticipantProps) {
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!cloud) {
    return (
      <div className="py-20 text-center">
        <Cloud className="mx-auto mb-3 h-12 w-12 text-text-muted" />
        <p className="text-text-secondary">No word cloud is active</p>
        <p className="text-sm text-text-muted">The host will share a prompt here.</p>
      </div>
    );
  }

  const submit = async () => {
    if (!response.trim() || submitting || cloud.state !== 'open') return;
    setSubmitting(true);
    try {
      const updated = await submitWordResponse({ cloudId: cloud.id, sessionId, text: response });
      onUpdate(updated);
      setResponse('');
      toast.success('Added to the cloud');
    } catch (error: any) {
      toast.error(error.message || 'Could not add response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <motion.section initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-strong rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className={`chip ${cloud.state === 'open' ? 'text-ok' : 'text-amber'}`}>
            {cloud.state === 'open' ? <Sparkles className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {cloud.state === 'open' ? 'Accepting responses' : 'Submissions locked'}
          </span>
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Users className="h-3.5 w-3.5" /> {cloud.contributor_count} contributors
          </span>
        </div>
        <h2 className="text-xl font-bold leading-snug">{cloud.prompt}</h2>

        {cloud.state === 'open' && (
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={response}
                maxLength={40}
                onChange={(event) => setResponse(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && submit()}
                placeholder="One word or a short phrase"
                aria-label="Word cloud response"
                className="min-w-0 flex-1 rounded-xl bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-coral/50"
              />
              <button
                onClick={submit}
                disabled={!response.trim() || submitting}
                className="btn-solid px-4 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Add response to word cloud"
              >
                {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-right text-xs text-text-muted">{response.length}/40 · up to five words</p>
          </div>
        )}
      </motion.section>

      <WordCloudDisplay
        words={cloud.words || []}
        compact
        emptyMessage={cloud.state === 'open' ? 'Be the first response in the room.' : 'This cloud closed without responses.'}
      />
      <p className="text-center text-xs text-text-muted">{cloud.response_count} responses · repeated ideas grow larger</p>
    </div>
  );
}
