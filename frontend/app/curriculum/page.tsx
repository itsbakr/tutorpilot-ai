'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { dataApi, standardsApi } from '@/lib/api';

export default function CurriculumPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [coverageByStudent, setCoverageByStudent] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const r = await dataApi.getStudents();
      const list = r.students || [];
      setStudents(list);
      const cov: Record<string, any[]> = {};
      await Promise.all(
        list.map(async (s: any) => {
          try {
            const c = await standardsApi.studentCoverage(s.id);
            cov[s.id] = c.standards || [];
          } catch {
            cov[s.id] = [];
          }
        }),
      );
      setCoverageByStudent(cov);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoader message="Loading curriculum coverage..." />;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Curriculum coverage</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Standards alignment across all your students.
          </p>
        </div>

        {students.length === 0 ? (
          <GlassCard padding="lg">
            <p className="text-sm text-[var(--foreground-muted)]">No students yet.</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {students.map((s) => {
              const covered = coverageByStudent[s.id] || [];
              const struggling = covered.filter((c) => c.status === 'struggling');
              const mastered = covered.filter((c) => c.status === 'mastered');
              return (
                <Link key={s.id} href={`/students/${s.id}/standards`}>
                  <GlassCard padding="md" hover className="hover:border-primary/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{s.name}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {s.subject} · grade {s.grade}
                        </p>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <span className="text-emerald-700">{mastered.length} mastered</span>
                        <span className="text-amber-700">{struggling.length} struggling</span>
                        <span className="text-slate-600">{covered.length} total</span>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
