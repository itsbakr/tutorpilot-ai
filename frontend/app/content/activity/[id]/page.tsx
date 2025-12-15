'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { VersionHistory } from '@/components/content/VersionHistory';
import { SelfEvaluationCard } from '@/components/SelfEvaluationCard';
import { activityApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { ContentVersion, SelfEvaluation } from '@/lib/types';
import {
  ArrowLeftIcon,
  CodeBracketIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

type ActivityRow = {
  id: string;
  title?: string;
  topic?: string;
  content?: { code?: string };
  self_evaluation?: SelfEvaluation | null;
  sandbox_url?: string | null;
  created_at?: string;
  student_id?: string;
  tutor_id?: string;
};

export default function ActivityDetailPage() {
  const params = useParams();
  const toast = useToast();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('activities')
          .select('id,title,topic,content,self_evaluation,sandbox_url,created_at,student_id,tutor_id')
          .eq('id', id)
          .single();
        if (error) throw error;
        setActivity(data as ActivityRow);

        const versionsRes = await activityApi.getVersions(id);
        setVersions((versionsRes?.versions || []) as ContentVersion[]);
      } catch (err: any) {
        toast.error('Could not load activity', err?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    };
    if (id) run();
  }, [id, toast]);

  if (loading) return <PageLoader message="Loading activity…" />;
  if (!activity) return null;

  const currentCode = activity.content?.code || '';
  const selectedCode =
    selectedVersion?.content && (selectedVersion.content as any).content
      ? String((selectedVersion.content as any).content)
      : null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <CodeBracketIcon className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Activity</h1>
            </div>
            <p className="text-[var(--foreground-muted)] mt-1 line-clamp-2">
              {activity.title || activity.topic || 'Untitled Activity'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/library">
              <Button variant="secondary" leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
                Back to Library
              </Button>
            </Link>
            <Link href={`/activity?id=${activity.id}`}>
              <Button variant="gradient" rightIcon={<PencilSquareIcon className="w-4 h-4" />}>
                Open in Creator
              </Button>
            </Link>
            {activity.sandbox_url && (
              <a href={activity.sandbox_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">Open Sandbox</Button>
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <GlassCard padding="lg">
              <h2 className="text-lg font-bold text-foreground mb-4">Current Code</h2>
              <pre className="code-block">{currentCode || '// No code found'}</pre>
            </GlassCard>

            {activity.self_evaluation && (
              <SelfEvaluationCard evaluation={activity.self_evaluation} agentName="Activity Creator" />
            )}

            {selectedVersion && (
              <GlassCard padding="lg">
                <h2 className="text-lg font-bold text-foreground mb-2">
                  Preview Version {selectedVersion.version_number}
                </h2>
                {selectedVersion.edit_notes && (
                  <p className="text-sm text-[var(--foreground-muted)] mb-4">{selectedVersion.edit_notes}</p>
                )}
                <pre className="code-block">
                  {selectedCode ? selectedCode : JSON.stringify(selectedVersion.content, null, 2)}
                </pre>
              </GlassCard>
            )}
          </div>

          <div className="space-y-6">
            <VersionHistory
              title="Activity Versions"
              versions={versions}
              selectedVersionNumber={selectedVersion?.version_number}
              onSelectVersion={setSelectedVersion}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}


