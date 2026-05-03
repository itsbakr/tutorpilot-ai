'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { homeworkApi } from '@/lib/api';
import { ArrowLeftIcon, CameraIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

export default function HomeworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const studentId = params.id as string;
  const assignmentId = params.homeworkId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<File[]>([]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const r = await homeworkApi.get(assignmentId);
    setData(r);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [assignmentId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const cleanedTyped = Object.fromEntries(
        Object.entries(typed).filter(([, v]) => v && v.trim().length > 0),
      );
      const payload: any = {};
      if (Object.keys(cleanedTyped).length > 0) payload.typed_answers = cleanedTyped;
      if (photos.length > 0) payload.photos = photos;
      if (!payload.typed_answers && !payload.photos) {
        toast.error('Empty submission', 'Add typed answers or photos first.');
        return;
      }
      const r = await homeworkApi.submit(assignmentId, payload);
      toast.success('Submitted', 'Auto-grading is running…');
      router.push(`/students/${studentId}/homework/${assignmentId}/result?submission=${r.submission_id}`);
    } catch (err: any) {
      toast.error('Submit failed', err?.response?.data?.detail || err?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader message="Loading assignment..." />;
  if (!data) return null;

  const a = data.assignment;
  const items = (a.content?.items as any[]) || [];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href={`/students/${studentId}/homework`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)]"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          <span className="badge badge-neutral">{a.status}</span>
        </div>

        <GlassCard padding="lg">
          <h1 className="text-xl font-bold text-foreground">{a.title}</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            {a.format.replace('_', ' ')} · {items.length} items
            {a.estimated_duration_minutes ? ` · ~${a.estimated_duration_minutes} min` : ''}
            {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ''}
          </p>
        </GlassCard>

        {(data.submissions || []).length > 0 && (
          <GlassCard padding="md">
            <p className="text-sm font-medium text-foreground mb-2">Previous submissions</p>
            <div className="space-y-1">
              {data.submissions.map((s: any) => (
                <Link
                  key={s.id}
                  href={`/students/${studentId}/homework/${assignmentId}/result?submission=${s.id}`}
                  className="block p-2 rounded-lg hover:bg-[var(--background-secondary)] text-sm"
                >
                  {new Date(s.created_at).toLocaleString()} —{' '}
                  {s.overall_score != null ? `${s.overall_score.toFixed(0)}%` : 'awaiting grading'}
                </Link>
              ))}
            </div>
          </GlassCard>
        )}

        <GlassCard padding="lg">
          <h2 className="text-base font-semibold text-foreground mb-3">Submit answers</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">📷 Photos (handwritten work)</p>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhotos(Array.from(e.target.files || []))}
                className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary"
              />
              {photos.length > 0 && (
                <p className="text-xs text-[var(--foreground-muted)] mt-1">{photos.length} photo(s) selected</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">✏️ Typed answers (optional)</p>
              <div className="space-y-3">
                {items.map((it: any) => (
                  <div key={it.id} className="border border-[var(--card-border)] rounded-xl p-3">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {it.id}. {it.prompt}
                    </p>
                    <textarea
                      rows={2}
                      value={typed[it.id] || ''}
                      onChange={(e) => setTyped((t) => ({ ...t, [it.id]: e.target.value }))}
                      placeholder="(leave blank if you submitted via photo)"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-white text-foreground text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="gradient"
                loading={submitting}
                onClick={handleSubmit}
                leftIcon={<PencilSquareIcon className="w-4 h-4" />}
              >
                Submit & grade
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
