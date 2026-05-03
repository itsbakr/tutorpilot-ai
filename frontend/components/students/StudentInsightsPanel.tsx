'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { insightsApi, type StudentInsight } from '@/lib/api';

interface StudentInsightsPanelProps {
  studentId: string;
}

export function StudentInsightsPanel({ studentId }: StudentInsightsPanelProps) {
  const [insights, setInsights] = useState<StudentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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

  const handleDismiss = async (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    try {
      await insightsApi.dismiss(id);
    } catch (err) {
      console.error('Dismiss failed', err);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LightBulbIcon className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-foreground">Insights this week</h3>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--card-border)] text-xs font-medium text-[var(--foreground-muted)] hover:text-primary hover:border-primary/40 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Analyzing…' : 'Refresh'}
        </button>
      </div>

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
                    : 'border-[var(--accent)]/30 bg-[var(--accent-bg)]'
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
                      onClick={() => handleDismiss(i.id)}
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
  );
}
