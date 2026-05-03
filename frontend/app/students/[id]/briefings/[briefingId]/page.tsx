'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { briefingApi } from '@/lib/api';
import { ArrowLeftIcon, CheckCircleIcon, ClipboardIcon } from '@heroicons/react/24/outline';

interface Briefing {
  id: string;
  acknowledged_at: string | null;
  generated_at: string;
  content: {
    headline?: string;
    remember?: { point: string; evidence: string }[];
    watch_for?: { signal: string; what_to_do: string }[];
    open_questions?: string[];
    lesson_anchor_to_interest?: string;
    warm_up_question?: string;
  };
}

export default function BriefingDetailPage() {
  const params = useParams();
  const toast = useToast();
  const studentId = params.id as string;
  const briefingId = params.briefingId as string;

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    briefingApi
      .get(briefingId)
      .then((r) => setBriefing(r.briefing))
      .finally(() => setLoading(false));
  }, [briefingId]);

  const handleAck = async () => {
    await briefingApi.acknowledge(briefingId);
    setBriefing((b) => (b ? { ...b, acknowledged_at: new Date().toISOString() } : b));
    toast.success('Marked as read', null);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied', null);
  };

  if (loading) return <PageLoader message="Loading briefing..." />;
  if (!briefing) return null;

  const c = briefing.content || {};

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href={`/students/${studentId}`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)]"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          {!briefing.acknowledged_at && (
            <Button variant="primary" size="sm" leftIcon={<CheckCircleIcon className="w-4 h-4" />} onClick={handleAck}>
              Mark as read
            </Button>
          )}
        </div>

        <GlassCard padding="lg" className="border-l-4 border-primary">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Headline</p>
          <p className="text-xl font-semibold text-foreground">{c.headline}</p>
        </GlassCard>

        {(c.remember || []).length > 0 && (
          <GlassCard padding="lg">
            <h2 className="text-base font-semibold text-foreground mb-3">📌 Remember</h2>
            <ul className="space-y-3">
              {c.remember!.map((r, i) => (
                <li key={i} className="border-l-2 border-primary/30 pl-3">
                  <p className="text-sm text-foreground">{r.point}</p>
                  {r.evidence && (
                    <p className="text-xs text-[var(--foreground-muted)] italic mt-1">&ldquo;{r.evidence}&rdquo;</p>
                  )}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {(c.watch_for || []).length > 0 && (
          <GlassCard padding="lg">
            <h2 className="text-base font-semibold text-foreground mb-3">👀 Watch for</h2>
            <ul className="space-y-2">
              {c.watch_for!.map((w, i) => (
                <li key={i} className="text-sm text-foreground">
                  ↳ {w.signal} —{' '}
                  <span className="text-[var(--foreground-muted)]">{w.what_to_do}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {(c.open_questions || []).length > 0 && (
          <GlassCard padding="lg">
            <h2 className="text-base font-semibold text-foreground mb-3">❓ Open questions</h2>
            <ul className="space-y-1">
              {c.open_questions!.map((q, i) => (
                <li key={i} className="text-sm text-foreground">• {q}</li>
              ))}
            </ul>
          </GlassCard>
        )}

        {c.lesson_anchor_to_interest && (
          <GlassCard padding="lg">
            <p className="text-xs uppercase tracking-wide text-[var(--accent-dark)] font-semibold mb-1">
              🚀 Anchor to interest
            </p>
            <p className="text-sm text-foreground">{c.lesson_anchor_to_interest}</p>
          </GlassCard>
        )}

        {c.warm_up_question && (
          <GlassCard padding="lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-1">
                  💬 Suggested warm-up
                </p>
                <p className="text-base text-foreground italic">&ldquo;{c.warm_up_question}&rdquo;</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ClipboardIcon className="w-4 h-4" />}
                onClick={() => handleCopy(c.warm_up_question!)}
              >
                Copy
              </Button>
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
