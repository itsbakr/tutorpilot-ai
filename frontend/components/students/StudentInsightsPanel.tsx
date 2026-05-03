'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { insightsApi, type StudentInsight } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface StudentInsightsPanelProps {
  studentId: string;
}

export function StudentInsightsPanel({ studentId }: StudentInsightsPanelProps) {
  const toast = useToast();
  const [insights, setInsights] = useState<StudentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  // Default: collapsed when there are no insights, expanded when there are some.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(insights.length > 0);
  }, [insights.length]);

  const refresh = async () => {
    try {
      const list = await insightsApi.list(studentId);
      setInsights(list);
    } catch (err) {
      console.error('Failed to load insights', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [studentId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await insightsApi.generate(studentId);
      await refresh();
    } catch (err) {
      console.error('Generate failed', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDismiss = async (insight: StudentInsight) => {
    // Optimistic remove + delayed server call so undo can no-op locally if used.
    setInsights((prev) => prev.filter((i) => i.id !== insight.id));
    let undone = false;
    toast.info(
      'Dismissed',
      'The insight is hidden — you can bring it back from this toast.',
      {
        label: 'Undo',
        onClick: () => {
          undone = true;
          setInsights((prev) =>
            prev.some((p) => p.id === insight.id) ? prev : [insight, ...prev]
          );
        },
      }
    );
    // Defer the server call so undo is local-only when used quickly.
    setTimeout(async () => {
      if (undone) return;
      try {
        await insightsApi.dismiss(insight.id);
      } catch (err) {
        console.error('Dismiss failed', err);
      }
    }, 5000);
  };

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-[var(--background-secondary)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <LightBulbIcon className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-foreground">Insights this week</h3>
          {insights.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
              {insights.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleGenerate();
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--card-border)] text-xs font-medium text-[var(--foreground-muted)] hover:text-primary hover:border-primary/40 ${
              generating ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
            }`}
          >
            <ArrowPathIcon className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Analyzing…' : 'Refresh'}
          </span>
          <ChevronDownIcon
            className={`w-4 h-4 text-[var(--foreground-muted)] transition-transform ${
              expanded ? '' : '-rotate-90'
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--card-border)] p-4">
      {loading ? (
        <p className="text-xs text-[var(--foreground-muted)] py-4 text-center">Loading…</p>
      ) : insights.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-[var(--foreground-muted)]">
            No active insights. Run a few sessions and click <strong>Refresh</strong>.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence>
            {insights.map((i) => (
              <motion.li
                key={i.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className={`rounded-xl border p-3 ${
                  i.kind === 'misconception'
                    ? 'border-red-200 bg-red-50'
                    : i.kind === 'strength'
                    ? 'border-[var(--success)]/30 bg-[var(--success-bg)]'
                    : 'border-[var(--accent)]/30 bg-[var(--accent)]/10'
                }`}
              >
                <div className="flex items-start gap-2">
                  {i.kind === 'misconception' ? (
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : i.kind === 'strength' ? (
                    <CheckCircleIcon className="w-4 h-4 text-[var(--success)] mt-0.5 flex-shrink-0" />
                  ) : (
                    <LightBulbIcon className="w-4 h-4 text-[var(--accent-dark)] mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {i.kind} · {i.topic || '—'}
                    </p>
                    {i.recommended_action && (
                      <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">
                        {i.recommended_action}
                      </p>
                    )}
                    {i.evidence && Array.isArray(i.evidence) && i.evidence.length > 0 && (
                      <details className="mt-1.5">
                        <summary className="text-[11px] text-[var(--foreground-muted)] cursor-pointer hover:text-foreground">
                          {i.evidence.length} session{i.evidence.length === 1 ? '' : 's'} cited
                        </summary>
                        <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                          {i.evidence.slice(0, 5).map((e: any, k: number) => (
                            <li key={k} className="text-[11px] text-[var(--foreground-muted)]">
                              {e.quote || JSON.stringify(e)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {i.kind === 'misconception' && i.topic && (
                      <Link
                        href={`/activity?student=${studentId}&topic=${encodeURIComponent(
                          i.topic
                        )}`}
                        title="Create activity to address this"
                        className="p-1 rounded hover:bg-white"
                      >
                        <RocketLaunchIcon className="w-3.5 h-3.5 text-primary" />
                      </Link>
                    )}
                    <button
                      onClick={() => handleDismiss(i)}
                      className="p-1 rounded hover:bg-white/60 text-[var(--foreground-muted)]"
                      title="Dismiss"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
        </div>
      )}
    </div>
  );
}
