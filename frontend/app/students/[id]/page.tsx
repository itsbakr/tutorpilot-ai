'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { dataApi } from '@/lib/api';
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  CalendarIcon,
  ChartBarIcon,
  DocumentTextIcon,
  FunnelIcon,
  GlobeAltIcon,
  HeartIcon,
  LightBulbIcon,
  PencilSquareIcon,
  PlusIcon,
  PuzzlePieceIcon,
  SparklesIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

interface Student {
  id: string;
  name: string;
  grade: string;
  subject: string;
  learning_style: string;
  nationality?: string;
  residence?: string;
  languages?: string[];
  interests?: string[];
  objectives?: string[];
  created_at: string;
}

interface ContentItem {
  id: string;
  title: string;
  type: 'strategy' | 'lesson' | 'activity';
  created_at: string;
  self_evaluation?: { overall_score: number };
  sandbox_url?: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'strategy' | 'lesson' | 'activity'>('all');

  const studentId = params.id as string;

  useEffect(() => {
    if (studentId) {
      loadStudentData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const loadStudentData = async () => {
    try {
      const { data: studentData, error } = await supabase.from('students').select('*').eq('id', studentId).single();
      if (error) throw error;
      setStudent(studentData as Student);

      const [strategies, lessons, activities] = await Promise.all([
        dataApi.getStrategies(studentId).catch(() => ({ strategies: [] })),
        dataApi.getLessons(studentId).catch(() => ({ lessons: [] })),
        dataApi.getActivities(studentId).catch(() => ({ activities: [] })),
      ]);

      const allContent: ContentItem[] = [
        ...(strategies.strategies || []).map((s: any) => ({ ...s, type: 'strategy' as const })),
        ...(lessons.lessons || []).map((l: any) => ({ ...l, type: 'lesson' as const })),
        ...(activities.activities || []).map((a: any) => ({ ...a, type: 'activity' as const })),
      ];

      allContent.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setContent(allContent);
    } catch (error: any) {
      console.error('Failed to load student:', error);
      toast.error('Could not load student', error?.message || 'Please try again.');
      router.push('/students');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      toast.success('Student deleted', 'Student profile has been removed.');
      router.push('/students');
    } catch (error: any) {
      console.error('Failed to delete student:', error);
      toast.error('Delete failed', error?.message || 'Please try again.');
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  const typeMeta = (type: ContentItem['type']) => {
    switch (type) {
      case 'strategy':
        return { label: 'Strategy', icon: LightBulbIcon, badge: 'badge badge-primary', route: '/strategy' };
      case 'lesson':
        return { label: 'Lesson', icon: BookOpenIcon, badge: 'badge badge-warning', route: '/lesson' };
      case 'activity':
        return { label: 'Activity', icon: PuzzlePieceIcon, badge: 'badge badge-success', route: '/activity' };
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const filteredContent = useMemo(() => {
    if (typeFilter === 'all') return content;
    return content.filter((c) => c.type === typeFilter);
  }, [content, typeFilter]);

  if (loading) return <PageLoader message="Loading student..." />;
  if (!student) return null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/students"
                className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
                aria-label="Back to students"
            >
                <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
            </Link>

            <div className="flex items-center gap-4">
                <div className="avatar avatar-xl">{student.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">{student.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="badge badge-primary">Grade {student.grade}</span>
                    <span className="badge badge-neutral">{student.subject}</span>
                    <span className="badge badge-info">{student.learning_style}</span>
                  </div>
              </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/students/${studentId}/edit`}>
                <Button variant="secondary" leftIcon={<PencilSquareIcon className="w-4 h-4" />}>
                  Edit
                </Button>
              </Link>
              <Button
                variant="danger"
                loading={deleting}
                onClick={() => setConfirmDeleteOpen(true)}
                leftIcon={<TrashIcon className="w-4 h-4" />}
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href={`/strategy?student=${studentId}`}>
              <GlassCard hover padding="md" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <LightBulbIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">New Strategy</p>
                  <p className="text-sm text-[var(--foreground-muted)]">4-week plan for {student.subject}</p>
                </div>
              </GlassCard>
            </Link>
            <Link href={`/lesson?student=${studentId}`}>
              <GlassCard hover padding="md" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                  <BookOpenIcon className="w-5 h-5 text-[var(--accent-dark)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">New Lesson</p>
                  <p className="text-sm text-[var(--foreground-muted)]">Active lesson from the strategy</p>
                </div>
              </GlassCard>
            </Link>
            <Link href={`/activity?student=${studentId}`}>
              <GlassCard hover padding="md" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <PuzzlePieceIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">New Activity</p>
                  <p className="text-sm text-[var(--foreground-muted)]">Interactive practice app</p>
                </div>
              </GlassCard>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Profile */}
          <div className="space-y-6">
            <GlassCard padding="md">
              <div className="flex items-center gap-2 mb-4">
                <UserIcon className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Profile</h2>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--foreground-muted)]">Subject</span>
                  <span className="font-medium text-foreground">{student.subject}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--foreground-muted)]">Grade</span>
                  <span className="font-medium text-foreground">Grade {student.grade}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--foreground-muted)]">Learning Style</span>
                  <span className="font-medium text-foreground">{student.learning_style}</span>
                </div>
                {(student.nationality || student.residence) && (
                  <div className="pt-4 border-t border-[var(--card-border)] space-y-3">
                {student.nationality && (
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--foreground-muted)]">Nationality</span>
                        <span className="font-medium text-foreground">{student.nationality}</span>
                  </div>
                )}
                {student.residence && (
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--foreground-muted)]">Residence</span>
                        <span className="font-medium text-foreground">{student.residence}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </GlassCard>

            {student.languages && student.languages.length > 0 && (
              <GlassCard padding="md">
                <div className="flex items-center gap-2 mb-4">
                  <GlobeAltIcon className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Languages</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {student.languages.map((lang, i) => (
                    <span key={i} className="badge badge-info">
                      {lang}
                    </span>
                  ))}
                </div>
              </GlassCard>
            )}

            {student.interests && student.interests.length > 0 && (
              <GlassCard padding="md">
                <div className="flex items-center gap-2 mb-4">
                  <HeartIcon className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Interests</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {student.interests.map((interest, i) => (
                    <span key={i} className="badge badge-neutral">
                      {interest}
                    </span>
                  ))}
                </div>
              </GlassCard>
            )}

            {student.objectives && student.objectives.length > 0 && (
              <GlassCard padding="md">
                <div className="flex items-center gap-2 mb-4">
                  <ChartBarIcon className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Objectives</h3>
                </div>
                <ul className="space-y-2 text-sm text-foreground">
                  {student.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}
          </div>

          {/* Right: Content */}
          <div className="lg:col-span-2">
            <GlassCard padding="none" className="overflow-hidden">
              <div className="p-6 border-b border-[var(--card-border)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Content History</h2>
                  <p className="text-sm text-[var(--foreground-muted)]">Everything created for this student.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant={typeFilter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setTypeFilter('all')}>
                    All
                  </Button>
                  <Button
                    variant={typeFilter === 'strategy' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTypeFilter('strategy')}
                  >
                    Strategies
                  </Button>
                  <Button
                    variant={typeFilter === 'lesson' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTypeFilter('lesson')}
                  >
                    Lessons
                  </Button>
                  <Button
                    variant={typeFilter === 'activity' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTypeFilter('activity')}
                  >
                    Activities
                  </Button>
                </div>
              </div>

              {content.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <SparklesIcon className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-[var(--foreground-muted)] mb-4">No content created yet.</p>
                  <Link href={`/strategy?student=${studentId}`}>
                    <Button variant="gradient" rightIcon={<PlusIcon className="w-4 h-4" />}>
                    Create first strategy
                    </Button>
                  </Link>
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 bg-[var(--background-secondary)] rounded-3xl flex items-center justify-center mx-auto mb-4 border border-[var(--card-border)]">
                    <FunnelIcon className="w-8 h-8 text-[var(--foreground-muted)]" />
                  </div>
                  <p className="text-[var(--foreground-muted)]">No items for this filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--card-border)]">
                  {filteredContent.map((item) => {
                    const meta = typeMeta(item.type);
                    const href = `/content/${item.type}/${item.id}`;
                    const Icon = meta.icon;
                    return (
                      <div key={`${item.type}-${item.id}`} className="p-5 hover:bg-[var(--background-secondary)] transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-white border border-[var(--card-border)] flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-foreground truncate">{item.title || 'Untitled'}</p>
                              <span className={meta.badge}>{meta.label}</span>
                          </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--foreground-muted)]">
                              <span className="inline-flex items-center gap-1">
                                <CalendarIcon className="w-4 h-4" />
                              {formatDate(item.created_at)}
                            </span>
                              {item.self_evaluation?.overall_score !== undefined && (
                                <span className="inline-flex items-center gap-1">
                                  <StarIcon className="w-4 h-4 text-[var(--accent)]" />
                                {item.self_evaluation.overall_score.toFixed(1)}/10
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.type === 'activity' && item.sandbox_url && (
                            <a
                              href={item.sandbox_url}
                              target="_blank"
                              rel="noopener noreferrer"
                                className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-[var(--card-border)] transition-colors"
                                aria-label="Open activity sandbox"
                            >
                                <ArrowTopRightOnSquareIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
                            </a>
                          )}
                            <Link href={href}>
                              <Button variant="secondary" size="sm">
                                Open
                              </Button>
                          </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete student?"
        message={`This will delete ${student.name} and remove their profile. Continue?`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        variant="danger"
        loading={deleting}
      />
    </AppShell>
  );
}




