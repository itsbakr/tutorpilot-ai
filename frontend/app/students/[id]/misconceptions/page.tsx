'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { misconceptionApi } from '@/lib/api';
import { ArrowLeftIcon, BoltIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface MemoryEntry {
  memory_key: string;
  memory_value: any;
  confidence_score: number;
  last_updated: string;
}

export default function MisconceptionsPage() {
  const params = useParams();
  const toast = useToast();
  const studentId = params.id as string;

  const [items, setItems] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const r = await misconceptionApi.list(studentId);
    setItems(r.misconceptions || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [studentId]);

  const handleDetect = async () => {
    setRunning(true);
    try {
      const r = await misconceptionApi.detect(studentId);
      toast.success('Detection complete', `${r.detected?.length || 0} clusters across ${r.events_seen || 0} events.`);
      await load();
    } catch (err: any) {
      toast.error('Detection failed', err?.message || 'Try again.');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <PageLoader message="Loading patterns..." />;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/students/${studentId}`}
              className="p-2 rounded-xl hover:bg-[var(--background-secondary)]"
            >
              <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Patterns we&apos;ve noticed</h1>
              <p className="text-sm text-[var(--foreground-muted)]">Recurring misconceptions across sessions and homework.</p>
            </div>
          </div>
          <Button
            variant="primary"
            loading={running}
            onClick={handleDetect}
            leftIcon={<BoltIcon className="w-4 h-4" />}
          >
            Re-run detection
          </Button>
        </div>

        {items.length === 0 ? (
          <GlassCard padding="lg">
            <p className="text-sm text-[var(--foreground-muted)]">
              No persistent misconceptions detected yet. We need at least 3 events on the same theme before flagging.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {items.map((m) => (
              <GlassCard key={m.memory_key} padding="lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold">
                      {m.memory_value?.supporting_events_count || '?'} events
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">
                      {m.memory_value?.theme || m.memory_key}
                    </h3>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                      First seen {m.memory_value?.first_seen?.slice(0, 10) || '?'} ·
                      Last seen {m.memory_value?.last_seen?.slice(0, 10) || '?'} ·
                      conf {(m.confidence_score * 100).toFixed(0)}%
                    </p>
                    {m.memory_value?.evidence_examples?.length > 0 && (
                      <ul className="text-sm text-foreground mt-3 space-y-1">
                        {m.memory_value.evidence_examples.map((e: string, i: number) => (
                          <li key={i} className="text-[var(--foreground-muted)] italic">• &ldquo;{e}&rdquo;</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link
                    href={`/lesson?student=${studentId}&topic=${encodeURIComponent(m.memory_value?.theme || m.memory_key)}`}
                  >
                    <Button variant="gradient" size="sm" leftIcon={<SparklesIcon className="w-4 h-4" />}>
                      Remediation lesson
                    </Button>
                  </Link>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
