'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { feedbackApi } from '@/lib/api';
import {
  ArrowLeftIcon,
  CalendarIcon,
  MicrophoneIcon,
  PlusIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface SessionRow {
  id: string;
  lesson_id: string | null;
  status: string;
  occurred_at: string | null;
  created_at: string;
  media_duration_seconds: number | null;
  assessment?: { overall_engagement_score: number; recommendations: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge badge-neutral',
  transcribing: 'badge badge-info',
  transcribed: 'badge badge-info',
  assessing: 'badge badge-warning',
  assessed: 'badge badge-success',
  failed: 'badge badge-danger',
};

export default function StudentSessionsPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await feedbackApi.listSessions(studentId);
        if (mounted) setSessions(res.sessions || []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 8000); // poll while sessions are mid-processing
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [studentId]);

  if (loading) return <PageLoader message="Loading sessions..." />;

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/students/${studentId}`}
              className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tutoring Sessions</h1>
              <p className="text-sm text-[var(--foreground-muted)]">
                Recorded sessions, transcripts, and assessments.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/students/${studentId}/feedback`}>
              <Button variant="secondary" leftIcon={<ChartBarIcon className="w-4 h-4" />}>
                Parent reports
              </Button>
            </Link>
            <Link href={`/students/${studentId}/sessions/upload`}>
              <Button variant="gradient" leftIcon={<PlusIcon className="w-4 h-4" />}>
                Upload recording
              </Button>
            </Link>
          </div>
        </div>

        {sessions.length === 0 ? (
          <GlassCard padding="lg">
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <MicrophoneIcon className="w-8 h-8 text-primary" />
              </div>
              <p className="text-[var(--foreground-muted)] mb-4">No sessions uploaded yet.</p>
              <Link href={`/students/${studentId}/sessions/upload`}>
                <Button variant="gradient" rightIcon={<PlusIcon className="w-4 h-4" />}>
                  Upload first recording
                </Button>
              </Link>
            </div>
          </GlassCard>
        ) : (
          <GlassCard padding="none" className="overflow-hidden">
            <div className="divide-y divide-[var(--card-border)]">
              {sessions.map((s) => (
                <div key={s.id} className="p-5 hover:bg-[var(--background-secondary)] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-[var(--card-border)] flex items-center justify-center flex-shrink-0">
                      <MicrophoneIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground truncate">
                          Session — {formatDate(s.occurred_at || s.created_at)}
                        </p>
                        <span className={STATUS_BADGE[s.status] || 'badge badge-neutral'}>{s.status}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--foreground-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          uploaded {formatDate(s.created_at)}
                        </span>
                        {s.assessment?.overall_engagement_score != null && (
                          <span>Engagement: {s.assessment.overall_engagement_score.toFixed(1)} / 10</span>
                        )}
                        {s.lesson_id && <span>Linked to lesson</span>}
                      </div>
                      {s.assessment?.recommendations && (
                        <p className="mt-2 text-sm text-foreground line-clamp-2">{s.assessment.recommendations}</p>
                      )}
                    </div>
                    <Link href={`/students/${studentId}/sessions/${s.id}`}>
                      <Button variant="secondary" size="sm">
                        Open
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
