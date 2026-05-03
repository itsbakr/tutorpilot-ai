'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AcademicCapIcon,
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ExclamationCircleIcon,
  EyeIcon,
  GlobeAltIcon,
  SparklesIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { sessionApi, type ActivitySession } from '@/lib/api';
import { SessionsAnalytics } from './SessionsAnalytics';

export type DeployStage =
  | 'idle'
  | 'thinking'
  | 'editing'
  | 'debugging'
  | 'deploying'
  | 'ready'
  | 'error';

type ViewRole = 'tutor' | 'student';

interface PreviewPaneProps {
  sandboxUrl?: string;
  status?: 'success' | 'failed' | string;
  stage?: DeployStage;
  errorMessage?: string;
  activityId?: string;
  studentId?: string;
  tutorId?: string;
}

const stageMeta: Record<
  Exclude<DeployStage, 'idle' | 'ready' | 'error'>,
  { label: string; description: string }
> = {
  thinking: { label: 'Thinking', description: 'Reading current code and your request…' },
  editing: { label: 'Editing code', description: 'Gemini is rewriting the activity…' },
  debugging: { label: 'Debugging', description: 'Auto-checking the new code…' },
  deploying: { label: 'Deploying', description: 'Spinning up a fresh Daytona sandbox…' },
};

export function PreviewPane({
  sandboxUrl,
  status,
  stage = 'idle',
  errorMessage,
  activityId,
  studentId,
  tutorId,
}: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<ViewRole>('tutor');
  const [tab, setTab] = useState<'preview' | 'sessions'>('preview');
  const [activeSession, setActiveSession] = useState<ActivitySession | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const eventBufferRef = useRef<{ kind: string; payload?: any }[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const isWorking =
    stage === 'thinking' || stage === 'editing' || stage === 'debugging' || stage === 'deploying';
  const showOverlay = isWorking;

  const previewSrc = useMemo(() => {
    if (!sandboxUrl) return '';
    try {
      const u = new URL(sandboxUrl);
      u.searchParams.set('role', view);
      if (activeSession?.id) u.searchParams.set('session', activeSession.id);
      return u.toString();
    } catch {
      return sandboxUrl;
    }
  }, [sandboxUrl, view, activeSession?.id]);

  // Session timer
  useEffect(() => {
    if (!activeSession) return;
    const t = window.setInterval(() => {
      setSessionElapsed((e) => e + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [activeSession]);

  // Flush event buffer to the API
  const flushEvents = useCallback(async () => {
    if (!activeSession?.id) return;
    const buffered = eventBufferRef.current;
    if (buffered.length === 0) return;
    eventBufferRef.current = [];
    try {
      await sessionApi.pushEvents(activeSession.id, buffered);
    } catch (err) {
      console.error('Failed to push events', err);
      eventBufferRef.current = buffered.concat(eventBufferRef.current);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession) return;
    const id = window.setInterval(flushEvents, 5000);
    flushTimerRef.current = id;
    const onUnload = () => flushEvents();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [activeSession, flushEvents]);

  // Listen for postMessage events from the sandbox
  useEffect(() => {
    if (!activeSession) return;
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'tutorpilot:event') return;
      eventBufferRef.current.push({
        kind: data.kind || 'custom',
        payload: data.payload || {},
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activeSession]);

  // Start/stop a session when the user toggles to student view
  const handleViewChange = useCallback(
    async (next: ViewRole) => {
      if (next === view) return;
      if (next === 'student' && !activeSession && activityId) {
        try {
          const s = await sessionApi.start({
            activity_id: activityId,
            student_id: studentId,
            tutor_id: tutorId,
          });
          setActiveSession(s);
          setSessionElapsed(0);
        } catch (err) {
          console.error('Failed to start session', err);
        }
      }
      if (next === 'tutor' && activeSession) {
        await flushEvents();
        try {
          await sessionApi.end(activeSession.id);
        } catch (err) {
          console.error('Failed to end session', err);
        }
        setActiveSession(null);
      }
      setView(next);
      setReloadKey((k) => k + 1);
    },
    [view, activeSession, activityId, studentId, tutorId, flushEvents]
  );

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  const handleReload = () => setReloadKey((k) => k + 1);

  const containerClasses = fullscreen
    ? 'fixed inset-0 z-[100] bg-[var(--background)] flex flex-col'
    : 'flex flex-col h-full bg-white border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/60 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>

        <div className="flex-1 mx-2 min-w-0">
          <div
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs
              ${
                status === 'failed' || stage === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-[var(--card-border)] bg-white text-[var(--foreground-muted)]'
              }
            `}
          >
            <GlobeAltIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate font-mono">
              {sandboxUrl ? new URL(sandboxUrl).host : 'No preview yet'}
            </span>
            {status === 'success' && (
              <CheckCircleIcon className="w-3.5 h-3.5 text-[var(--success)] flex-shrink-0" />
            )}
            {(status === 'failed' || stage === 'error') && (
              <ExclamationCircleIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* View role toggle */}
          {sandboxUrl && (
            <div className="flex items-center mr-1 rounded-lg border border-[var(--card-border)] overflow-hidden">
              <button
                onClick={() => handleViewChange('tutor')}
                className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                  view === 'tutor'
                    ? 'bg-primary text-white'
                    : 'bg-white text-[var(--foreground-muted)] hover:text-foreground'
                }`}
                title="Tutor view (debug controls visible)"
              >
                Tutor
              </button>
              <button
                onClick={() => handleViewChange('student')}
                className={`px-2 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 ${
                  view === 'student'
                    ? 'bg-primary text-white'
                    : 'bg-white text-[var(--foreground-muted)] hover:text-foreground'
                }`}
                title="Student view (records a session)"
              >
                <EyeIcon className="w-3 h-3" />
                Student
                {activeSession && (
                  <span className="text-[10px] font-mono bg-white/20 px-1 rounded">
                    {Math.floor(sessionElapsed / 60)}:
                    {String(sessionElapsed % 60).padStart(2, '0')}
                  </span>
                )}
              </button>
            </div>
          )}
          <button
            onClick={handleReload}
            disabled={!sandboxUrl}
            className="p-1.5 rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Reload preview"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFullscreen((f) => !f)}
            disabled={!sandboxUrl}
            className="p-1.5 rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {fullscreen ? (
              <ArrowsPointingInIcon className="w-4 h-4" />
            ) : (
              <ArrowsPointingOutIcon className="w-4 h-4" />
            )}
          </button>
          {sandboxUrl && (
            <a
              href={sandboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-foreground transition-colors"
              title="Open in new tab"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      {activityId && (
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-[var(--card-border)] bg-white">
          <TabButton active={tab === 'preview'} onClick={() => setTab('preview')} icon={<EyeIcon className="w-3.5 h-3.5" />}>
            Preview
          </TabButton>
          <TabButton active={tab === 'sessions'} onClick={() => setTab('sessions')} icon={<ChartBarIcon className="w-3.5 h-3.5" />}>
            Sessions
          </TabButton>
        </div>
      )}

      {/* Body */}
      <div className="relative flex-1 bg-[var(--background-secondary)]">
        {tab === 'sessions' && activityId ? (
          <SessionsAnalytics activityId={activityId} />
        ) : (
          <>
        {/* Animated edge glow during deploy */}
        <AnimatePresence>
          {isWorking && (
            <motion.div
              key="edge-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-10 ring-2 ring-inset ring-primary/40"
              style={{
                boxShadow: 'inset 0 0 40px rgba(220, 38, 38, 0.15)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Student-mode banner */}
        {view === 'student' && sandboxUrl && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/90 text-white text-[11px] font-medium shadow-lg backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Recording student session
            <button
              type="button"
              onClick={() => handleViewChange('tutor')}
              className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30"
            >
              <StopIcon className="w-3 h-3" /> End
            </button>
          </div>
        )}

        {sandboxUrl ? (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={previewSrc}
            className="w-full h-full border-0 bg-white"
            title="Activity Sandbox"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <EmptyState />
        )}

        {/* Deploy overlay */}
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-sm"
            >
              <DeployStatus stage={stage} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error overlay */}
        <AnimatePresence>
          {stage === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-4 left-4 right-4 z-30 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg"
            >
              <div className="flex items-start gap-2">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Something went wrong</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {errorMessage || 'Try again or rephrase your request.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors
        ${
          active
            ? 'border-primary text-primary'
            : 'border-transparent text-[var(--foreground-muted)] hover:text-foreground'
        }
      `}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center px-8 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <SparklesIcon className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Your activity will appear here</h3>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">
          Generate an activity from the form, then iterate via the chat on the left.
        </p>
      </div>
    </div>
  );
}

function DeployStatus({ stage }: { stage: DeployStage }) {
  const stages: DeployStage[] = ['thinking', 'editing', 'debugging', 'deploying'];
  const currentIndex = stages.indexOf(stage);

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="rounded-2xl bg-white border border-[var(--card-border)] shadow-xl px-6 py-5 max-w-md w-[90%]"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
          <SparklesIcon className="w-5 h-5 text-white" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-xl border-2 border-primary/30 border-t-transparent"
          />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-foreground">
            {stage in stageMeta ? stageMeta[stage as keyof typeof stageMeta].label : 'Working'}…
          </p>
          <p className="text-xs text-[var(--foreground-muted)]">
            {stage in stageMeta
              ? stageMeta[stage as keyof typeof stageMeta].description
              : 'Hang tight, this can take 30–90 seconds.'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {stages.map((s, idx) => {
          const done = idx < currentIndex;
          const active = idx === currentIndex;
          return (
            <div key={s} className="flex items-center gap-2.5 text-xs">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  done
                    ? 'bg-[var(--success)]'
                    : active
                    ? 'bg-primary animate-pulse'
                    : 'bg-[var(--card-border)]'
                }`}
              />
              <span
                className={
                  done
                    ? 'text-foreground line-through opacity-60'
                    : active
                    ? 'font-semibold text-foreground'
                    : 'text-[var(--foreground-muted)]'
                }
              >
                {stageMeta[s as keyof typeof stageMeta].label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
