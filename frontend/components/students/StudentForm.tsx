'use client';

import { useMemo, useState } from 'react';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  AcademicCapIcon,
  BookOpenIcon,
  LightBulbIcon,
  GlobeAltIcon,
  HeartIcon,
  PlusIcon,
  FlagIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export type StudentFormValues = {
  name: string;
  grade: string;
  subject: string;
  learning_style: string;
  nationality: string;
  residence: string;
  languages: string[];
  interests: string[];
  objectives: string[];
};

const LEARNING_STYLES: Array<{
  value: StudentFormValues['learning_style'];
  label: string;
  description: string;
  emoji: string;
}> = [
  { value: 'Visual', label: 'Visual', description: 'Learns best through images, diagrams, and videos', emoji: '🖼️' },
  { value: 'Auditory', label: 'Auditory', description: 'Learns best through listening and discussion', emoji: '🎧' },
  { value: 'Kinesthetic', label: 'Kinesthetic', description: 'Learns best through hands-on activities', emoji: '🧩' },
  { value: 'Reading/Writing', label: 'Reading/Writing', description: 'Learns best through reading and writing', emoji: '✍️' },
];

const SUBJECTS = [
  'Physics',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Computer Science',
  'English',
  'History',
  'Geography',
];

const GRADES = ['6', '7', '8', '9', '10', '11', '12'];

function TagInput({
  label,
  placeholder,
  value,
  onChange,
  tone = 'neutral',
}: {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
  tone?: 'neutral' | 'blue' | 'pink' | 'green';
}) {
  const [draft, setDraft] = useState('');

  const toneClasses = {
    neutral: 'bg-[var(--background-tertiary)] text-[var(--foreground-secondary)]',
    blue: 'bg-blue-50 text-blue-700',
    pink: 'bg-pink-50 text-pink-700',
    green: 'bg-emerald-50 text-emerald-700',
  } as const;

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add} className="shrink-0">
          <PlusIcon className="w-5 h-5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${toneClasses[tone]}`}
            >
              {item}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="p-0.5 rounded-full hover:bg-black/5 transition-colors"
                aria-label={`Remove ${item}`}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentForm({
  mode,
  initialValues,
  submitLabel,
  loading,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initialValues?: Partial<StudentFormValues>;
  submitLabel: string;
  loading: boolean;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const defaults: StudentFormValues = useMemo(
    () => ({
      name: '',
      grade: '',
      subject: '',
      learning_style: 'Visual',
      nationality: '',
      residence: '',
      languages: [],
      interests: [],
      objectives: [],
      ...initialValues,
      languages: initialValues?.languages || [],
      interests: initialValues?.interests || [],
      objectives: initialValues?.objectives || [],
    }),
    [initialValues]
  );

  const [values, setValues] = useState<StudentFormValues>(defaults);

  const subjectOptions = SUBJECTS.map((s) => ({ value: s, label: s }));
  const gradeOptions = GRADES.map((g) => ({ value: g, label: `Grade ${g}` }));

  const canSubmit = values.name.trim() && values.grade && values.subject;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(values);
      }}
      className="space-y-6"
    >
      {/* Basic Info */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Full Name *"
              value={values.name}
              onChange={(e) => setValues((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Alex Chen"
              required
            />
          </div>

          <Select
            label="Grade *"
            options={gradeOptions}
            value={values.grade}
            onChange={(e) => setValues((p) => ({ ...p, grade: e.target.value }))}
            placeholder="Select grade..."
            required
          />

          <Select
            label="Subject *"
            options={subjectOptions}
            value={values.subject}
            onChange={(e) => setValues((p) => ({ ...p, subject: e.target.value }))}
            placeholder="Select subject..."
            required
          />
        </div>
      </section>

      {/* Learning Style */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LightBulbIcon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Learning Style</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEARNING_STYLES.map((style) => {
            const selected = values.learning_style === style.value;
            return (
              <button
                key={style.value}
                type="button"
                onClick={() => setValues((p) => ({ ...p, learning_style: style.value }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-[var(--card-border)] hover:border-primary/30 bg-[var(--background-secondary)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[var(--card-border)]">
                    <span className="text-xl">{style.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{style.label}</p>
                      {selected && (
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1">{style.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Background */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <GlobeAltIcon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Background (Optional)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nationality"
            value={values.nationality}
            onChange={(e) => setValues((p) => ({ ...p, nationality: e.target.value }))}
            placeholder="e.g., Singapore"
          />
          <Input
            label="Residence"
            value={values.residence}
            onChange={(e) => setValues((p) => ({ ...p, residence: e.target.value }))}
            placeholder="e.g., Singapore"
          />
        </div>

        <div className="mt-5">
          <TagInput
            label="Languages"
            placeholder="Add a language..."
            value={values.languages}
            onChange={(next) => setValues((p) => ({ ...p, languages: next }))}
            tone="blue"
          />
        </div>
      </section>

      {/* Interests */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <HeartIcon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Interests & Hobbies</h2>
        </div>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">
          Adding interests helps AI create more engaging, personalized content.
        </p>
        <TagInput
          label="Interests"
          placeholder="e.g., space exploration, video games..."
          value={values.interests}
          onChange={(next) => setValues((p) => ({ ...p, interests: next }))}
          tone="pink"
        />
      </section>

      {/* Objectives */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <FlagIcon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Learning Objectives</h2>
        </div>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">What does this student want to achieve?</p>
        <TagInput
          label="Objectives"
          placeholder="e.g., Ace IGCSE Physics with A*..."
          value={values.objectives}
          onChange={(next) => setValues((p) => ({ ...p, objectives: next }))}
          tone="green"
        />
      </section>

      {/* Submit */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} className="sm:w-40">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="gradient"
          fullWidth
          loading={loading}
          disabled={!canSubmit || loading}
          rightIcon={<AcademicCapIcon className="w-4 h-4" />}
        >
          {submitLabel}
        </Button>
      </div>

      {mode === 'create' && (
        <p className="text-xs text-[var(--foreground-muted)] text-center">
          Tip: You can skip optional fields now and enrich the student profile later.
        </p>
      )}
    </form>
  );
}


