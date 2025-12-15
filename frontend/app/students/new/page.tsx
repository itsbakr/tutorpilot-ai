'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StudentForm, type StudentFormValues } from '@/components/students/StudentForm';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeftIcon, UserPlusIcon } from '@heroicons/react/24/outline';

export default function NewStudentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: StudentFormValues) => {
    setLoading(true);
    try {
      const tutorId = user?.tutor_id || user?.id;
      if (!tutorId) throw new Error('Missing tutor id');

      const { error: insertError } = await supabase.from('students').insert({
        tutor_id: tutorId,
        name: values.name,
        grade: values.grade,
        subject: values.subject,
        learning_style: values.learning_style,
        nationality: values.nationality || null,
        residence: values.residence || null,
        languages: values.languages,
        interests: values.interests,
        objectives: values.objectives,
      });

      if (insertError) throw insertError;

      toast.success('Student created', `${values.name} is ready.`);
      router.push('/students');
    } catch (err: any) {
      toast.error('Could not create student', err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
          <Link
            href="/students"
              className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
              aria-label="Back to students"
          >
              <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </Link>

              <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <UserPlusIcon className="w-5 h-5 text-primary" />
              </div>
                <h1 className="text-2xl font-bold text-foreground">Add Student</h1>
              </div>
              <p className="text-[var(--foreground-muted)] mt-1">Create a personalized learning profile.</p>
            </div>
              </div>
            </div>
            
        <StudentForm
          mode="create"
          submitLabel="Create Student"
          loading={loading}
          onCancel={() => router.push('/students')}
          onSubmit={handleSubmit}
        />
      </div>
    </AppShell>
  );
}




