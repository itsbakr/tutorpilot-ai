'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { dataApi, homeworkApi } from '@/lib/api';
import { ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function HomeworkNewPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;
  const studentId = params.id as string;

  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonId, setLessonId] = useState('');
  const [format, setFormat] = useState('problem_set');
  const [itemCount, setItemCount] = useState(5);
  const [difficulty, setDifficulty] = useState(3);
  const [duration, setDuration] = useState(20);
  const [dueAt, setDueAt] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dataApi.getLessons(studentId).then((r) => setLessons(r.lessons || [])).catch(() => undefined);
  }, [studentId]);

  const handleGenerate = async () => {
    if (!tutorId) return;
    setSubmitting(true);
    try {
      const r = await homeworkApi.generate({
        student_id: studentId,
        tutor_id: tutorId,
        lesson_id: lessonId || undefined,
        format,
        item_count: itemCount,
        difficulty_target: difficulty,
        title: title || undefined,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        estimated_duration_minutes: duration,
      });
      toast.success('Homework ready', `${r.items?.length || 0} items generated.`);
      router.push(`/students/${studentId}/homework/${r.assignment_id}`);
    } catch (err: any) {
      toast.error('Generation failed', err?.response?.data?.detail || err?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href={`/students/${studentId}/homework`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)]"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">New homework</h1>
        </div>

        <GlassCard padding="lg">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Linked lesson</label>
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
              >
                <option value="">— none —</option>
                {lessons.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
                >
                  <option value="problem_set">Problem set</option>
                  <option value="worksheet">Worksheet</option>
                  <option value="reading">Reading</option>
                  <option value="reflection">Reflection</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Item count: {itemCount}</label>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={itemCount}
                  onChange={(e) => setItemCount(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Difficulty target: {difficulty}/5</label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Duration (min)</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Due date (optional)</label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground"
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="gradient"
                loading={submitting}
                onClick={handleGenerate}
                rightIcon={<SparklesIcon className="w-4 h-4" />}
              >
                Generate
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
