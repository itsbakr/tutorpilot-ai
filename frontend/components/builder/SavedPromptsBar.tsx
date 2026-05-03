'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookmarkIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { tutorApi, type SavedPrompt } from '@/lib/api';

interface SavedPromptsBarProps {
  tutorId: string;
  onPick: (prompt: string, id: string) => void;
  draftPrompt?: string;
  disabled?: boolean;
}

export function SavedPromptsBar({
  tutorId,
  onPick,
  draftPrompt,
  disabled,
}: SavedPromptsBarProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [editing, setEditing] = useState<SavedPrompt | null>(null);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!tutorId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await tutorApi.listSavedPrompts(tutorId);
        if (!cancelled) setPrompts(list);
      } catch (err) {
        console.error('Failed to load saved prompts', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  const openSave = (initial?: string) => {
    setEditing(null);
    setLabel('');
    setText(initial || draftPrompt || '');
    setShowSave(true);
  };

  const openEdit = (p: SavedPrompt) => {
    setEditing(p);
    setLabel(p.label);
    setText(p.prompt);
    setShowSave(true);
  };

  const handleSave = async () => {
    if (!label.trim() || !text.trim()) return;
    try {
      if (editing) {
        const updated = await tutorApi.updateSavedPrompt(editing.id, {
          label: label.trim(),
          prompt: text.trim(),
        });
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await tutorApi.createSavedPrompt(tutorId, {
          label: label.trim(),
          prompt: text.trim(),
        });
        setPrompts((prev) => [created, ...prev]);
      }
      setShowSave(false);
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tutorApi.deleteSavedPrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleUse = async (p: SavedPrompt) => {
    onPick(p.prompt, p.id);
    setPrompts((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, use_count: x.use_count + 1, last_used_at: new Date().toISOString() }
          : x
      )
    );
    tutorApi.recordSavedPromptUse(p.id).catch(() => {});
  };

  if (prompts.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => openSave()}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-dashed border-[var(--card-border)] text-[var(--foreground-muted)] hover:text-primary hover:border-primary/40 disabled:opacity-40"
          title="Save your favorite phrasings as chips"
        >
          <BookmarkIcon className="w-3.5 h-3.5" />
          Save a prompt
        </button>
        <SaveModal
          open={showSave}
          onClose={() => setShowSave(false)}
          label={label}
          text={text}
          onLabel={setLabel}
          onText={setText}
          onSave={handleSave}
          editing={!!editing}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {prompts.map((p) => (
          <PromptChip
            key={p.id}
            prompt={p}
            disabled={disabled}
            onUse={() => handleUse(p)}
            onEdit={() => openEdit(p)}
            onDelete={() => handleDelete(p.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => openSave()}
          disabled={disabled}
          className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-dashed border-[var(--card-border)] text-[var(--foreground-muted)] hover:text-primary hover:border-primary/40 disabled:opacity-40"
          title="Save current message as a chip"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Save
        </button>
      </div>

      <SaveModal
        open={showSave}
        onClose={() => setShowSave(false)}
        label={label}
        text={text}
        onLabel={setLabel}
        onText={setText}
        onSave={handleSave}
        editing={!!editing}
      />
    </>
  );
}

function PromptChip({
  prompt,
  disabled,
  onUse,
  onEdit,
  onDelete,
}: {
  prompt: SavedPrompt;
  disabled?: boolean;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onUse}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border border-[var(--card-border)] bg-white text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors disabled:opacity-40"
        title={prompt.prompt}
      >
        <BookmarkIcon className="w-3 h-3 text-[var(--accent)]" />
        {prompt.label}
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="ml-0.5 p-0.5 text-[var(--foreground-muted)] hover:text-foreground"
        title="More"
      >
        <span className="block w-3 text-[10px] leading-none">⋯</span>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute bottom-full mb-1 right-0 z-40 w-32 rounded-lg border border-[var(--card-border)] bg-white shadow-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-[var(--background-secondary)]"
              >
                <PencilIcon className="w-3 h-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50"
              >
                <TrashIcon className="w-3 h-3" />
                Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SaveModal({
  open,
  onClose,
  label,
  text,
  onLabel,
  onText,
  onSave,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  text: string;
  onLabel: (v: string) => void;
  onText: (v: string) => void;
  onSave: () => void;
  editing: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 rounded-2xl bg-white border border-[var(--card-border)] shadow-2xl p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground">
            {editing ? 'Edit saved prompt' : 'Save a prompt'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--background-secondary)]">
            <XMarkIcon className="w-4 h-4 text-[var(--foreground-muted)]" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--foreground-muted)] mb-1">
              Chip label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => onLabel(e.target.value)}
              placeholder="e.g. Add a sound effect"
              maxLength={40}
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--foreground-muted)] mb-1">
              Full prompt
            </label>
            <textarea
              value={text}
              onChange={(e) => onText(e.target.value)}
              rows={4}
              placeholder="What should the AI do when this chip is clicked?"
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!label.trim() || !text.trim()}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {editing ? 'Save changes' : 'Save chip'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
