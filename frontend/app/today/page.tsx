'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/auth-context';
import { todayApi } from '@/lib/api';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  PencilSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface TodayData {
  next_up: any;
  schedule_today: any[];
  action_needed: {
    unassessed_sessions: number;
    homework_pending: number;
    reports_overdue: number;
    misconceptions: any[];
  };
  unread_notifications: number;
}

export default function TodayPage() {
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) return;
    let mounted = true;
    const load = async () => {
      try {
        const r = await todayApi.load(tutorId);
        if (mounted) setData(r);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const t = window.setInterval(load, 60000);
    return () => {
      mounted = false;
      window.clearInterval(t);
    };
  }, [tutorId]);

  if (loading) return <PageLoader message="Loading your day..." />;
  if (!data) return null;

  const formatTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';
  const minutesUntil = (iso?: string) => {
    if (!iso) return null;
    const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    return m;
  };

  const action = data.action_needed;
  const totalActions =
    (action.unassessed_sessions || 0) +
    (action.homework_pending || 0) +
    (action.reports_overdue || 0) +
    (action.misconceptions?.length || 0);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Today</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Next up */}
        {data.next_up ? (
          <GlassCard padding="lg" className="border-l-4 border-primary">
            <div className="flex items-start gap-3 mb-2">
              <ClockIcon className="w-6 h-6 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Next up</p>
                <p className="text-lg font-semibold text-foreground">
                  {minutesUntil(data.next_up.occurred_at) != null && minutesUntil(data.next_up.occurred_at)! >= 0
                    ? `in ${minutesUntil(data.next_up.occurred_at)} min`
                    : 'now'}{' '}
                  · session at {formatTime(data.next_up.occurred_at)}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Link href={`/students/${data.next_up.student_id}/sessions/${data.next_up.id}`}>
                    <Button variant="primary" size="sm">
                      Open session
                    </Button>
                  </Link>
                  <Link href={`/students/${data.next_up.student_id}/briefings`}>
                    <Button variant="secondary" size="sm">
                      Generate briefing
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        ) : (
          <GlassCard padding="md">
            <p className="text-sm text-[var(--foreground-muted)]">No upcoming session in the next 2 hours.</p>
          </GlassCard>
        )}

        {/* Action needed */}
        <GlassCard padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-semibold text-foreground">Action needed ({totalActions})</h2>
          </div>
          {totalActions === 0 ? (
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircleIcon className="w-5 h-5" />
              <p className="text-sm">All clear. Nice work.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {(action.misconceptions || []).map((n: any) => (
                <div key={n.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="text-xs text-[var(--foreground-muted)]">{n.body}</p>}
                  </div>
                  {n.link && (
                    <Link href={n.link}>
                      <Button variant="primary" size="sm">
                        Review
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
              {action.homework_pending > 0 && (
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="w-5 h-5 text-amber-600" />
                    <p className="text-sm text-foreground">{action.homework_pending} homework awaiting grading</p>
                  </div>
                  <Link href="/students">
                    <Button variant="primary" size="sm">
                      Grade now
                    </Button>
                  </Link>
                </div>
              )}
              {action.unassessed_sessions > 0 && (
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AcademicCapIcon className="w-5 h-5 text-amber-600" />
                    <p className="text-sm text-foreground">
                      {action.unassessed_sessions} session(s) waiting on assessment
                    </p>
                  </div>
                </div>
              )}
              {action.reports_overdue > 0 && (
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PencilSquareIcon className="w-5 h-5 text-amber-600" />
                    <p className="text-sm text-foreground">
                      {action.reports_overdue} parent report(s) drafted &gt;3 days ago
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </GlassCard>

        {/* Schedule today */}
        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-foreground mb-3">Schedule</h2>
          {data.schedule_today.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">No sessions on the schedule for the next 2 hours.</p>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {data.schedule_today.map((s: any) => (
                <Link
                  href={`/students/${s.student_id}/sessions/${s.id}`}
                  key={s.id}
                  className="py-3 flex items-center justify-between hover:bg-[var(--background-secondary)] rounded px-2 -mx-2"
                >
                  <span className="text-sm text-foreground">
                    {formatTime(s.occurred_at)} · status {s.status}
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
