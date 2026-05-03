'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdjustmentsHorizontalIcon, ArrowUpIcon } from '@heroicons/react/24/outline';

type Axis = 'difficulty' | 'length' | 'tone';

interface DialState {
  difficulty: number; // -2..+2
  length: number;
  tone: number;
}

const labelFor = (axis: Axis, value: number): string => {
  if (value === 0) return '—';
  if (axis === 'difficulty') {
    return ({
      [-2]: 'much easier',
      [-1]: 'easier',
      [1]: 'harder',
      [2]: 'much harder',
    } as Record<number, string>)[value];
  }
  if (axis === 'length') {
    return ({
      [-2]: 'much shorter',
      [-1]: 'shorter',
      [1]: 'longer',
      [2]: 'much longer',
    } as Record<number, string>)[value];
  }
  return ({
    [-2]: 'more playful',
    [-1]: 'lighter tone',
    [1]: 'more formal',
    [2]: 'much more formal',
  } as Record<number, string>)[value];
};

const buildPrompt = (state: DialState): string => {
  const parts: string[] = [];
  if (state.difficulty !== 0) parts.push(`make it ${labelFor('difficulty', state.difficulty)}`);
  if (state.length !== 0) parts.push(`make it ${labelFor('length', state.length)}`);
  if (state.tone !== 0) parts.push(`make the tone ${labelFor('tone', state.tone)}`);
  if (parts.length === 0) return '';
  return `Adjust the activity: ${parts.join(', ')}. Preserve the same learning objective.`;
};

interface AdjustmentDialProps {
  onApply: (prompt: string) => void;
  disabled?: boolean;
}

export function AdjustmentDial({ onApply, disabled }: AdjustmentDialProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DialState>({ difficulty: 0, length: 0, tone: 0 });
  const dirty = state.difficulty !== 0 || state.length !== 0 || state.tone !== 0;

  const set = (axis: Axis, value: number) =>
    setState((s) => ({ ...s, [axis]: value }));

  const handleApply = () => {
    const prompt = buildPrompt(state);
    if (!prompt) return;
    onApply(prompt);
    setState({ difficulty: 0, length: 0, tone: 0 });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
          border transition-colors
          ${
            dirty
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-[var(--card-border)] bg-white text-[var(--foreground-muted)] hover:border-primary/40 hover:text-primary'
          }
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
        title="Quick adjustments"
      >
        <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
        Adjust
        {dirty && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              className="absolute bottom-full mb-2 left-0 z-40 w-[300px] rounded-2xl border border-[var(--card-border)] bg-white shadow-xl p-3 space-y-3"
            >
              <Axis label="Difficulty" axis="difficulty" value={state.difficulty} onChange={(v) => set('difficulty', v)} leftLabel="Easier" rightLabel="Harder" />
              <Axis label="Length" axis="length" value={state.length} onChange={(v) => set('length', v)} leftLabel="Shorter" rightLabel="Longer" />
              <Axis label="Tone" axis="tone" value={state.tone} onChange={(v) => set('tone', v)} leftLabel="Playful" rightLabel="Formal" />

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setState({ difficulty: 0, length: 0, tone: 0 })}
                  className="text-[11px] text-[var(--foreground-muted)] hover:text-foreground"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!dirty}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowUpIcon className="w-3.5 h-3.5" />
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Axis({
  label,
  axis,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  label: string;
  axis: Axis;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-[var(--foreground-muted)]">
          {value === 0 ? '—' : labelFor(axis, value)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-[var(--foreground-muted)] w-12 text-right">
          {leftLabel}
        </span>
        <div className="flex-1 flex items-center justify-between px-1">
          {[-2, -1, 0, 1, 2].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`
                w-6 h-6 rounded-full flex items-center justify-center transition-all
                ${
                  value === v
                    ? 'bg-primary text-white scale-110 shadow-md'
                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:bg-primary/20'
                }
                ${v === 0 ? 'border border-dashed border-[var(--card-border)]' : ''}
              `}
            >
              <span className="text-[10px] font-bold">{v === 0 ? '0' : v > 0 ? '+' : '−'}</span>
            </button>
          ))}
        </div>
        <span className="text-[10px] text-[var(--foreground-muted)] w-12">{rightLabel}</span>
      </div>
    </div>
  );
}
