'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AcademicCapIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { alignmentApi, type AlignmentCheck } from '@/lib/api';

interface AlignmentDrawerProps {
  open: boolean;
  onClose: () => void;
  activityId: string;
  studentId?: string;
}

interface Standard {
  id: string;
  code: string;
  framework: string;
  description: string;
}

const AXIS_LABELS: Record<string, string> = {
  age: 'Age & grade fit',
  objectives: "Aligned to student's objectives",
  standard: 'Curriculum standard alignment',
};

export function AlignmentDrawer({ open, onClose, activityId, studentId }: AlignmentDrawerProps) {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [standardId, setStandardId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, AlignmentCheck>>({});

  useEffect(() => {
    if (!open) return;
    alignmentApi.listStandards().then(setStandards).catch(console.error);
    setResults({});
  }, [open]);

  const run = async () => {
    if (!studentId) return;
    setRunning(true);
    setResults({});
    try {
      await alignmentApi.check(
        activityId,
        { student_id: studentId, standard_id: standardId || undefined },
        (evt) => {
          setResults((prev) => ({ ...prev, [evt.axis]: evt }));
        }
      );
    } catch (err) {
      console.error('Alignment failed', err);
    } finally {
      setRunning(false);
    }
  };

  const expectedAxes = ['age', 'objectives', ...(standardId ? ['standard'] : [])];

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
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white border-l border-[var(--card-border)] shadow-2xl z-[90] flex flex-col"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <AcademicCapIcon className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Alignment check</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background-secondary)]">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </header>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground-muted)] mb-1">
                  Curriculum standard (optional)
                </label>
                <select
                  value={standardId}
                  onChange={(e) => setStandardId(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-[var(--card-border)] text-xs bg-white"
                >
                  <option value="">— skip standards check —</option>
                  {standards.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} ({s.framework})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={run}
                disabled={running || !studentId}
                className="w-full px-3 py-2 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {running ? 'Checking…' : 'Run alignment check'}
              </button>

              <div className="space-y-2 pt-2">
                {expectedAxes.map((axis) => {
                  const result = results[axis];
                  return (
                    <ResultCard
                      key={axis}
                      axis={axis}
                      result={result}
                      pending={running && !result}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ResultCard({
  axis,
  result,
  pending,
}: {
  axis: string;
  result?: AlignmentCheck;
  pending?: boolean;
}) {
  const StatusIcon =
    result?.status === 'pass'
      ? CheckCircleIcon
      : result?.status === 'fail'
      ? XCircleIcon
      : ExclamationTriangleIcon;
  const color =
    result?.status === 'pass'
      ? 'text-[var(--success)] border-[var(--success)]/30 bg-[var(--success-bg)]'
      : result?.status === 'fail'
      ? 'text-red-600 border-red-200 bg-red-50'
      : 'text-[var(--accent-dark)] border-[var(--accent)]/30 bg-[var(--accent-bg)]';

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        result ? color : 'border-[var(--card-border)] bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        {result ? (
          <StatusIcon className="w-4 h-4 flex-shrink-0" />
        ) : pending ? (
          <span className="w-4 h-4 inline-block rounded-full border-2 border-primary border-t-transparent animate-spin" />
        ) : (
          <span className="w-4 h-4 rounded-full border border-dashed border-[var(--card-border)]" />
        )}
        <p className="text-xs font-bold">{AXIS_LABELS[axis] || axis}</p>
        {result && (
          <span className="ml-auto text-[10px] uppercase font-bold tracking-wider">
            {result.status}
          </span>
        )}
      </div>
      {result?.reasoning && (
        <p className="text-xs mt-1.5 leading-relaxed opacity-90">{result.reasoning}</p>
      )}
    </div>
  );
}
