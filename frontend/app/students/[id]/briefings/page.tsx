'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { briefingApi, dataApi } from '@/lib/api';
import { ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function BriefingsListPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;
  const studentId = params.id as string;

  const [briefings, setBriefings] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonId, setLessonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([briefingApi.list(studentId), dataApi.getLessons(studentId)])
      .then(([b, l]) => {
        setBriefings(b.briefings || []);
        setLessons(l.lessons || []);
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  const handleGenerate = async () => {
    if (!tutorId) return;
    setGenerating(true);
    try {
      const r = await briefingApi.generate({
        student_id: studentId,
        tutor_id: tutorId,
        upcoming_lesson_id: lessonId || undefined,
      });
      toast.success('Briefing ready', null);
      router.push(`/students/${studentId}/briefings/${r.briefing_id}`);
    } catch (err: any) {
      toast.error('Generation failed', err?.response?.data?.detail || err?.message || 'Try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <PageLoader message="Loading briefings..." />;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href={`/students/${studentId}`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)]"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pre-session briefings</h1>
            <p className="text-sm text-[var(--foreground-muted)]">Generate a quick prep before each session.</p>
          </div>
        </div>

        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-foreground mb-3">Generate a new briefing</h2>
          <div className="flex gap-3">
            <select
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
            >
              <option value="">— No specific lesson (general briefing) —</option>
              {lessons.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <Button
              variant="gradient"
              loading={generating}
              onClick={handleGenerate}
              leftIcon={<SparklesIcon className="w-4 h-4" />}
            >
              Generate
            </Button>
          </div>
        </GlassCard>

        {briefings.length > 0 && (
          <GlassCard padding="none" className="overflow-hidden">
            <div className="divide-y divide-[var(--card-border)]">
              {briefings.map((b) => (
                <Link
                  key={b.id}
                  href={`/students/${studentId}/briefings/${b.id}`}
                  className="block p-4 hover:bg-[var(--background-secondary)]"
                >
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {b.content?.headline || 'Briefing'}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {new Date(b.generated_at).toLocaleString()} ·{' '}
                    {b.acknowledged_at ? 'read' : 'unread'}
                  </p>
                </Link>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
