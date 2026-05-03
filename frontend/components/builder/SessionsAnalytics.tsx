'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { sessionApi, type ActivitySession } from '@/lib/api';

interface SessionsAnalyticsProps {
  activityId: string;
}

interface AnalyticsData {
  sessions_count: number;
  questions: { id: string; correct: number; incorrect: number; hints: number }[];
  durations: number[];
  completion_rate: number;
}

export function SessionsAnalytics({ activityId }: SessionsAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [a, s] = await Promise.all([
          sessionApi.analytics(activityId),
          sessionApi.listForActivity(activityId),
        ]);
        if (!cancelled) {
          setAnalytics(a);
          setSessions(s);
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--foreground-muted)]">
        Loading sessions…
      </div>
    );
  }

  if (!analytics || analytics.sessions_count === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
            <ChartBarIcon className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground">No sessions yet</h3>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Toggle to <strong>Student view</strong> in the preview header to record a session.
            Stats will appear here.
          </p>
        </div>
      </div>
    );
  }

  const avgDuration = analytics.durations.length
    ? Math.round(analytics.durations.reduce((a, b) => a + b, 0) / analytics.durations.length)
    : 0;

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 space-y-4 bg-white">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Sessions" value={String(analytics.sessions_count)} />
        <StatCard
          label="Completion"
          value={`${Math.round(analytics.completion_rate * 100)}%`}
        />
        <StatCard
          label="Avg time"
          value={`${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')}`}
        />
      </div>

      {/* Questions chart */}
      {analytics.questions.length > 0 && (
        <div className="rounded-xl border border-[var(--card-border)] p-3 bg-white">
          <p className="text-xs font-bold text-foreground mb-2">Per-question outcomes</p>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={analytics.questions}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="id" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    border: '1px solid var(--card-border)',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="correct" fill="#10B981" stackId="a" />
                <Bar dataKey="incorrect" fill="#DC2626" stackId="a" />
                <Bar dataKey="hints" fill="#F59E0B" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--foreground-muted)]">
            <Legend color="#10B981" label="Correct" />
            <Legend color="#DC2626" label="Incorrect" />
            <Legend color="#F59E0B" label="Hints used" />
          </div>
        </div>
      )}

      {/* Recent sessions list */}
      <div className="rounded-xl border border-[var(--card-border)] bg-white">
        <p className="text-xs font-bold text-foreground p-3 border-b border-[var(--card-border)]">
          Recent sessions
        </p>
        <ul className="divide-y divide-[var(--card-border)]">
          {sessions.slice(0, 10).map((s) => (
            <li key={s.id} className="p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--foreground-muted)] flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  {new Date(s.started_at).toLocaleString()}
                </span>
                {s.duration_seconds != null && (
                  <span className="font-mono text-foreground">
                    {Math.floor(s.duration_seconds / 60)}:
                    {String(s.duration_seconds % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
              {s.ai_summary && (
                <p className="text-foreground/80 leading-relaxed line-clamp-2">{s.ai_summary}</p>
              )}
              {Array.isArray(s.ai_misconceptions) && s.ai_misconceptions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.ai_misconceptions.slice(0, 3).map((m: any, i: number) => (
                    <span
                      key={i}
                      className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px]"
                    >
                      {m.topic || 'misconception'}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-muted)] font-semibold">
        {label}
      </p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
