'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowPathIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adaptApi, dataApi } from '@/lib/api';

interface Student {
  id: string;
  name: string;
  grade: string;
}

interface AdaptModalProps {
  open: boolean;
  onClose: () => void;
  sourceActivityId: string;
  tutorId: string;
  currentStudentId?: string;
  onAdapted?: (data: { activity_id: string; sandbox_url?: string }) => void;
}

export function AdaptModal({
  open,
  onClose,
  sourceActivityId,
  tutorId,
  currentStudentId,
  onAdapted,
}: AdaptModalProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [adapting, setAdapting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await dataApi.getStudents();
        if (!cancelled) {
          setStudents((res.students || []).filter((s: Student) => s.id !== currentStudentId));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentStudentId]);

  const handlePick = async (student: Student) => {
    setAdapting(true);
    try {
      const result = await adaptApi.adapt({
        source_activity_id: sourceActivityId,
        target_student_id: student.id,
        tutor_id: tutorId,
      });
      onAdapted?.(result);
      onClose();
    } catch (err) {
      console.error('Adapt failed', err);
    } finally {
      setAdapting(false);
    }
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 rounded-2xl bg-white border border-[var(--card-border)] shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Adapt for another student</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background-secondary)]">
            <XMarkIcon className="w-4 h-4 text-[var(--foreground-muted)]" />
          </button>
        </header>

        <div className="p-4">
          {adapting && (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-5 h-5 text-primary animate-spin mr-2" />
              <p className="text-sm text-foreground">
                Rewriting for the new student and deploying…
              </p>
            </div>
          )}
          {!adapting && (
            <>
              <p className="text-xs text-[var(--foreground-muted)] mb-3">
                Pick a student. Gemini will swap names, examples, and difficulty for them — the
                learning objective stays the same. A new activity will be created and linked back
                to this one.
              </p>
              {loading ? (
                <p className="text-xs text-[var(--foreground-muted)] text-center py-6">
                  Loading students…
                </p>
              ) : students.length === 0 ? (
                <p className="text-xs text-[var(--foreground-muted)] text-center py-6">
                  No other students found.
                </p>
              ) : (
                <ul className="space-y-1 max-h-72 overflow-y-auto">
                  {students.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => handlePick(s)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--card-border)] hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                        <span className="text-[11px] text-[var(--foreground-muted)]">
                          Grade {s.grade}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
