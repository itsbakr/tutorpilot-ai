'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  BoltIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/ResizablePanels';
import { useToast } from '@/components/ui/Toast';
import { BuilderChat, type BuilderChatHandle } from './BuilderChat';
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
  initialCode?: string;
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
  initialCode,
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
  const [currentCode, setCurrentCode] = useState<string>(initialCode || '');
  const supportsSessionRecording = currentCode.includes('tutorpilot:event');
  const [stage, setStage] = useState<DeployStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isMobile, setIsMobile] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [alignmentOpen, setAlignmentOpen] = useState(false);
  const [versionBump, setVersionBump] = useState(0);
  const chatRef = useRef<BuilderChatHandle | null>(null);

  const handleUpgradeRequest = () => {
    chatRef.current?.send(
      'Upgrade this activity to support session recording. Add a `reportEvent(kind, payload)` helper that calls window.parent.postMessage({ type: "tutorpilot:event", kind, payload }, "*"), and emit "answer", "hint", and "completed" events at the appropriate moments. Also read window.location.search for "role" so it defaults to student view.'
    );
    toast.info('Upgrading…', 'The chat is sending the upgrade prompt now.');
  };

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
    setCurrentCode(newCode);
    setVersionBump((b) => b + 1);
    onCodeUpdate?.(newCode, newSandboxUrl);
  };

  const handleVersionSnapshot = (versionNumber: number) => {
    toast.success(
      `Saved as v${versionNumber}`,
      'You can pin or restore from the version history.'
    );
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
        <div className="hidden md:block">
          <VersionDropdown
            key={`vd-${versionBump}`}
            activityId={activityId}
            studentId={studentId}
            onRestore={handleVersionRestore}
          />
        </div>
        <ToolsMenu
          onDiff={() => setDiffOpen(true)}
          onAlign={() => setAlignmentOpen(true)}
          onAdapt={() => setAdaptOpen(true)}
          onVersions={() => {
            // Mobile-only: surface versions inside the Tools menu via DiffDrawer.
            setDiffOpen(true);
          }}
          studentSelected={!!studentId}
        />
        {onExitToForm && (
          <button
            type="button"
            onClick={onExitToForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark text-white text-xs font-semibold hover:shadow-md hover:shadow-primary/25 transition-all"
          >
            <BoltIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New activity</span>
            <span className="sm:hidden">New</span>
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
              supportsSessionRecording={supportsSessionRecording}
              onUpgradeRequest={handleUpgradeRequest}
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
              onVersionSnapshot={handleVersionSnapshot}
              onError={handleError}
              chatRef={chatRef}
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
                onVersionSnapshot={handleVersionSnapshot}
                onError={handleError}
                chatRef={chatRef}
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
                supportsSessionRecording={supportsSessionRecording}
                onUpgradeRequest={handleUpgradeRequest}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <DiffDrawer activityId={activityId} open={diffOpen} onClose={() => setDiffOpen(false)} key={`dd-${versionBump}`} />
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

function ToolsMenu({
  onDiff,
  onAlign,
  onAdapt,
  onVersions,
  studentSelected,
}: {
  onDiff: () => void;
  onAlign: () => void;
  onAdapt: () => void;
  onVersions: () => void;
  studentSelected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-white text-xs font-medium text-[var(--foreground-muted)] hover:text-foreground hover:border-primary/40"
      >
        <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
        Tools
        <ChevronDownIcon className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-xl border border-[var(--card-border)] bg-white shadow-xl overflow-hidden">
            <MenuItem
              icon={<ArrowsRightLeftIcon className="w-3.5 h-3.5" />}
              title="Version history"
              hint="Compare and restore previous versions"
              onClick={wrap(onDiff)}
            />
            <MenuItem
              icon={<AcademicCapIcon className="w-3.5 h-3.5" />}
              title="Check alignment"
              hint={studentSelected ? 'Age, objectives, curriculum standard' : 'Select a student first'}
              onClick={wrap(onAlign)}
              disabled={!studentSelected}
            />
            <MenuItem
              icon={<UserGroupIcon className="w-3.5 h-3.5" />}
              title="Adapt for another student"
              hint="Rewrite names and difficulty for a different student"
              onClick={wrap(onAdapt)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  title,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-[var(--background-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5 ml-5">{hint}</p>
    </button>
  );
}
