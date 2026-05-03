'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/auth-context';
import { todayApi } from '@/lib/api';

export default function SchedulePage() {
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) return;
    todayApi
      .load(tutorId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [tutorId]);

  if (loading) return <PageLoader message="Loading schedule..." />;
  if (!data) return null;

  const upcoming = data.schedule_today || [];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-foreground mb-3">Next 2 hours</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">No upcoming sessions.</p>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {upcoming.map((s: any) => (
                <Link
                  key={s.id}
                  href={`/students/${s.student_id}/sessions/${s.id}`}
                  className="py-3 flex items-center justify-between hover:bg-[var(--background-secondary)] rounded px-2 -mx-2"
                >
                  <span className="text-sm text-foreground">
                    {new Date(s.occurred_at).toLocaleString()} · {s.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}
