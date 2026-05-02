'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { feedbackApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface Utterance {
  speaker_role: 'tutor' | 'student' | 'unknown';
  start_ms: number;
  end_ms: number;
  text: string;
  emotion?: string;
}

interface Assessment {
  overall_engagement_score: number;
  objective_scores: Array<{ objective: string; score: number; status: string; evidence_quotes: string[] }>;
  strengths: Array<{ theme: string; evidence_quotes: string[] }>;
  struggles: Array<{ theme: string; severity: string; evidence_quotes: string[]; suggested_next_step: string }>;
  emotional_arc: Array<{ phase: string; dominant_emotion: string; note?: string }>;
  lesson_coverage: { planned_phases_covered?: string[]; skipped?: string[]; unplanned_topics?: string[] };
  recommendations: string;
}

interface MemoryProposal {
  id: string;
  memory_category: string;
  memory_key: string;
  memory_value: Record<string, unknown>;
  confidence_score: number;
  source_session_id: string;
}

const SPEAKER_COLOR: Record<string, string> = {
  tutor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  student: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  unknown: 'text-gray-600 bg-gray-50 border-gray-200',
};

const formatTs = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const studentId = params.id as string;
  const sessionId = params.sessionId as string;
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;

  const [session, setSession] = useState<any>(null);
  const [transcript, setTranscript] = useState<{ utterances: Utterance[]; language?: string; summary?: string } | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [proposals, setProposals] = useState<MemoryProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  const refresh = useCallback(async () => {
    const [detail, props] = await Promise.all([
      feedbackApi.getSession(sessionId),
      feedbackApi.listMemoryProposals(studentId, 'pending'),
    ]);
    setSession(detail.session);
    setTranscript(detail.transcript);
    setAssessment(detail.assessment);
    setProposals((props.proposals || []).filter((p: MemoryProposal) => p.source_session_id === sessionId));
  }, [sessionId, studentId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await refresh();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const interval = setInterval(() => {
      // Stop polling once assessed or failed
      if (session && (session.status === 'assessed' || session.status === 'failed')) return;
      refresh().catch(() => undefined);
    }, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refresh, session]);

  const handleProposalDecision = async (proposalId: string, decision: 'approved' | 'rejected') => {
    try {
      await feedbackApi.decideMemoryProposal(proposalId, { decision, reviewed_by: tutorId });
      setProposals((p) => p.filter((x) => x.id !== proposalId));
      toast.success(`Proposal ${decision}`, 'Memory updated.');
    } catch (err: any) {
      toast.error('Could not update proposal', err?.message || 'Try again.');
    }
  };

  const handleGenerateReport = async () => {
    if (!tutorId) return;
    setGeneratingReport(true);
    try {
      const res = await feedbackApi.generateReport({
        student_id: studentId,
        tutor_id: tutorId,
        mode: 'per_session',
        session_ids: [sessionId],
      });
      toast.success('Report drafted', 'Open it in Parent reports to review.');
      router.push(`/students/${studentId}/feedback`);
    } catch (err: any) {
      toast.error('Generation failed', err?.response?.data?.detail || err?.message || 'Try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) return <PageLoader message="Loading session..." />;
  if (!session) return null;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/students/${studentId}/sessions`}
              className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Session detail</h1>
              <p className="text-sm text-[var(--foreground-muted)]">
                Status: <span className="font-medium">{session.status}</span>
                {session.status_error && <> — {session.status_error}</>}
              </p>
            </div>
          </div>
          {assessment && (
            <Button
              variant="gradient"
              loading={generatingReport}
              onClick={handleGenerateReport}
              leftIcon={<DocumentTextIcon className="w-4 h-4" />}
            >
              Draft parent report
            </Button>
          )}
        </div>

        {!transcript && (
          <GlassCard padding="lg">
            <p className="text-sm text-[var(--foreground-muted)]">
              Transcription is in progress. This page polls every 6 seconds and will update automatically.
            </p>
          </GlassCard>
        )}

        {assessment && (
          <GlassCard padding="lg">
            <div className="flex items-center gap-2 mb-3">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Assessment</h2>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {assessment.overall_engagement_score?.toFixed(1)} <span className="text-base font-normal text-[var(--foreground-muted)]">/ 10 engagement</span>
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <h3 className="font-semibold text-sm text-foreground mb-2">Strengths</h3>
                <ul className="space-y-1 text-sm">
                  {assessment.strengths?.map((s, i) => (
                    <li key={i} className="text-foreground">
                      ✅ {s.theme}
                      {s.evidence_quotes?.[0] && (
                        <span className="block text-xs text-[var(--foreground-muted)] italic">
                          “{s.evidence_quotes[0]}”
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground mb-2">Struggles</h3>
                <ul className="space-y-1 text-sm">
                  {assessment.struggles?.map((s, i) => (
                    <li key={i} className="text-foreground">
                      ⚠️ <span className="font-medium">[{s.severity}]</span> {s.theme}
                      <span className="block text-xs text-[var(--foreground-muted)]">
                        Next: {s.suggested_next_step}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {assessment.recommendations && (
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium text-foreground mb-1">Recommendation for next session</p>
                <p className="text-sm text-foreground">{assessment.recommendations}</p>
              </div>
            )}
          </GlassCard>
        )}

        {proposals.length > 0 && (
          <GlassCard padding="lg">
            <h2 className="text-lg font-semibold text-foreground mb-3">Memory proposals to review</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              Lower-confidence findings from this session. Approve to add to the student&apos;s memory.
            </p>
            <div className="space-y-2">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white border border-[var(--card-border)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      [{p.memory_category}] {p.memory_key}
                      <span className="ml-2 text-xs text-[var(--foreground-muted)]">
                        confidence {(p.confidence_score * 100).toFixed(0)}%
                      </span>
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1 break-words">
                      {JSON.stringify(p.memory_value)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProposalDecision(p.id, 'approved')}
                      className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                      aria-label="Approve"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleProposalDecision(p.id, 'rejected')}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                      aria-label="Reject"
                    >
                      <XCircleIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {transcript && (
          <GlassCard padding="lg">
            <h2 className="text-lg font-semibold text-foreground mb-1">Transcript</h2>
            {transcript.summary && (
              <p className="text-sm text-[var(--foreground-muted)] mb-4 italic">{transcript.summary}</p>
            )}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {transcript.utterances?.map((u, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border text-sm ${SPEAKER_COLOR[u.speaker_role] || SPEAKER_COLOR.unknown}`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium opacity-80 mb-1">
                    <span>{u.speaker_role}</span>
                    <span>·</span>
                    <span>{formatTs(u.start_ms)}</span>
                    {u.emotion && (
                      <>
                        <span>·</span>
                        <span className="italic">{u.emotion}</span>
                      </>
                    )}
                  </div>
                  <p>{u.text}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
