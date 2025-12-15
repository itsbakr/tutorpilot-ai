'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import { dataApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input, Select } from '@/components/ui/Input';
import { CardSkeleton, PageLoader } from '@/components/ui/LoadingSpinner';
import {
  AcademicCapIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

interface Student {
  id: string;
  name: string;
  grade: string;
  subject: string;
  learning_style: string;
  nationality?: string;
  interests?: string[];
  created_at: string;
}

export default function StudentsPage() {
  const { isLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const response = await dataApi.getStudents();
        setStudents(response.students || []);
      } catch (error) {
        console.error('Failed to load students:', error);
      } finally {
        setLoadingData(false);
      }
    };
    loadStudents();
  }, []);

  // Filter students
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.subject.toLowerCase().includes(q);
      const matchesGrade = !selectedGrade || student.grade === selectedGrade;
      const matchesSubject = !selectedSubject || student.subject === selectedSubject;
      return matchesSearch && matchesGrade && matchesSubject;
    });
  }, [searchQuery, selectedGrade, selectedSubject, students]);

  // Get unique values for filters
  const gradeOptions = useMemo(() => {
    const grades = [...new Set(students.map((s) => s.grade))].sort();
    return [{ value: '', label: 'All grades' }, ...grades.map((g) => ({ value: g, label: `Grade ${g}` }))];
  }, [students]);

  const subjectOptions = useMemo(() => {
    const subjects = [...new Set(students.map((s) => s.subject))].sort();
    return [{ value: '', label: 'All subjects' }, ...subjects.map((s) => ({ value: s, label: s }))];
  }, [students]);

  if (isLoading) {
    return <PageLoader message="Loading..." />;
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <UsersIcon className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Students</h1>
            </div>
            <p className="text-[var(--foreground-muted)] mt-1">Manage profiles and create personalized content.</p>
          </div>

          <Link href="/students/new">
            <Button variant="gradient" rightIcon={<PlusIcon className="w-4 h-4" />}>
            Add Student
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <GlassCard variant="default" padding="md">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="w-5 h-5 text-primary" />
            <p className="font-semibold text-foreground">Search & Filters</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search by student name or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
                />
            
            <Select
              options={gradeOptions}
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            />

            <Select
              options={subjectOptions}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            />
          </div>
        </GlassCard>

        {/* Grid */}
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <GlassCard variant="default" padding="lg" className="text-center">
            <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AcademicCapIcon className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {students.length === 0 ? 'No students yet' : 'No matching students'}
            </h3>
            <p className="text-[var(--foreground-muted)] mb-6">
              {students.length === 0 
                ? 'Add your first student to start creating strategies, lessons, and activities.'
                : 'Try adjusting your search or filters.'}
            </p>
            {students.length === 0 && (
              <Link href="/students/new">
                <Button variant="gradient" rightIcon={<PlusIcon className="w-4 h-4" />}>
                Add First Student
                </Button>
              </Link>
            )}
          </GlassCard>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
                <Link key={student.id} href={`/students/${student.id}`}>
                  <GlassCard hover padding="md" className="h-full">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="avatar avatar-lg">{student.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{student.name}</p>
                          <p className="text-sm text-[var(--foreground-muted)] truncate">{student.subject}</p>
                  </div>
                      </div>
                      <span className="badge badge-primary">Grade {student.grade}</span>
                </div>
                
                    <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex items-center justify-between">
                      <span className="text-xs text-[var(--foreground-muted)]">{student.learning_style}</span>
                      <span className="text-xs text-[var(--foreground-muted)]">Open →</span>
                  </div>
                  </GlassCard>
              </Link>
            ))}
          </div>

        {students.length > 0 && (
              <div className="text-center text-sm text-[var(--foreground-muted)]">
            Showing {filteredStudents.length} of {students.length} students
          </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}




