'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUturnLeftIcon,
  BookmarkIcon,
  CheckIcon,
  ClockIcon,
  PencilIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { versionsApi, type ActivityVersion } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface VersionDropdownProps {
  activityId: string;
  studentId?: string;
  onRestore?: (data: { code: string; sandbox_url?: string }) => void;
}

export function VersionDropdown({ activityId, studentId, onRestore }: VersionDropdownProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<ActivityVersion[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  const refresh = async () => {
    try {
      const list = await versionsApi.list(activityId);
      setVersions(list);
    } catch (err) {
      console.error('Failed to load versions', err);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open, activityId]);

  const current = versions[0];

  const handleRestore = async (v: ActivityVersion) => {
    // Capture the previous "current" so we can offer Undo.
    const previousCurrent = versions[0];
    try {
      const res = await versionsApi.restore(v.id);
      onRestore?.({ code: res.code, sandbox_url: res.sandbox_url });
      setOpen(false);
      toast.info(
        `Restored v${v.version_number}`,
        v.label ? `"${v.label}" is now live in the sandbox.` : 'This version is now live.',
        previousCurrent && previousCurrent.id !== v.id
          ? {
              label: `Undo (back to v${previousCurrent.version_number})`,
              onClick: async () => {
                try {
                  const back = await versionsApi.restore(previousCurrent.id);
                  onRestore?.({ code: back.code, sandbox_url: back.sandbox_url });
                  toast.info(
                    `Back to v${previousCurrent.version_number}`,
                    'Undo complete.'
                  );
                } catch (e) {
                  console.error('Undo restore failed', e);
                }
              },
            }
          : undefined
      );
    } catch (err) {
      console.error('Restore failed', err);
      toast.error('Restore failed', 'Please try again.');
    }
  };

  const handlePin = async (v: ActivityVersion) => {
    if (!studentId) return;
    const wasPinned = v.pinned_for_student_id === studentId;
    const previouslyPinned = versions.find(
      (p) => p.pinned_for_student_id === studentId && p.id !== v.id
    );
    try {
      const updated = await versionsApi.pin(v.id, wasPinned ? null : studentId);
      setVersions((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? updated
            : p.pinned_for_student_id === studentId
            ? { ...p, pinned_for_student_id: undefined }
            : p
        )
      );
      const undo = {
        label: 'Undo',
        onClick: async () => {
          try {
            await versionsApi.pin(v.id, wasPinned ? studentId : null);
            if (previouslyPinned && !wasPinned) {
              await versionsApi.pin(previouslyPinned.id, studentId);
            }
            // refresh
            const list = await versionsApi.list(activityId);
            setVersions(list);
          } catch (e) {
            console.error('Undo pin failed', e);
          }
        },
      };
      if (wasPinned) {
        toast.info(`Unpinned v${v.version_number}`, 'No version is pinned for this student.', undo);
      } else {
        toast.info(`Pinned v${v.version_number}`, 'This version will load for this student.', undo);
      }
    } catch (err) {
      console.error('Pin failed', err);
      toast.error('Pin failed', 'Please try again.');
    }
  };

  const handleSaveLabel = async (id: string) => {
    try {
      const updated = await versionsApi.label(id, labelDraft.trim());
      setVersions((prev) => prev.map((v) => (v.id === id ? updated : v)));
      setEditing(null);
    } catch (err) {
      console.error('Label failed', err);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-white text-xs font-medium text-[var(--foreground-muted)] hover:text-foreground hover:border-primary/40 transition-colors"
        title="Version history"
      >
        <ClockIcon className="w-3.5 h-3.5" />
        {current ? `v${current.version_number}${current.label ? ` · ${current.label}` : ''}` : 'No versions'}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              className="absolute top-full mt-1 left-0 z-40 w-80 max-h-96 overflow-y-auto rounded-xl border border-[var(--card-border)] bg-white shadow-xl"
            >
              <div className="px-3 py-2 border-b border-[var(--card-border)] text-[10px] uppercase tracking-wider font-bold text-[var(--foreground-muted)]">
                Version history
              </div>
              {versions.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--foreground-muted)]">
                  No saved versions yet. Each chat iteration creates a snapshot.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--card-border)]">
                  {versions.map((v, idx) => {
                    const isPinned = !!v.pinned_for_student_id && v.pinned_for_student_id === studentId;
                    return (
                      <li key={v.id} className="p-2.5 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">v{v.version_number}</span>
                              {idx === 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                                  current
                                </span>
                              )}
                              {isPinned && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent-dark)] text-[10px] font-semibold">
                                  <StarSolidIcon className="w-2.5 h-2.5" />
                                  pinned
                                </span>
                              )}
                            </div>
                            {editing === v.id ? (
                              <div className="flex items-center gap-1 mt-1">
                                <input
                                  type="text"
                                  value={labelDraft}
                                  onChange={(e) => setLabelDraft(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveLabel(v.id);
                                    if (e.key === 'Escape') setEditing(null);
                                  }}
                                  className="flex-1 px-1.5 py-0.5 text-xs rounded border border-primary/40 focus:outline-none"
                                  placeholder="Add a label…"
                                  maxLength={40}
                                />
                                <button
                                  onClick={() => handleSaveLabel(v.id)}
                                  className="p-0.5 text-primary hover:bg-primary/10 rounded"
                                >
                                  <CheckIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--foreground-muted)] mt-0.5 truncate">
                                {v.label || <span className="italic opacity-60">no label</span>}
                              </p>
                            )}
                            <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
                              {new Date(v.created_at).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditing(v.id);
                                setLabelDraft(v.label || '');
                              }}
                              title="Edit label"
                              className="p-1 rounded hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)]"
                            >
                              <PencilIcon className="w-3 h-3" />
                            </button>
                            {studentId && (
                              <button
                                onClick={() => handlePin(v)}
                                title={isPinned ? 'Unpin for this student' : 'Pin for this student'}
                                className="p-1 rounded hover:bg-[var(--accent)]/10 text-[var(--foreground-muted)] hover:text-[var(--accent-dark)]"
                              >
                                {isPinned ? (
                                  <StarSolidIcon className="w-3 h-3 text-[var(--accent)]" />
                                ) : (
                                  <StarIcon className="w-3 h-3" />
                                )}
                              </button>
                            )}
                            {idx !== 0 && (
                              <button
                                onClick={() => handleRestore(v)}
                                title="Restore this version"
                                className="p-1 rounded hover:bg-primary/10 text-[var(--foreground-muted)] hover:text-primary"
                              >
                                <ArrowUturnLeftIcon className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
