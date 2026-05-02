'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { feedbackApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeftIcon, ClipboardIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Report {
  id: string;
  mode: 'per_session' | 'weekly_digest';
  session_ids: string[];
  status: string;
  created_at: string;
  content: { title?: string; markdown?: string; language?: string };
}

interface SessionRow {
  id: string;
  status: string;
  occurred_at: string | null;
  created_at: string;
}

export default function ParentFeedbackPage() {
  const params = useParams();
  const toast = useToast();
  const studentId = params.id as string;
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;

  const [reports, setReports] = useState<Report[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftMd, setDraftMd] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    const [r, s] = await Promise.all([
      feedbackApi.listReports(studentId),
      feedbackApi.listSessions(studentId),
    ]);
    setReports(r.reports || []);
    setSessions((s.sessions || []).filter((x: SessionRow) => x.status === 'assessed'));
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [studentId]);

  const handleEdit = (r: Report) => {
    setEditing(r.id);
    setDraftMd(r.content?.markdown || '');
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await feedbackApi.patchReport(editing, { markdown: draftMd, status: 'tutor_edited' });
      toast.success('Saved', 'Tutor edits captured.');
      setEditing(null);
      await load();
    } catch (err: any) {
      toast.error('Save failed', err?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (md: string) => {
    await navigator.clipboard.writeText(md);
    toast.success('Copied', 'Report copied to clipboard.');
  };

  const handleGenerateWeekly = async () => {
    if (!tutorId || picked.length === 0) {
      toast.error('Select sessions', 'Pick at least one assessed session.');
      return;
    }
    setGenerating(true);
    try {
      await feedbackApi.generateReport({
        student_id: studentId,
        tutor_id: tutorId,
        mode: picked.length === 1 ? 'per_session' : 'weekly_digest',
        session_ids: picked,
      });
      toast.success('Drafted', 'New parent report ready below.');
      setPicked([]);
      await load();
    } catch (err: any) {
      toast.error('Generation failed', err?.response?.data?.detail || err?.message || 'Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (loading) return <PageLoader message="Loading reports..." />;

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/students/${studentId}`}
            className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Parent feedback reports</h1>
            <p className="text-sm text-[var(--foreground-muted)]">
              Drafts generated from assessed sessions. Review, edit, copy, send.
            </p>
          </div>
        </div>

        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-foreground mb-2">Generate a new report</h2>
          <p className="text-sm text-[var(--foreground-muted)] mb-3">
            Pick one assessed session for a per-session report, or several for a weekly digest.
          </p>
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              No assessed sessions yet.{' '}
              <Link href={`/students/${studentId}/sessions/upload`} className="text-primary underline">
                Upload one
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {sessions.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 p-2 rounded-xl border border-[var(--card-border)] cursor-pointer hover:bg-[var(--background-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(s.id)}
                    onChange={() => togglePick(s.id)}
                  />
                  <span className="text-sm text-foreground">
                    Session — {formatDate(s.occurred_at || s.created_at)}
                  </span>
                </label>
              ))}
            </div>
          )}
          <Button
            variant="gradient"
            loading={generating}
            onClick={handleGenerateWeekly}
            leftIcon={<DocumentTextIcon className="w-4 h-4" />}
            disabled={picked.length === 0}
          >
            Draft report ({picked.length} session{picked.length === 1 ? '' : 's'})
          </Button>
        </GlassCard>

        {reports.length === 0 ? (
          <GlassCard padding="lg">
            <p className="text-sm text-[var(--foreground-muted)]">No reports yet.</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <GlassCard key={r.id} padding="lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {r.mode === 'per_session' ? 'Per-session' : 'Weekly digest'} ·{' '}
                      {formatDate(r.created_at)} · {r.status}
                      {r.content?.language ? ` · ${r.content.language}` : ''}
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">
                      {r.content?.title || 'Parent update'}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<ClipboardIcon className="w-4 h-4" />}
                      onClick={() => handleCopy(r.content?.markdown || '')}
                    >
                      Copy
                    </Button>
                    {editing === r.id ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => handleEdit(r)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
                {editing === r.id ? (
                  <textarea
                    value={draftMd}
                    onChange={(e) => setDraftMd(e.target.value)}
                    rows={18}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-white text-foreground font-mono text-sm"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-foreground bg-white border border-[var(--card-border)] rounded-xl p-4">
                    {r.content?.markdown}
                  </pre>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
