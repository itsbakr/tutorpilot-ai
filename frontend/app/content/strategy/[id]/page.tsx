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
import { strategyApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { ContentVersion, StrategyContent, SelfEvaluation } from '@/lib/types';
import { formatStrategyToHTML } from '@/lib/strategyFormatter';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

type StrategyRow = {
  id: string;
  title: string;
  content: StrategyContent;
  self_evaluation?: SelfEvaluation | null;
  created_at?: string;
  student_id?: string;
  tutor_id?: string;
};

export default function StrategyDetailPage() {
  const params = useParams();
  const toast = useToast();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('strategies')
          .select('id,title,content,self_evaluation,created_at,student_id,tutor_id')
          .eq('id', id)
          .single();
        if (error) throw error;
        setStrategy(data as StrategyRow);

        const versionsRes = await strategyApi.getVersions(id);
        setVersions((versionsRes?.versions || []) as ContentVersion[]);
      } catch (err: any) {
        toast.error('Could not load strategy', err?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    };
    if (id) run();
  }, [id, toast]);

  if (loading) return <PageLoader message="Loading strategy…" />;
  if (!strategy) return null;

  const currentHtml = formatStrategyToHTML(strategy.content?.content || '');

  const selectedHtml =
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
                <DocumentTextIcon className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Strategy</h1>
            </div>
            <p className="text-[var(--foreground-muted)] mt-1 line-clamp-2">{strategy.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/library">
              <Button variant="secondary" leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
                Back to Library
              </Button>
            </Link>
            <Link href={`/strategy?id=${strategy.id}`}>
              <Button variant="gradient" rightIcon={<PencilSquareIcon className="w-4 h-4" />}>
                Open in Creator
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <GlassCard padding="lg">
              <h2 className="text-lg font-bold text-foreground mb-4">Current Content</h2>
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentHtml }}
              />
            </GlassCard>

            {strategy.self_evaluation && (
              <SelfEvaluationCard evaluation={strategy.self_evaluation} agentName="Strategy Planner" />
            )}

            {selectedVersion && (
              <GlassCard padding="lg">
                <h2 className="text-lg font-bold text-foreground mb-2">
                  Preview Version {selectedVersion.version_number}
                </h2>
                {selectedVersion.edit_notes && (
                  <p className="text-sm text-[var(--foreground-muted)] mb-4">{selectedVersion.edit_notes}</p>
                )}
                {selectedHtml ? (
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedHtml }} />
                ) : (
                  <pre className="code-block">{JSON.stringify(selectedVersion.content, null, 2)}</pre>
                )}
              </GlassCard>
            )}
          </div>

          <div className="space-y-6">
            <VersionHistory
              title="Strategy Versions"
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


