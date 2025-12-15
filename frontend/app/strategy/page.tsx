'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { strategyApi, dataApi } from '@/lib/api';
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
import { formatStrategyToHTML } from '@/lib/strategyFormatter';
import type { StrategyContent, SelfEvaluation } from '@/lib/types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  LightBulbIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Source {
  title: string;
  url: string;
  snippet?: string;
}

interface Student {
  id: string;
  name: string;
  grade: string;
  subject: string;
  learning_style: string;
}

interface Tutor {
  id: string;
  name: string;
  teaching_style: string;
  education_system: string;
}

export default function StrategyPage() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [strategy, setStrategy] = useState<StrategyContent | null>(null);
  const [evaluation, setEvaluation] = useState<SelfEvaluation | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [strategyId, setStrategyId] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pastStrategies, setPastStrategies] = useState<any[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

  const [formData, setFormData] = useState({
    student_id: '',
    tutor_id: '',
    subject: 'Physics',
    weeks: 4,
  });

  // Load students and tutors on mount
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

  // Prefill student from URL: /strategy?student=<uuid>
  useEffect(() => {
    const studentFromUrl = searchParams.get('student') || '';
    if (studentFromUrl) {
      setFormData((p) => ({ ...p, student_id: studentFromUrl }));
    }
  }, [searchParams]);

  // Load an existing strategy by id: /strategy?id=<uuid>
  useEffect(() => {
    const idFromUrl = searchParams.get('id') || '';
    if (!idFromUrl) return;

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('strategies')
          .select('*')
          .eq('id', idFromUrl)
          .single();
        if (error) throw error;

        setStrategy((data as any).content as StrategyContent);
        setEvaluation(((data as any).self_evaluation || null) as SelfEvaluation | null);
        setStrategyId((data as any).id);
        setSources([]);
        setProgressStep(4);

        setFormData((p) => ({
          ...p,
          student_id: (data as any).student_id || p.student_id,
          tutor_id: (data as any).tutor_id || p.tutor_id,
        }));

        toast.info('Loaded strategy', 'You are viewing an existing strategy.');
      } catch (err: any) {
        toast.error('Could not load strategy', err?.message || 'Please try again.');
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

  // Load past strategies when student is selected
  useEffect(() => {
    const loadStrategies = async () => {
      if (!formData.student_id) {
        setPastStrategies([]);
        return;
      }
      
      setLoadingStrategies(true);
      try {
        const response = await dataApi.getStrategies(formData.student_id);
        setPastStrategies(response.strategies || []);
      } catch (error) {
        console.error('Failed to load past strategies:', error);
      } finally {
        setLoadingStrategies(false);
      }
    };
    loadStrategies();
  }, [formData.student_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStrategy(null);
    setEvaluation(null);
    setSources([]);
    setStrategyId('');
    setProgressStep(0);

    let interval: number | undefined;
    try {
      interval = window.setInterval(() => {
        setProgressStep((s) => (s < 3 ? s + 1 : s));
      }, 1200);

      const response = await strategyApi.create(formData);
      setStrategy(response.content);
      setEvaluation(response.evaluation);
      setSources(response.sources || []);
      setStrategyId(response.strategy_id);
      setProgressStep(4);
      toast.success('Strategy generated', 'Review the output below, then edit and save a new version.');
    } catch (error) {
      console.error('Failed to create strategy:', error);
      toast.error('Generation failed', 'Make sure the backend is running and try again.');
    } finally {
      if (interval) window.clearInterval(interval);
      setLoading(false);
    }
  };

  const selectedStudent = students.find((s) => s.id === formData.student_id);
  const selectedTutor = tutors.find((t) => t.id === formData.tutor_id);

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: `${s.name} — Grade ${s.grade}` })),
    [students]
  );

  const tutorOptions = useMemo(
    () => tutors.map((t) => ({ value: t.id, label: `${t.name} — ${t.education_system}` })),
    [tutors]
  );

  const progressItems = [
    { title: 'Collect sources', subtitle: 'Retrieving knowledge references' },
    { title: 'Draft plan', subtitle: 'Generating weekly topics and structure' },
    { title: 'Write strategy', subtitle: 'Composing the full teaching plan' },
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
                <LightBulbIcon className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Strategy Planner</h1>
            </div>
            <p className="text-[var(--foreground-muted)] mt-1">
              Generate a high-quality multi-week strategy, then refine it and save versions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="secondary" leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
                Back
              </Button>
            </Link>
            {strategy && (
              <Link href={`/lesson?student=${formData.student_id}`}>
                <Button variant="gradient" rightIcon={<ChevronRightIcon className="w-4 h-4" />}>
                  Create Lesson
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

            {selectedStudent && (
              <div className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)]">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Learning style:</span> {selectedStudent.learning_style}
                </p>
                <p className="text-sm text-foreground mt-1">
                  <span className="font-semibold">Default subject:</span> {selectedStudent.subject}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Subject"
                options={[
                  { value: 'Physics', label: 'Physics' },
                  { value: 'Chemistry', label: 'Chemistry' },
                  { value: 'Biology', label: 'Biology' },
                  { value: 'Mathematics', label: 'Mathematics' },
                ]}
                value={formData.subject}
                onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
              />

              <Input
                label="Weeks"
                  type="number"
                min={1}
                max={12}
                  value={formData.weeks}
                onChange={(e) => setFormData((p) => ({ ...p, weeks: parseInt(e.target.value || '4', 10) }))}
                />
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
              Generate Strategy
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
                <p className="text-lg font-bold text-foreground">Generating strategy…</p>
                <p className="text-sm text-[var(--foreground-muted)]">This usually takes ~40–60 seconds.</p>
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
        {strategy && !loading && (
          <div className="space-y-6">
            <GlassCard padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <DocumentTextIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{strategy.weeks || formData.weeks}-Week Overview</h2>
                  <p className="text-sm text-[var(--foreground-muted)]">Weekly focus topics generated for the plan.</p>
                </div>
              </div>

              {strategy.topics && strategy.topics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {strategy.topics.map((topic: string, index: number) => (
                  <div
                    key={index}
                      className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)] hover-lift"
                  >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {index + 1}
                      </div>
                        <p className="font-semibold text-foreground">{topic}</p>
                    </div>
                  </div>
                ))}
              </div>
              ) : (
                <p className="text-[var(--foreground-muted)]">No topics returned.</p>
              )}
            </GlassCard>

            {sources.length > 0 && (
              <GlassCard padding="lg">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                      <BoltIcon className="w-6 h-6 text-[var(--accent-dark)]" />
                  </div>
                  <div>
                      <h2 className="text-2xl font-bold text-foreground">Knowledge Sources</h2>
                      <p className="text-sm text-[var(--foreground-muted)]">{sources.length} sources.</p>
                    </div>
                  </div>
                  <span className="badge badge-neutral">Top 12 shown</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sources.slice(0, 12).map((source, idx) => (
                    <a
                      key={`${source.url}-${idx}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)] hover:border-primary/30 hover:bg-white transition-all"
                    >
                      <p className="font-semibold text-foreground text-sm line-clamp-2">
                        {source.title || `Source ${idx + 1}`}
                      </p>
                      <p className="text-xs text-[var(--foreground-muted)] mt-1 truncate">{source.url}</p>
                    </a>
                  ))}
                </div>
              </GlassCard>
            )}

            {strategyId && formData.tutor_id && (
              <RichTextEditor
                initialContent={formatStrategyToHTML(strategy.content)}
                onSave={async (content) => {
                  setSaving(true);
                  try {
                    await strategyApi.saveVersion({
                      content_type: 'strategy',
                      content_id: strategyId,
                      content: { content, format: 'html' },
                      changes_summary: 'Tutor edited strategy',
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

            {evaluation && <SelfEvaluationCard evaluation={evaluation} agentName="Strategy Planner" />}
          </div>
        )}

        {/* Past strategies */}
        {formData.student_id && (
          <ContentGallery
            title="Past Strategies"
            items={pastStrategies}
            type="strategy"
            loading={loadingStrategies}
            onItemClick={(item) => {
              setStrategy(item.content);
              setStrategyId(item.id);
              setEvaluation(null);
              setSources([]);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            emptyMessage="No strategies yet. Generate your first one above!"
          />
        )}
      </div>
    </AppShell>
  );
}
