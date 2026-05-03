'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { homeworkApi } from '@/lib/api';
import { ArrowLeftIcon, PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Assignment {
  id: string;
  title: string;
  format: string;
  status: string;
  created_at: string;
  due_at: string | null;
  latest_submission?: { overall_score: number | null; graded_at: string | null };
}

const STATUS_BADGE: Record<string, string> = {
  assigned: 'badge badge-neutral',
  submitted: 'badge badge-warning',
  graded: 'badge badge-success',
};

export default function HomeworkListPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    homeworkApi
      .list(studentId)
      .then((r) => setAssignments(r.assignments || []))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <PageLoader message="Loading homework..." />;

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
              <h1 className="text-2xl font-bold text-foreground">Homework</h1>
              <p className="text-sm text-[var(--foreground-muted)]">Assignments and submissions for this student.</p>
            </div>
          </div>
          <Link href={`/students/${studentId}/homework/new`}>
            <Button variant="gradient" leftIcon={<PlusIcon className="w-4 h-4" />}>
              New homework
            </Button>
          </Link>
        </div>

        {assignments.length === 0 ? (
          <GlassCard padding="lg">
            <div className="text-center py-10">
              <DocumentTextIcon className="w-12 h-12 mx-auto text-[var(--foreground-muted)] mb-3" />
              <p className="text-[var(--foreground-muted)] mb-4">No homework yet.</p>
              <Link href={`/students/${studentId}/homework/new`}>
                <Button variant="gradient">Create the first one</Button>
              </Link>
            </div>
          </GlassCard>
        ) : (
          <GlassCard padding="none" className="overflow-hidden">
            <div className="divide-y divide-[var(--card-border)]">
              {assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/students/${studentId}/homework/${a.id}`}
                  className="block p-4 hover:bg-[var(--background-secondary)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        {a.format.replace('_', ' ')} · {new Date(a.created_at).toLocaleDateString()}
                        {a.due_at && ` · due ${new Date(a.due_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <span className={STATUS_BADGE[a.status] || 'badge badge-neutral'}>{a.status}</span>
                    {a.latest_submission?.overall_score != null && (
                      <span className="text-sm font-semibold text-foreground">
                        {a.latest_submission.overall_score.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
