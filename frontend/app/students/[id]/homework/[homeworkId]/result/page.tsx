'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { homeworkApi } from '@/lib/api';
import { ArrowLeftIcon, ClipboardIcon } from '@heroicons/react/24/outline';

const CORRECT_BADGE = (c: any) => {
  if (c === true || c === 'true') return { text: '✓ correct', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (c === 'partial') return { text: '~ partial', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { text: '✗ wrong', cls: 'text-rose-700 bg-rose-50 border-rose-200' };
};

const INTEGRITY_BADGE = (likelihood: number) => {
  if (likelihood < 0.3) return null;
  if (likelihood < 0.6) return { text: '🤖 some signals', cls: 'text-amber-700 bg-amber-50 border-amber-300' };
  return { text: '🤖 possible AI assistance', cls: 'text-amber-800 bg-amber-100 border-amber-400' };
};

export default function HomeworkResultPage() {
  const params = useParams();
  const search = useSearchParams();
  const toast = useToast();
  const studentId = params.id as string;
  const assignmentId = params.homeworkId as string;
  const submissionId = search.get('submission');

  const [submission, setSubmission] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!submissionId) return;
    const [s, a] = await Promise.all([
      homeworkApi.getSubmission(submissionId),
      homeworkApi.get(assignmentId),
    ]);
    setSubmission(s.submission);
    setAssignment(a.assignment);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    // Poll while still ungraded
    const t = window.setInterval(() => {
      if (!submission || submission.graded_at) return;
      load().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, assignmentId]);

  if (loading) return <PageLoader message="Loading result..." />;
  if (!submission || !assignment) return null;

  const items = (assignment.content?.items as any[]) || [];
  const itemMap = Object.fromEntries(items.map((it) => [String(it.id), it]));
  const graded = (submission.graded_results as any[]) || [];
  const integrity = submission.integrity_check;
  const integrityBadge = integrity ? INTEGRITY_BADGE(integrity.ai_likelihood || 0) : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(submission.feedback_markdown || '');
    toast.success('Copied', 'Student feedback copied to clipboard.');
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href={`/students/${studentId}/homework/${assignmentId}`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)]"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          {submission.graded_at && (
            <Button variant="secondary" size="sm" leftIcon={<ClipboardIcon className="w-4 h-4" />} onClick={handleCopy}>
              Copy student feedback
            </Button>
          )}
        </div>

        <GlassCard padding="lg">
          <p className="text-xs uppercase text-[var(--foreground-muted)] mb-1">{assignment.title}</p>
          {submission.graded_at ? (
            <p className="text-3xl font-bold text-foreground">
              {(submission.overall_score || 0).toFixed(0)}%
            </p>
          ) : (
            <p className="text-sm text-[var(--foreground-muted)]">Grading in progress…</p>
          )}
          {integrityBadge && (
            <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-lg border ${integrityBadge.cls}`}>
              {integrityBadge.text} ({Math.round(integrity.ai_likelihood * 100)}%)
            </span>
          )}
        </GlassCard>

        {graded.length > 0 && (
          <GlassCard padding="lg">
            <h2 className="text-base font-semibold text-foreground mb-3">Per-item</h2>
            <div className="space-y-3">
              {graded.map((r: any, i: number) => {
                const it = itemMap[String(r.item_id)];
                const b = CORRECT_BADGE(r.correct);
                return (
                  <div key={i} className={`p-3 rounded-xl border ${b.cls}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide">{r.item_id} · {b.text}</p>
                      {it?.difficulty && <span className="text-xs">difficulty {it.difficulty}/5</span>}
                    </div>
                    {it?.prompt && <p className="text-sm text-foreground mb-1">{it.prompt}</p>}
                    {r.student_answer_excerpt && (
                      <p className="text-xs italic text-[var(--foreground-muted)]">
                        Student wrote: &ldquo;{r.student_answer_excerpt}&rdquo;
                      </p>
                    )}
                    {r.feedback && <p className="text-sm text-foreground mt-1">{r.feedback}</p>}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {submission.feedback_markdown && (
          <GlassCard padding="lg">
            <h2 className="text-base font-semibold text-foreground mb-2">📩 Student-facing feedback (auto-drafted)</h2>
            <pre className="whitespace-pre-wrap text-sm text-foreground bg-white border border-[var(--card-border)] rounded-xl p-3">
              {submission.feedback_markdown}
            </pre>
          </GlassCard>
        )}

        {submission.ocr_text && (
          <GlassCard padding="lg">
            <h2 className="text-base font-semibold text-foreground mb-2">📷 OCR transcription</h2>
            <pre className="whitespace-pre-wrap text-xs text-[var(--foreground-muted)] bg-[var(--background-secondary)] rounded-xl p-3 max-h-64 overflow-y-auto">
              {submission.ocr_text}
            </pre>
          </GlassCard>
        )}

        {integrity && integrity.signals?.length > 0 && (
          <GlassCard padding="lg">
            <h2 className="text-base font-semibold text-foreground mb-1">🔎 Integrity signals (advisory)</h2>
            <p className="text-xs text-[var(--foreground-muted)] mb-2">
              Recommendation: <strong>{integrity.recommendation}</strong>. This is for tutor reference; never auto-shared with parents.
            </p>
            <ul className="text-sm text-foreground space-y-1">
              {integrity.signals.map((s: string, i: number) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
