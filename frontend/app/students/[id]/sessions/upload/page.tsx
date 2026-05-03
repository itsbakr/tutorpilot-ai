'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { dataApi, feedbackApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeftIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

interface LessonOption {
  id: string;
  title: string;
  created_at: string;
}

export default function SessionUploadPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const studentId = params.id as string;
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [lessonId, setLessonId] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>('');
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dataApi.getLessons(studentId).then((r) => setLessons(r.lessons || [])).catch(() => undefined);
  }, [studentId]);

  const tutorId = user?.tutor_id || user?.id;

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Choose a file', 'Pick an audio or video recording first.');
      return;
    }
    if (!tutorId) {
      toast.error('Not signed in', 'Please sign in again.');
      return;
    }
    setSubmitting(true);
    try {
      const upload = await feedbackApi.uploadSession({
        student_id: studentId,
        tutor_id: tutorId,
        lesson_id: lessonId || undefined,
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        file,
      });
      // Trigger assessment in the background
      await feedbackApi.triggerAssess(upload.session_id);
      toast.success('Uploaded', 'Transcription and assessment are running.');
      router.push(`/students/${studentId}/sessions/${upload.session_id}`);
    } catch (err: any) {
      toast.error('Upload failed', err?.response?.data?.detail || err?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/students/${studentId}/sessions`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Upload session recording</h1>
            <p className="text-sm text-[var(--foreground-muted)]">
              Audio or video. We&apos;ll transcribe with diarization and run the assessor.
            </p>
          </div>
        </div>

        <GlassCard padding="lg">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Recording file</label>
              <input
                type="file"
                accept="audio/*,video/mp4,video/webm,video/quicktime"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {file && (
                <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                  {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Linked lesson (optional)</label>
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
              >
                <option value="">— none / ad-hoc session —</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Linking a lesson lets the assessor compare actual interactions to the planned phases.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">When did the session happen?</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
              />
            </div>

            <div className="flex justify-end">
              <Button
                variant="gradient"
                loading={submitting}
                onClick={handleSubmit}
                rightIcon={<CloudArrowUpIcon className="w-4 h-4" />}
              >
                Upload &amp; assess
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
