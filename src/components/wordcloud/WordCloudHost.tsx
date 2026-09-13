import { useCallback, useEffect, useState } from 'react';
import { Cloud, Lock, Play, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { createWordCloud, deleteWordCloud, getWordClouds, wordCloudAction } from '@/lib/api';
import type { WordCloud } from '@/types';
import WordCloudDisplay from './WordCloudDisplay';

interface WordCloudHostProps {
  roomId: string;
  activeCloud: WordCloud | null;
  onUpdate: (cloud: WordCloud | null) => void;
}

const SUGGESTIONS = [
  'Describe today’s session in one word',
  'What concept should we revisit?',
  'How are you feeling right now?',
];

export default function WordCloudHost({ roomId, activeCloud, onUpdate }: WordCloudHostProps) {
  const [prompt, setPrompt] = useState('');
  const [clouds, setClouds] = useState<WordCloud[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getWordClouds(roomId).then(setClouds).catch(() => {});
  }, [roomId]);

  useEffect(() => { load(); }, [load, activeCloud?.id, activeCloud?.state]);

  const create = async (launch: boolean) => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const cloud = await createWordCloud({ roomId, prompt: prompt.trim(), launch });
      if (launch) onUpdate(cloud);
      setPrompt('');
      load();
      toast.success(launch ? 'Word cloud is live' : 'Word cloud saved as draft');
    } catch (error: any) {
      toast.error(error.message || 'Could not create word cloud');
    } finally {
      setBusy(false);
    }
  };

  const act = async (cloudId: string, action: 'launch' | 'lock') => {
    setBusy(true);
    try {
      const cloud = await wordCloudAction(cloudId, action);
      onUpdate(cloud);
      load();
      toast.success(action === 'launch' ? 'Word cloud is live' : 'Submissions locked');
    } catch (error: any) {
      toast.error(error.message || 'Could not update word cloud');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (cloud: WordCloud) => {
    if (!window.confirm('Delete this word cloud and all of its responses?')) return;
    try {
      await deleteWordCloud(cloud.id);
      if (activeCloud?.id === cloud.id) onUpdate(null);
      load();
      toast.success('Word cloud deleted');
    } catch (error: any) {
      toast.error(error.message || 'Could not delete word cloud');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-coral" />
          <h2 className="text-lg font-bold">Word Clouds</h2>
        </div>
        <p className="text-sm text-text-muted">Collect short ideas and watch shared themes grow in real time.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <label className="mb-2 block text-sm font-medium text-text-secondary">Prompt</label>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, 160))}
          placeholder="What one word describes this session?"
          rows={2}
          className="w-full resize-none rounded-xl bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-coral/50"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} onClick={() => setPrompt(suggestion)} className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-coral/50 hover:text-coral">
              {suggestion}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => create(false)} disabled={!prompt.trim() || busy} className="btn-ghost flex-1 px-4 py-2.5 text-sm disabled:opacity-40">
            <Plus className="h-4 w-4" /> Save draft
          </button>
          <button onClick={() => create(true)} disabled={!prompt.trim() || busy} className="btn-solid flex-1 px-4 py-2.5 text-sm disabled:opacity-40">
            <Sparkles className="h-4 w-4" /> Launch now
          </button>
        </div>
      </section>

      {activeCloud && (
        <section className="glass-strong rounded-2xl p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <span className={`mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${activeCloud.state === 'open' ? 'text-ok' : 'text-amber'}`}>
                <span className={`h-2 w-2 rounded-full ${activeCloud.state === 'open' ? 'animate-pulse bg-ok' : 'bg-amber'}`} />
                {activeCloud.state === 'open' ? 'Live' : 'Locked'}
              </span>
              <h3 className="text-lg font-bold">{activeCloud.prompt}</h3>
              <p className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                <Users className="h-3.5 w-3.5" /> {activeCloud.contributor_count} contributors · {activeCloud.response_count} responses
              </p>
            </div>
            {activeCloud.state === 'open' && (
              <button onClick={() => act(activeCloud.id, 'lock')} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-amber/15 px-3 py-2 text-xs font-semibold text-amber hover:bg-amber/25">
                <Lock className="h-3.5 w-3.5" /> Lock
              </button>
            )}
          </div>
          <WordCloudDisplay words={activeCloud.words || []} compact />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text-secondary">Saved clouds</h3>
        {clouds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted">No word clouds yet.</p>
        ) : clouds.map((cloud) => (
          <div key={cloud.id} className="glass flex items-center justify-between gap-3 rounded-xl p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{cloud.prompt}</p>
              <p className="text-xs capitalize text-text-muted">{cloud.state} · {cloud.response_count} responses</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {cloud.state !== 'open' && <button onClick={() => act(cloud.id, 'launch')} disabled={busy} className="rounded-lg bg-ok/15 p-2 text-ok hover:bg-ok/25" title="Launch"><Play className="h-4 w-4" /></button>}
              {cloud.state !== 'open' && <button onClick={() => remove(cloud)} className="rounded-lg bg-bg-elevated p-2 text-text-muted hover:text-magenta" title="Delete"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
