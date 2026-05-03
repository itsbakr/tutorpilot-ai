'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckIcon,
  ClipboardDocumentIcon,
  EnvelopeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { recapApi } from '@/lib/api';

interface RecapModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName?: string;
}

const fmtDate = (d: Date) => d.toISOString().split('T')[0];

export function RecapModal({ open, onClose, studentId, studentName }: RecapModalProps) {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [from, setFrom] = useState(fmtDate(weekAgo));
  const [to, setTo] = useState(fmtDate(today));
  const [tone, setTone] = useState<'warm' | 'concise'>('warm');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setDraft(null);
    try {
      const res = await recapApi.generate({
        student_id: studentId,
        from_date: from,
        to_date: to,
        tone,
      });
      setDraft(res);
    } catch (err) {
      console.error('Recap failed', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        className="w-full max-w-lg mx-4 rounded-2xl bg-white border border-[var(--card-border)] shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Parent recap{studentName ? ` for ${studentName}` : ''}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background-secondary)]">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as 'warm' | 'concise')}
                className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] text-xs bg-white"
              >
                <option value="warm">Warm</option>
                <option value="concise">Concise</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full px-3 py-2 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating…' : draft ? 'Regenerate' : 'Generate recap'}
          </button>

          {draft && (
            <div className="rounded-xl border border-[var(--card-border)] p-3 bg-[var(--background-secondary)]/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                  Subject
                </p>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--foreground-muted)] hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-3 h-3" />
                      Copy all
                    </>
                  )}
                </button>
              </div>
              <p className="text-sm font-bold text-foreground mb-3">{draft.subject}</p>
              <p className="text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-1">
                Body
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {draft.body}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
