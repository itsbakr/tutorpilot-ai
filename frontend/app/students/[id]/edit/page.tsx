'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StudentForm, type StudentFormValues } from '@/components/students/StudentForm';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

type StudentRow = {
  id: string;
  name: string;
  grade: string;
  subject: string;
  learning_style: string;
  nationality?: string | null;
  residence?: string | null;
  languages?: string[] | null;
  interests?: string[] | null;
  objectives?: string[] | null;
};

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const studentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<StudentRow | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase.from('students').select('*').eq('id', studentId).single();
        if (error) throw error;
        setStudent(data as StudentRow);
      } catch (err: any) {
        toast.error('Could not load student', err?.message || 'Please try again.');
        router.push('/students');
      } finally {
        setLoading(false);
      }
    };
    if (studentId) run();
  }, [router, studentId, toast]);

  const handleSubmit = async (values: StudentFormValues) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: values.name,
          grade: values.grade,
          subject: values.subject,
          learning_style: values.learning_style,
          nationality: values.nationality || null,
          residence: values.residence || null,
          languages: values.languages,
          interests: values.interests,
          objectives: values.objectives,
        })
        .eq('id', studentId);

      if (error) throw error;

      toast.success('Student updated', `${values.name} has been saved.`);
      router.push(`/students/${studentId}`);
    } catch (err: any) {
      toast.error('Could not save changes', err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader message="Loading student..." />;
  if (!student) return null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/students/${studentId}`}
              className="p-2 rounded-xl hover:bg-[var(--background-secondary)] transition-colors"
              aria-label="Back to student"
            >
              <ArrowLeftIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <PencilSquareIcon className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Edit Student</h1>
              </div>
              <p className="text-[var(--foreground-muted)] mt-1">Update {student.name}&apos;s learning profile.</p>
            </div>
          </div>
        </div>

        <StudentForm
          mode="edit"
          submitLabel="Save Changes"
          loading={saving}
          initialValues={{
            name: student.name,
            grade: student.grade,
            subject: student.subject,
            learning_style: student.learning_style,
            nationality: student.nationality || '',
            residence: student.residence || '',
            languages: student.languages || [],
            interests: student.interests || [],
            objectives: student.objectives || [],
          }}
          onCancel={() => router.push(`/students/${studentId}`)}
          onSubmit={handleSubmit}
        />
      </div>
    </AppShell>
  );
}


