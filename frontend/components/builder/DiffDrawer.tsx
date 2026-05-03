'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { diffLines } from 'diff';
import { ArrowsRightLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { versionsApi, type ActivityVersion } from '@/lib/api';

interface DiffDrawerProps {
  activityId: string;
  open: boolean;
  onClose: () => void;
}

export function DiffDrawer({ activityId, open, onClose }: DiffDrawerProps) {
  const [versions, setVersions] = useState<ActivityVersion[]>([]);
  const [aId, setAId] = useState<string>('');
  const [bId, setBId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await versionsApi.list(activityId);
        if (cancelled) return;
        setVersions(list);
        if (list.length >= 2) {
          setAId(list[1].id);
          setBId(list[0].id);
        } else if (list.length === 1) {
          setAId(list[0].id);
          setBId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load versions', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activityId]);

  const a = versions.find((v) => v.id === aId);
  const b = versions.find((v) => v.id === bId);

  const lines = useMemo(() => {
    if (!a || !b) return [];
    return diffLines(a.code, b.code);
  }, [a, b]);

  const stats = useMemo(() => {
    let added = 0, removed = 0;
    lines.forEach((l) => {
      if (l.added) added += l.count || 0;
      if (l.removed) removed += l.count || 0;
    });
    return { added, removed };
  }, [lines]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-3xl bg-white border-l border-[var(--card-border)] shadow-2xl z-[90] flex flex-col"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <ArrowsRightLeftIcon className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Compare versions</h2>
                {(stats.added > 0 || stats.removed > 0) && (
                  <span className="text-[11px] text-[var(--foreground-muted)] ml-2">
                    <span className="text-[var(--success)]">+{stats.added}</span>{' '}
                    <span className="text-red-500">-{stats.removed}</span>
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background-secondary)]">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </header>

            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50">
              <VersionPicker label="From" value={aId} onChange={setAId} versions={versions} />
              <ArrowsRightLeftIcon className="w-3.5 h-3.5 text-[var(--foreground-muted)]" />
              <VersionPicker label="To" value={bId} onChange={setBId} versions={versions} />
            </div>

            <div className="flex-1 overflow-auto bg-[var(--background-secondary)]/30">
              {lines.length === 0 || !a || !b ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--foreground-muted)]">
                  Pick two versions to compare.
                </div>
              ) : (
                <pre className="text-[11px] font-mono leading-relaxed">
                  {lines.map((part, i) => {
                    const bg = part.added ? 'bg-green-50' : part.removed ? 'bg-red-50' : '';
                    const border = part.added
                      ? 'border-l-2 border-[var(--success)]'
                      : part.removed
                      ? 'border-l-2 border-red-500'
                      : 'border-l-2 border-transparent';
                    const prefix = part.added ? '+' : part.removed ? '−' : ' ';
                    return (
                      <div key={i} className={`${bg} ${border}`}>
                        {part.value
                          .split('\n')
                          .filter((_, idx, arr) => idx < arr.length - 1 || _.length > 0)
                          .map((line, j) => (
                            <div key={j} className="px-3 py-0.5">
                              <span className="text-[var(--foreground-muted)] inline-block w-4">
                                {prefix}
                              </span>
                              <span>{line}</span>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </pre>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function VersionPicker({
  label,
  value,
  onChange,
  versions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  versions: ActivityVersion[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-[var(--foreground-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-1.5 py-1 rounded border border-[var(--card-border)] bg-white"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            v{v.version_number}
            {v.label ? ` · ${v.label}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
