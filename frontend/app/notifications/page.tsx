'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/auth-context';
import { notificationApi } from '@/lib/api';

export default function NotificationsArchive() {
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!tutorId) return;
    const r = await notificationApi.list(tutorId);
    setItems(r.notifications || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId]);

  if (loading) return <PageLoader message="Loading notifications..." />;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {items.some((n) => !n.read_at) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (!tutorId) return;
                await notificationApi.markAllRead(tutorId);
                await load();
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <GlassCard padding="lg">
            <p className="text-sm text-[var(--foreground-muted)]">No notifications.</p>
          </GlassCard>
        ) : (
          <GlassCard padding="none" className="overflow-hidden">
            <div className="divide-y divide-[var(--card-border)]">
              {items.map((n) => {
                const Wrap: any = n.link ? Link : 'div';
                return (
                  <Wrap
                    key={n.id}
                    {...(n.link ? { href: n.link } : {})}
                    className={`block p-3 hover:bg-[var(--background-secondary)] ${!n.read_at ? 'bg-primary/5' : ''}`}
                  >
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="text-xs text-[var(--foreground-muted)]">{n.body}</p>}
                    <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                      {new Date(n.created_at).toLocaleString()} · {n.priority}
                    </p>
                  </Wrap>
                );
              })}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
