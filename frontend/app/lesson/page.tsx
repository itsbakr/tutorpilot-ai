'use client';

import { Suspense } from 'react';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { lessonApi, dataApi } from '@/lib/api';
import { SelfEvaluationCard } from '@/components/SelfEvaluationCard';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ContentGallery } from '@/components/ContentGallery';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { formatLessonToHTML } from '@/lib/lessonFormatter';
import type { LessonContent, SelfEvaluation, LessonPhase } from '@/lib/types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  LinkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Student {
  id: string;
  name: string;
  grade: string;
}

interface Tutor {
  id: string;
  name: string;
}

interface Strategy {
  id: string;
  title: string;
  content: {
    topics?: string[];
    weeks?: number;
  };
}

export default function LessonPage() {
  return (
    <Suspense>
      <LessonPageInner />
    </Suspense>
  );
}

function LessonPageInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [evaluation, setEvaluation] = useState<SelfEvaluation | null>(null);
  const [lessonId, setLessonId] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pastLessons, setPastLessons] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [formData, setFormData] = useState({
    student_id: '',
    tutor_id: '',
    topic: '',
    duration: 60,
    strategy_id: '',
    strategy_week_number: 1,
    use_strategy: false,
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [studentsRes, tutorsRes] = await Promise.all([
          dataApi.getStudents(),
          dataApi.getTutors(),
        ]);
        setStudents(studentsRes.students || []);
        setTutors(tutorsRes.tutors || []);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load data', 'Please try again.');
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

  // Prefill student from URL: /lesson?student=<uuid>
  useEffect(() => {
    const studentFromUrl = searchParams.get('student') || '';
    if (studentFromUrl) {
      setFormData((p) => ({ ...p, student_id: studentFromUrl }));
    }
  }, [searchParams]);

  // Load an existing lesson by id: /lesson?id=<uuid>
  useEffect(() => {
    const idFromUrl = searchParams.get('id') || '';
    if (!idFromUrl) return;

    const run = async () => {
      try {
        const { data, error } = await supabase.from('lessons').select('*').eq('id', idFromUrl).single();
        if (error) throw error;

        setLesson((data as any).content as LessonContent);
        setEvaluation(((data as any).self_evaluation || null) as SelfEvaluation | null);
        setLessonId((data as any).id);
        setProgressStep(4);

        setFormData((p) => ({
          ...p,
          student_id: (data as any).student_id || p.student_id,
          tutor_id: (data as any).tutor_id || p.tutor_id,
          duration: (data as any).duration ?? p.duration,
          use_strategy: !!(data as any).strategy_id,
          strategy_id: (data as any).strategy_id || p.strategy_id,
          strategy_week_number: (data as any).strategy_week_number || p.strategy_week_number,
          topic: (data as any).topic || p.topic,
        }));

        toast.info('Loaded lesson', 'You are viewing an existing lesson.');
      } catch (err: any) {
        toast.error('Could not load lesson', err?.message || 'Please try again.');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Default tutor selection from auth metadata
  useEffect(() => {
    const tutorId = (user?.tutor_id || user?.id) ?? '';
    if (tutorId && !formData.tutor_id) {
      setFormData((p) => ({ ...p, tutor_id: tutorId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load strategies when student selected
  useEffect(() => {
    if (formData.student_id) {
      const loadStrategies = async () => {
        try {
          const response = await dataApi.getStrategies(formData.student_id);
          setStrategies(response.strategies || []);
        } catch (error) {
          console.error('Failed to load strategies:', error);
        }
      };
      loadStrategies();
    } else {
      setStrategies([]);
    }
  }, [formData.student_id]);

  // Load past lessons when student selected
  useEffect(() => {
    const loadLessons = async () => {
      if (!formData.student_id) {
        setPastLessons([]);
        return;
      }
      
      setLoadingLessons(true);
      try {
        const response = await dataApi.getLessons(formData.student_id);
        setPastLessons(response.lessons || []);
      } catch (error) {
        console.error('Failed to load past lessons:', error);
      } finally {
        setLoadingLessons(false);
      }
    };
    loadLessons();
  }, [formData.student_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLesson(null);
    setEvaluation(null);
    setLessonId('');
    setProgressStep(0);

    let interval: number | undefined;
    try {
      interval = window.setInterval(() => {
        setProgressStep((s) => (s < 3 ? s + 1 : s));
      }, 1100);

      const requestData = {
        student_id: formData.student_id,
        tutor_id: formData.tutor_id,
        duration: formData.duration,
        ...(formData.use_strategy && formData.strategy_id
          ? {
              strategy_id: formData.strategy_id,
              strategy_week_number: formData.strategy_week_number,
            }
          : { topic: formData.topic }),
      };

      const response = await lessonApi.create(requestData);
      setLesson(response.content);
      setEvaluation(response.evaluation);
      setLessonId(response.lesson_id);
      setProgressStep(4);
      toast.success('Lesson generated', 'Review and refine the lesson below.');
    } catch (error) {
      console.error('Failed to create lesson:', error);
      toast.error('Generation failed', 'Make sure the backend is running and try again.');
    } finally {
      if (interval) window.clearInterval(interval);
      setLoading(false);
    }
  };

  const selectedStudent = students.find((s) => s.id === formData.student_id);
  const selectedStrategy = strategies.find((s) => s.id === formData.strategy_id);
  const weekTopics = selectedStrategy?.content?.topics || [];
  const maxWeeks = selectedStrategy?.content?.weeks || weekTopics.length || 12;

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: `${s.name} — Grade ${s.grade}` })),
    [students]
  );

  const tutorOptions = useMemo(
    () => tutors.map((t) => ({ value: t.id, label: t.name })),
    [tutors]
  );

  const strategyOptions = useMemo(
    () => strategies.map((s) => ({ value: s.id, label: s.title })),
    [strategies]
  );

  const weekOptions = useMemo(() => {
    if (!selectedStrategy) return [];
    if (weekTopics.length > 0) {
      return weekTopics.map((topic, idx) => ({
        value: String(idx + 1),
        label: `Week ${idx + 1}: ${topic}`,
      }));
    }
    return Array.from({ length: maxWeeks }).map((_, idx) => ({
      value: String(idx + 1),
      label: `Week ${idx + 1}`,
    }));
  }, [maxWeeks, selectedStrategy, weekTopics]);

  const progressItems = [
    { title: 'Reuse research', subtitle: 'Loading context (strategy → lesson handoff)' },
    { title: 'Draft lesson', subtitle: 'Building phases and activities' },
    { title: 'Refine', subtitle: 'Adding differentiation and checks for understanding' },
    { title: 'Self-evaluate', subtitle: 'Scoring and suggesting improvements' },
  ];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <DocumentTextIcon className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Lesson Creator</h1>
            </div>
            <p className="text-[var(--foreground-muted)] mt-1">
              Create an active lesson—standalone, or handed off from a strategy week.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="secondary" leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
                Back
              </Button>
            </Link>
            {lesson && (
              <Link href={`/activity?student=${formData.student_id}`}>
                <Button variant="gradient" rightIcon={<ChevronRightIcon className="w-4 h-4" />}>
                  Create Activity
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Form */}
        <GlassCard padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Student"
                options={studentOptions}
                placeholder={loadingData ? 'Loading students…' : 'Choose a student…'}
                value={formData.student_id}
                onChange={(e) => setFormData((p) => ({ ...p, student_id: e.target.value }))}
                disabled={loadingData}
                required
              />
              <Select
                label="Tutor"
                options={tutorOptions}
                placeholder={loadingData ? 'Loading tutors…' : 'Choose a tutor…'}
                value={formData.tutor_id}
                onChange={(e) => setFormData((p) => ({ ...p, tutor_id: e.target.value }))}
                disabled={loadingData}
                required
              />
            </div>

            <Input
              label="Duration (minutes)"
              type="number"
              min={20}
              max={120}
              value={formData.duration}
              onChange={(e) => setFormData((p) => ({ ...p, duration: parseInt(e.target.value || '60', 10) }))}
            />

            {/* Agent handoff */}
            <div className="pt-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-primary" />
                  <p className="font-semibold text-foreground">Agent Handoff</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.use_strategy}
                    onChange={(e) => setFormData((p) => ({ ...p, use_strategy: e.target.checked }))}
                    className="w-4 h-4 rounded border-[var(--card-border)] text-primary focus:ring-primary"
                  />
                  Create from strategy week
                </label>
              </div>

              {formData.use_strategy ? (
                <div className="mt-4 space-y-4">
                  <GlassCard variant="small" padding="md" className="bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Strategy → Lesson</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          Reuses the strategy’s research context and weekly focus.
                        </p>
                      </div>
                      <span className="badge badge-primary">Handoff</span>
                    </div>
                    {selectedStrategy && (
                      <div className="mt-4 p-4 rounded-xl bg-white border border-[var(--card-border)]">
                        <p className="text-sm font-semibold text-foreground line-clamp-2">{selectedStrategy.title}</p>
                        <p className="text-xs text-[var(--foreground-muted)] mt-1">
                          Week {formData.strategy_week_number}
                          {weekTopics[formData.strategy_week_number - 1]
                            ? `: ${weekTopics[formData.strategy_week_number - 1]}`
                            : ''}
                        </p>
                      </div>
                    )}
                  </GlassCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Strategy"
                      options={strategyOptions}
                      placeholder={
                        !formData.student_id
                          ? 'Select a student first…'
                          : strategies.length === 0
                          ? 'No strategies found'
                          : 'Choose a strategy…'
                      }
                      value={formData.strategy_id}
                      onChange={(e) => setFormData((p) => ({ ...p, strategy_id: e.target.value }))}
                      disabled={!formData.student_id || strategies.length === 0}
                      required
                    />

                    <Select
                      label="Week"
                      options={weekOptions}
                      placeholder={!selectedStrategy ? 'Select a strategy first…' : 'Choose a week…'}
                      value={String(formData.strategy_week_number)}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, strategy_week_number: parseInt(e.target.value, 10) }))
                      }
                      disabled={!selectedStrategy}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <Input
                    label="Topic"
                    value={formData.topic}
                    onChange={(e) => setFormData((p) => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g., Newton's Laws of Motion"
                    required
                  />
                  <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                    Tip: If you already have a strategy, turn on handoff to reuse the research.
                  </p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              fullWidth
              loading={loading}
              rightIcon={loading ? undefined : <SparklesIcon className="w-5 h-5" />}
              disabled={loading || loadingData}
            >
              Generate Lesson
            </Button>
          </form>
        </GlassCard>

        {/* Loading / progress */}
        {loading && (
          <GlassCard padding="lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <LoadingSpinner size="md" color="primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">Generating lesson…</p>
                <p className="text-sm text-[var(--foreground-muted)]">Usually ~15–25 seconds.</p>
              </div>
            </div>

            <div className="space-y-3">
              {progressItems.map((step, idx) => {
                const done = progressStep > idx;
                const active = progressStep === idx;
                return (
                  <div
                    key={step.title}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${
                      done
                        ? 'bg-[var(--success-bg)] border-[var(--success)]/20'
                        : active
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-[var(--background-secondary)] border-[var(--card-border)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{step.title}</p>
                      <p className="text-sm text-[var(--foreground-muted)]">{step.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {done ? (
                        <CheckCircleIcon className="w-5 h-5 text-[var(--success)]" />
                      ) : active ? (
                        <LoadingSpinner size="sm" color="primary" />
                      ) : (
                        <ArrowPathIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* Results */}
        {lesson && !loading && (
          <div className="space-y-6">
            {lessonId && formData.tutor_id && (
              <RichTextEditor
                initialContent={formatLessonToHTML(lesson)}
                onSave={async (content) => {
                  setSaving(true);
                  try {
                    await lessonApi.saveVersion({
                      content_type: 'lesson',
                      content_id: lessonId,
                      content: { content, format: 'html' },
                      changes_summary: 'Tutor edited lesson',
                      edit_notes: editNotes,
                      tutor_id: formData.tutor_id,
                    });
                    toast.success('Saved', 'A new version was created from your edits.');
                    setEditNotes('');
                  } catch (error: any) {
                    toast.error('Save failed', error?.message || 'Please try again.');
                  } finally {
                    setSaving(false);
                  }
                }}
                editNotes={editNotes}
                onEditNotesChange={setEditNotes}
                saving={saving}
              />
            )}

            {evaluation && <SelfEvaluationCard evaluation={evaluation} agentName="Lesson Creator" />}
          </div>
        )}

        {/* Past lessons */}
        {formData.student_id && (
          <ContentGallery
            title="Past Lessons"
            items={pastLessons}
            type="lesson"
            loading={loadingLessons}
            onItemClick={(item) => {
              setLesson(item.content);
              setLessonId(item.id);
              setEvaluation(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            emptyMessage="No lessons yet. Generate your first one above!"
          />
        )}
      </div>
    </AppShell>
  );
}
