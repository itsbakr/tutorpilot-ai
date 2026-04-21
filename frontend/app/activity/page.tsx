'use client';

import { Suspense } from 'react';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { activityApi, dataApi } from '@/lib/api';
import { SelfEvaluationCard } from '@/components/SelfEvaluationCard';
import { SandboxPreview } from '@/components/SandboxPreview';
import { ActivityChat } from '@/components/ActivityChat';
import { ContentGallery } from '@/components/ContentGallery';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ActivityResponse, SelfEvaluation } from '@/lib/types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CommandLineIcon,
  LinkIcon,
  PuzzlePieceIcon,
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

interface Lesson {
  id: string;
  title: string;
  content: {
    phases?: Array<{ name: string }>;
  };
}

export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityPageInner />
    </Suspense>
  );
}

function ActivityPageInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [evaluation, setEvaluation] = useState<SelfEvaluation | null>(null);
  const [code, setCode] = useState('');
  const [sandboxUrl, setSandboxUrl] = useState('');
  const [lastRequestData, setLastRequestData] = useState<any>(null); // Store last request for retry
  const [pastActivities, setPastActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [redeployingActivity, setRedeployingActivity] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [formData, setFormData] = useState({
    student_id: '',
    tutor_id: '',
    topic: '',
    activity_description: '',
    duration: 20,
    lesson_id: '',
    lesson_phase: '',
    use_lesson: false,
    max_attempts: 1,  // Changed to 1 to skip auto-fix loop for now
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

  // Prefill student from URL: /activity?student=<uuid>
  useEffect(() => {
    const studentFromUrl = searchParams.get('student') || '';
    if (studentFromUrl) {
      setFormData((p) => ({ ...p, student_id: studentFromUrl }));
    }
  }, [searchParams]);

  // Load an existing activity by id: /activity?id=<uuid>
  useEffect(() => {
    const idFromUrl = searchParams.get('id') || '';
    if (!idFromUrl) return;

    const run = async () => {
      try {
        const { data, error } = await supabase.from('activities').select('*').eq('id', idFromUrl).single();
        if (error) throw error;

        const content = (data as any).content || {};
        const sandbox = (data as any).sandbox_url || '';

        setActivity({
          activity_id: (data as any).id,
          content,
          evaluation: (data as any).self_evaluation,
          deployment: { status: (data as any).deployment_status },
          sandbox_url: sandbox,
        } as any);

        setEvaluation(((data as any).self_evaluation || null) as any);
        setCode(content?.code || '');
        setSandboxUrl(sandbox);
        setProgressStep(5);

        setFormData((p) => ({
          ...p,
          student_id: (data as any).student_id || p.student_id,
          tutor_id: (data as any).tutor_id || p.tutor_id,
          duration: (data as any).duration ?? p.duration,
          use_lesson: !!(data as any).lesson_id,
          lesson_id: (data as any).lesson_id || p.lesson_id,
          lesson_phase: (data as any).lesson_phase || p.lesson_phase,
          topic: (data as any).topic || p.topic,
        }));

        toast.info('Loaded activity', 'You are viewing an existing activity.');
      } catch (err: any) {
        toast.error('Could not load activity', err?.message || 'Please try again.');
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

  // Load lessons when student selected
  useEffect(() => {
    if (formData.student_id) {
      const loadLessons = async () => {
        try {
          const response = await dataApi.getLessons(formData.student_id);
          setLessons(response.lessons || []);
        } catch (error) {
          console.error('Failed to load lessons:', error);
        }
      };
      loadLessons();
    } else {
      setLessons([]);
    }
  }, [formData.student_id]);

  // Load past activities when student selected
  useEffect(() => {
    const loadActivities = async () => {
      if (!formData.student_id) {
        setPastActivities([]);
        return;
      }
      
      setLoadingActivities(true);
      try {
        const response = await dataApi.getActivities(formData.student_id);
        setPastActivities(response.activities || []);
      } catch (error) {
        console.error('Failed to load past activities:', error);
      } finally {
        setLoadingActivities(false);
      }
    };
    loadActivities();
  }, [formData.student_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setActivity(null);
    setEvaluation(null);
    setCode('');
    setSandboxUrl('');
    setProgressStep(0);

    let interval: number | undefined;
    try {
      interval = window.setInterval(() => {
        setProgressStep((s) => (s < 4 ? s + 1 : s));
      }, 1200);

      const requestData = {
        student_id: formData.student_id,
        tutor_id: formData.tutor_id,
        duration: formData.duration,
        max_attempts: formData.max_attempts,
        ...(formData.use_lesson && formData.lesson_id
          ? {
              lesson_id: formData.lesson_id,
              lesson_phase: formData.lesson_phase,
            }
          : {
              topic: formData.topic,
              activity_description: formData.activity_description,
            }),
      };

      // Store request data for retry
      setLastRequestData(requestData);

      const response = await activityApi.create(requestData);
      setActivity(response);
      setEvaluation(response.evaluation);
      setCode(response.content?.code || '');
      setSandboxUrl(response.sandbox_url || '');
      setProgressStep(5);
      toast.success('Activity generated', 'Sandbox is deploying. Preview below when ready.');
    } catch (error) {
      console.error('Failed to create activity:', error);
      toast.error('Generation failed', 'Make sure the backend is running and try again.');
    } finally {
      if (interval) window.clearInterval(interval);
      setLoading(false);
    }
  };

  const handlePreviewActivity = async (activityItem: any) => {
    // Redeploy activity from gallery
    if (!formData.student_id) {
      toast.warning('Select a student', 'Pick a student before previewing an activity.');
      return;
    }

    setRedeployingActivity(activityItem.id);

    try {
      console.log('🚀 Redeploying activity from gallery:', activityItem.id);
      const response = await activityApi.redeploy({
        activity_id: activityItem.id,
        student_id: formData.student_id,
      });

      // Update the sandbox URL
      setSandboxUrl(response.sandbox_url || '');
      
      // Optionally load the activity details
      setActivity({
        activity_id: activityItem.id,
        content: activityItem.content || {},
        evaluation: activityItem.self_evaluation,
        deployment: response.deployment,
        sandbox_url: response.sandbox_url,
        student: { id: formData.student_id },
        tutor: { id: formData.tutor_id },
      } as any);
      
      setEvaluation(activityItem.self_evaluation || null);
      
      // Scroll to preview
      window.scrollTo({ top: 400, behavior: 'smooth' });
      
      toast.success('Activity redeployed', 'Sandbox is building…');
    } catch (error) {
      console.error('Failed to redeploy activity:', error);
      toast.error('Redeploy failed', 'Please try again.');
    } finally {
      setRedeployingActivity(null);
    }
  };

  const handleRetryDeployment = async () => {
    if (!activity?.activity_id || !formData.student_id) {
      toast.warning('Nothing to redeploy', 'Generate or select an activity first.');
      return;
    }

    setLoading(true);

    try {
      // Only redeploy the existing code, don't regenerate with AI
      console.log('♻️ Redeploying activity:', activity.activity_id);
      const response = await activityApi.redeploy({
        activity_id: activity.activity_id,
        student_id: formData.student_id,
      });
      
      // Update only the sandbox URL and deployment status
      setSandboxUrl(response.sandbox_url || '');
      setActivity({
        ...activity,
        deployment: response.deployment,
        sandbox_url: response.sandbox_url,
      });
      
      toast.success('Redeployed', 'Check the preview below.');
    } catch (error) {
      console.error('Failed to retry deployment:', error);
      toast.error('Retry failed', 'Please check the backend logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeUpdate = (newCode: string, newSandboxUrl: string) => {
    setCode(newCode);
    if (newSandboxUrl) {
      setSandboxUrl(newSandboxUrl);
    }
  };

  const selectedLesson = lessons.find((l) => l.id === formData.lesson_id);
  
  // Handle both old 5E format and new comprehensive format
  const lessonPhases = selectedLesson?.content?.phases || [
    { name: 'Pre-Class Work' },
    { name: 'Class Activities' },
    { name: 'Homework' }
  ];

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: `${s.name} — Grade ${s.grade}` })),
    [students]
  );

  const tutorOptions = useMemo(
    () => tutors.map((t) => ({ value: t.id, label: t.name })),
    [tutors]
  );

  const lessonOptions = useMemo(
    () => lessons.map((l) => ({ value: l.id, label: l.title })),
    [lessons]
  );

  const phaseOptions = useMemo(
    () => lessonPhases.map((p) => ({ value: p.name, label: p.name })),
    [lessonPhases]
  );

  const progressItems = [
    { title: 'Reuse research', subtitle: 'Loading context (lesson → activity handoff)' },
    { title: 'Design UX', subtitle: 'Defining interactions and game loop' },
    { title: 'Generate code', subtitle: 'Creating a React app' },
    { title: 'Deploy', subtitle: 'Building the sandbox environment' },
    { title: 'Validate', subtitle: `Auto-fixing up to ${formData.max_attempts} attempt(s)` },
  ];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <PuzzlePieceIcon className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Activity Creator</h1>
            </div>
            <p className="text-[var(--foreground-muted)] mt-1">
              Generate an interactive React activity, deploy it, then iterate via chat.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="secondary" leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
                Back
              </Button>
            </Link>
            {sandboxUrl && (
              <a href={sandboxUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="gradient" rightIcon={<ChevronRightIcon className="w-4 h-4" />}>
                  Open Sandbox
                </Button>
              </a>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Duration (minutes)"
                type="number"
                min={5}
                max={60}
                value={formData.duration}
                onChange={(e) => setFormData((p) => ({ ...p, duration: parseInt(e.target.value || '20', 10) }))}
              />
              <Input
                label="Auto-debug attempts"
                type="number"
                min={1}
                max={5}
                value={formData.max_attempts}
                onChange={(e) => setFormData((p) => ({ ...p, max_attempts: parseInt(e.target.value || '1', 10) }))}
                hint="Higher attempts can take longer but may improve deploy success."
              />
            </div>

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
                    checked={formData.use_lesson}
                    onChange={(e) => setFormData((p) => ({ ...p, use_lesson: e.target.checked }))}
                    className="w-4 h-4 rounded border-[var(--card-border)] text-primary focus:ring-primary"
                  />
                  Create from lesson
                </label>
              </div>

              {formData.use_lesson ? (
                <div className="mt-4 space-y-4">
                  <GlassCard variant="small" padding="md" className="bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Lesson → Activity</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          Reuses the lesson’s context to reduce redundant research.
                        </p>
                      </div>
                      <span className="badge badge-primary">Handoff</span>
                    </div>
                    {selectedLesson && (
                      <div className="mt-4 p-4 rounded-xl bg-white border border-[var(--card-border)]">
                        <p className="text-sm font-semibold text-foreground line-clamp-2">{selectedLesson.title}</p>
                        {formData.lesson_phase && (
                          <p className="text-xs text-[var(--foreground-muted)] mt-1">{formData.lesson_phase}</p>
                        )}
                      </div>
                    )}
                  </GlassCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Lesson"
                      options={lessonOptions}
                      placeholder={
                        !formData.student_id
                          ? 'Select a student first…'
                          : lessons.length === 0
                          ? 'No lessons found'
                          : 'Choose a lesson…'
                      }
                      value={formData.lesson_id}
                      onChange={(e) => setFormData((p) => ({ ...p, lesson_id: e.target.value }))}
                      disabled={!formData.student_id || lessons.length === 0}
                      required
                    />
                    <Select
                      label="Lesson section (optional)"
                      options={phaseOptions}
                      placeholder={!selectedLesson ? 'Select a lesson first…' : 'General activity…'}
                      value={formData.lesson_phase}
                      onChange={(e) => setFormData((p) => ({ ...p, lesson_phase: e.target.value }))}
                      disabled={!selectedLesson}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <Input
                    label="Topic"
                    value={formData.topic}
                    onChange={(e) => setFormData((p) => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g., Chemical Bonding"
                    required
                  />
                  <Textarea
                    label="Describe your activity"
                    value={formData.activity_description}
                    onChange={(e) => setFormData((p) => ({ ...p, activity_description: e.target.value }))}
                    placeholder="Describe gameplay, UI, scoring, constraints…"
                    rows={4}
                    required
                  />
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
              Generate Activity
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
                <p className="text-lg font-bold text-foreground">Generating activity…</p>
                <p className="text-sm text-[var(--foreground-muted)]">This can take a few minutes.</p>
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
        {activity && !loading && (
          <div className="space-y-6">
            <SandboxPreview
              code={code}
              sandboxUrl={sandboxUrl}
              status={activity.deployment?.status}
              attempts={activity.deployment?.attempts}
              isRebuilding={!!redeployingActivity}
              rebuildMessage={redeployingActivity ? 'Redeploying activity from gallery…' : 'Rebuilding sandbox…'}
            />

            {activity.deployment?.status === 'failed' && code && (
              <GlassCard padding="lg" className="border border-[var(--warning)]/20 bg-[var(--warning-bg)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-foreground">Deployment failed</p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      The code was generated but didn’t deploy successfully.
                    </p>
                  </div>
                  <span className="badge badge-warning">Failed</span>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Button variant="gradient" onClick={handleRetryDeployment}>
                    Retry deployment
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (code) navigator.clipboard.writeText(code);
                      toast.success('Copied', 'Activity code copied to clipboard.');
                    }}
                  >
                    Copy code
                  </Button>
                </div>
              </GlassCard>
            )}

            {activity.activity_id && code && sandboxUrl && (
              <ActivityChat
                activityId={activity.activity_id}
                tutorId={formData.tutor_id}
                studentId={formData.student_id}
                onCodeUpdate={handleCodeUpdate}
              />
            )}

            {evaluation && <SelfEvaluationCard evaluation={evaluation} agentName="Activity Creator" />}
          </div>
        )}

        {/* Past activities */}
        {formData.student_id && (
          <ContentGallery
            title="Past Activities"
            items={pastActivities}
            type="activity"
            loading={loadingActivities}
            onItemClick={(item) => {
              setActivity({
                activity_id: item.id,
                content: item.content || {},
                evaluation: item.self_evaluation,
                deployment: { status: item.deployment_status },
                sandbox_url: item.sandbox_url,
                student: { id: formData.student_id },
                tutor: { id: formData.tutor_id },
              } as any);
              setEvaluation(item.self_evaluation || null);
              setSandboxUrl(item.sandbox_url || '');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPreview={handlePreviewActivity}
            emptyMessage="No activities yet. Generate your first one above!"
          />
        )}
      </div>
    </AppShell>
  );
}
