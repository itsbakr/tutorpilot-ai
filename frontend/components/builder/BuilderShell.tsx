'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  BoltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/ResizablePanels';
import { useToast } from '@/components/ui/Toast';
import { BuilderChat } from './BuilderChat';
import { PreviewPane, type DeployStage } from './PreviewPane';
import { VersionDropdown } from './VersionDropdown';
import { DiffDrawer } from './DiffDrawer';
import { AdaptModal } from './AdaptModal';
import { AlignmentDrawer } from './AlignmentDrawer';

interface BuilderShellProps {
  activityId: string;
  tutorId: string;
  studentId: string;
  initialSandboxUrl?: string;
  initialDeploymentStatus?: 'success' | 'failed' | string;
  tutorName?: string;
  topic?: string;
  onCodeUpdate?: (newCode: string, sandboxUrl?: string) => void;
  onExitToForm?: () => void;
}

export function BuilderShell({
  activityId,
  tutorId,
  studentId,
  initialSandboxUrl,
  initialDeploymentStatus,
  tutorName,
  topic,
  onCodeUpdate,
  onExitToForm,
}: BuilderShellProps) {
  const toast = useToast();
  const [sandboxUrl, setSandboxUrl] = useState<string | undefined>(initialSandboxUrl);
  const [deploymentStatus, setDeploymentStatus] = useState<string | undefined>(
    initialDeploymentStatus
  );
  const [stage, setStage] = useState<DeployStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isMobile, setIsMobile] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [alignmentOpen, setAlignmentOpen] = useState(false);
  const [versionBump, setVersionBump] = useState(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleStageChange = (next: DeployStage) => {
    setStage(next);
    if (next === 'ready') {
      setDeploymentStatus('success');
      setErrorMessage(undefined);
    } else if (next === 'error') {
      setDeploymentStatus('failed');
    }
  };

  const handleCodeUpdate = (newCode: string, newSandboxUrl?: string) => {
    if (newSandboxUrl) {
      setSandboxUrl(newSandboxUrl);
    }
    setVersionBump((b) => b + 1);
    onCodeUpdate?.(newCode, newSandboxUrl);
    toast.success('Activity updated', 'Sandbox refreshed with the new code.');
  };

  const handleVersionRestore = ({ code, sandbox_url }: { code: string; sandbox_url?: string }) => {
    if (sandbox_url) setSandboxUrl(sandbox_url);
    setVersionBump((b) => b + 1);
    onCodeUpdate?.(code, sandbox_url);
    toast.info('Version restored', 'The previous version is now live.');
  };

  const handleAdapted = (data: { activity_id: string; sandbox_url?: string }) => {
    if (data.activity_id) {
      window.location.href = `/activity?id=${data.activity_id}`;
    }
  };

  const handleError = (message: string) => {
    setErrorMessage(message);
    toast.error('Update failed', message.slice(0, 140));
  };

  const Header = (
    <div className="flex items-center justify-between gap-3 px-1 pb-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <Link href="/dashboard" className="flex-shrink-0">
          <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-white text-xs font-medium text-[var(--foreground-muted)] hover:text-foreground hover:border-primary/40 transition-colors">
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back
          </button>
        </Link>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {topic || 'Activity Builder'}
          </p>
          <p className="text-[11px] text-[var(--foreground-muted)] truncate">
            Iterate via chat · Gemini regenerates and Daytona redeploys
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <VersionDropdown
          key={`vd-${versionBump}`}
          activityId={activityId}
          studentId={studentId}
          onRestore={handleVersionRestore}
        />
        <button
          type="button"
          onClick={() => setDiffOpen(true)}
          title="Compare versions"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-white text-xs font-medium text-[var(--foreground-muted)] hover:text-foreground hover:border-primary/40"
        >
          <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
          Diff
        </button>
        <button
          type="button"
          onClick={() => setAlignmentOpen(true)}
          disabled={!studentId}
          title={studentId ? 'Check alignment' : 'Select a student first'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-white text-xs font-medium text-[var(--foreground-muted)] hover:text-foreground hover:border-primary/40 disabled:opacity-50"
        >
          <AcademicCapIcon className="w-3.5 h-3.5" />
          Align
        </button>
        <button
          type="button"
          onClick={() => setAdaptOpen(true)}
          title="Adapt for another student"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-white text-xs font-medium text-[var(--foreground-muted)] hover:text-foreground hover:border-primary/40"
        >
          <UserGroupIcon className="w-3.5 h-3.5" />
          Adapt
        </button>
        {onExitToForm && (
          <button
            type="button"
            onClick={onExitToForm}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark text-white text-xs font-semibold hover:shadow-md hover:shadow-primary/25 transition-all"
          >
            <BoltIcon className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-[calc(100vh-7rem)]"
      >
        {Header}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="h-1/2 min-h-[240px]">
            <PreviewPane
              sandboxUrl={sandboxUrl}
              status={deploymentStatus}
              stage={stage}
              errorMessage={errorMessage}
              activityId={activityId}
              studentId={studentId}
              tutorId={tutorId}
            />
          </div>
          <div className="flex-1 min-h-[280px]">
            <BuilderChat
              activityId={activityId}
              tutorId={tutorId}
              studentId={studentId}
              tutorName={tutorName}
              onStageChange={handleStageChange}
              onCodeUpdate={handleCodeUpdate}
              onError={handleError}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-7rem)]"
    >
      {Header}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={38} minSize={26} maxSize={60}>
            <div className="h-full pr-1.5">
              <BuilderChat
                activityId={activityId}
                tutorId={tutorId}
                studentId={studentId}
                tutorName={tutorName}
                onStageChange={handleStageChange}
                onCodeUpdate={handleCodeUpdate}
                onError={handleError}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle direction="horizontal" />
          <ResizablePanel defaultSize={62} minSize={30}>
            <div className="h-full pl-1.5">
              <PreviewPane
                sandboxUrl={sandboxUrl}
                status={deploymentStatus}
                stage={stage}
                errorMessage={errorMessage}
                activityId={activityId}
                studentId={studentId}
                tutorId={tutorId}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <DiffDrawer activityId={activityId} open={diffOpen} onClose={() => setDiffOpen(false)} />
      <AdaptModal
        open={adaptOpen}
        onClose={() => setAdaptOpen(false)}
        sourceActivityId={activityId}
        tutorId={tutorId}
        currentStudentId={studentId}
        onAdapted={handleAdapted}
      />
      <AlignmentDrawer
        open={alignmentOpen}
        onClose={() => setAlignmentOpen(false)}
        activityId={activityId}
        studentId={studentId}
      />
    </motion.div>
  );
}
