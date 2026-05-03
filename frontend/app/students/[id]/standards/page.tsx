'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { standardsApi } from '@/lib/api';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const STATUS_CLS: Record<string, string> = {
  taught: 'bg-blue-50 border-blue-200 text-blue-700',
  mastered: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  struggling: 'bg-amber-50 border-amber-200 text-amber-700',
  never: 'bg-slate-50 border-slate-200 text-slate-500',
};

export default function StudentStandardsPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    standardsApi
      .studentCoverage(studentId)
      .then((r) => setData(r.standards || []))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <PageLoader message="Loading coverage..." />;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href={`/students/${studentId}`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)]"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Standards coverage</h1>
            <p className="text-sm text-[var(--foreground-muted)]">
              Curriculum standards aligned to lessons + how the student is doing on each.
            </p>
          </div>
        </div>

        {data.length === 0 ? (
          <GlassCard padding="lg">
            <p className="text-sm text-[var(--foreground-muted)]">
              No lessons aligned yet. Standards appear automatically as you create lessons.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {data.map((s, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border ${STATUS_CLS[s.status] || STATUS_CLS.taught}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      <span className="font-mono text-xs">{s.code}</span> · {s.description}
                    </p>
                    <p className="text-xs mt-1 opacity-70">
                      Taught {s.taught_count}× ·{' '}
                      {s.avg_objective_score != null
                        ? `avg objective ${s.avg_objective_score.toFixed(1)}/10`
                        : 'no assessment data'}
                    </p>
                  </div>
                  <span className="text-xs uppercase font-semibold">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
