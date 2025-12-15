'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { ContentVersion } from '@/lib/types';
import { ClockIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

export function VersionHistory({
  title = 'Version History',
  versions,
  selectedVersionNumber,
  onSelectVersion,
}: {
  title?: string;
  versions: ContentVersion[];
  selectedVersionNumber?: number;
  onSelectVersion: (version: ContentVersion) => void;
}) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <GlassCard padding="lg">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="text-sm text-[var(--foreground-muted)]">
            Each save creates a new version with notes. Click a version to preview.
          </p>
        </div>
        <span className="badge badge-neutral">{versions.length} versions</span>
      </div>

      {versions.length === 0 ? (
        <div className="p-6 rounded-2xl bg-[var(--background-secondary)] border border-[var(--card-border)] text-center">
          <p className="text-sm text-[var(--foreground-muted)]">No versions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => {
            const isSelected = selectedVersionNumber === v.version_number;
            return (
              <button
                key={v.version_number}
                type="button"
                onClick={() => onSelectVersion(v)}
                className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                  isSelected
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-[var(--background-secondary)] border-[var(--card-border)] hover:bg-white hover:border-primary/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      Version {v.version_number}
                      {v.edit_type ? (
                        <span className="ml-2 text-xs font-semibold text-[var(--foreground-muted)]">
                          · {v.edit_type}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                      <ClockIcon className="w-4 h-4" />
                      <span>{formatDate(v.created_at)}</span>
                    </div>
                    {(v.changes_summary || v.edit_notes) && (
                      <p className="mt-2 text-sm text-[var(--foreground-secondary)] line-clamp-2">
                        {v.changes_summary || v.edit_notes}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <Button variant="secondary" size="sm" className="pointer-events-none">
                      <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}


