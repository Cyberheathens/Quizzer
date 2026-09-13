import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cloud } from 'lucide-react';
import type { WordCloudWord } from '@/types';

interface WordCloudDisplayProps {
  words: WordCloudWord[];
  emptyMessage?: string;
  compact?: boolean;
}

interface PlacedWord extends WordCloudWord {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  glow: boolean;
}

const PALETTE = ['#ff8359', '#f3586c', '#e63e7a', '#ffb86b', '#66d9a8', '#f973a1', '#f7c76f', '#d85bff'];

function hashWord(word: string) {
  let hash = 0;
  for (let i = 0; i < word.length; i++) hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function buildLayout(words: WordCloudWord[], width: number, height: number, compact: boolean): PlacedWord[] {
  if (!words.length || !width || !height) return [];
  const sorted = [...words].sort((a, b) => b.value - a.value || a.text.localeCompare(b.text)).slice(0, compact ? 36 : 60);
  const min = sorted[sorted.length - 1]?.value || 1;
  const max = sorted[0]?.value || 1;
  const minFont = compact ? 13 : 18;
  const maxFont = Math.min(height * (compact ? 0.15 : 0.19), compact ? 48 : 78);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return [];

  const placed: PlacedWord[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const gap = compact ? 4 : 7;

  const collides = (x: number, y: number, wordWidth: number, wordHeight: number) => placed.some((other) => (
    Math.abs(x - other.x) < wordWidth / 2 + other.width / 2 + gap
    && Math.abs(y - other.y) < wordHeight / 2 + other.height / 2 + gap
  ));

  for (const item of sorted) {
    const ratio = max === min ? 0.55 : (item.value - min) / (max - min);
    const fontSize = minFont + Math.sqrt(ratio) * (maxFont - minFont);
    context.font = `700 ${fontSize}px Satoshi, ui-sans-serif, sans-serif`;
    const wordWidth = context.measureText(item.text).width + fontSize * 0.28;
    const wordHeight = fontSize * 1.12;
    const seed = hashWord(item.text);
    const angleOffset = (seed % 360) * (Math.PI / 180);
    let position: { x: number; y: number } | null = null;

    for (let step = 0; step < 2600; step++) {
      const angle = angleOffset + step * 0.14;
      const radius = step * (compact ? 0.052 : 0.07);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.76;
      if (x - wordWidth / 2 < 8 || x + wordWidth / 2 > width - 8) continue;
      if (y - wordHeight / 2 < 8 || y + wordHeight / 2 > height - 8) continue;
      if (!collides(x, y, wordWidth, wordHeight)) {
        position = { x, y };
        break;
      }
    }

    if (position) {
      placed.push({
        ...item,
        ...position,
        width: wordWidth,
        height: wordHeight,
        fontSize,
        color: PALETTE[seed % PALETTE.length],
        glow: ratio > 0.62,
      });
    }
  }
  return placed;
}

export default function WordCloudDisplay({ words, emptyMessage = 'Responses will bloom here as they arrive.', compact = false }: WordCloudDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const placed = useMemo(
    () => buildLayout(words, size.width, size.height, compact),
    [words, size.width, size.height, compact],
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl border border-border/70 bg-bg-primary/55 ${compact ? 'h-[280px]' : 'h-[440px]'}`}
    >
      <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at 50% 50%, rgb(230 62 122 / 0.13), transparent 58%)' }} />
      {words.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <div className="mb-3 rounded-2xl border border-border bg-bg-elevated/80 p-3">
            <Cloud className="h-7 w-7 text-coral" />
          </div>
          <p className="max-w-sm text-sm text-text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <AnimatePresence>
          {placed.map((word, index) => (
            <motion.span
              key={word.text}
              initial={{ opacity: 0, scale: 0.35 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.35 }}
              transition={{ type: 'spring', stiffness: 230, damping: 22, delay: Math.min(index * 0.018, 0.35) }}
              className="absolute select-none whitespace-nowrap font-bold leading-none"
              style={{
                left: word.x,
                top: word.y,
                transform: 'translate(-50%, -50%)',
                fontSize: word.fontSize,
                color: word.color,
                textShadow: word.glow ? `0 0 22px ${word.color}88` : undefined,
              }}
              title={`${word.text}: ${word.value}`}
            >
              {word.text}
            </motion.span>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
