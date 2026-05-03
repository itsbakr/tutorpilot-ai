'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BellIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth-context';
import { notificationApi } from '@/lib/api';

interface Notification {
  id: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  priority: string;
  read_at: string | null;
  created_at: string;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  normal: 'bg-slate-300',
  low: 'bg-slate-200',
};

const formatRel = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export function NotificationBell() {
  const { user } = useAuth();
  const tutorId = user?.tutor_id || user?.id;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    if (!tutorId) return;
    try {
      const data = await notificationApi.list(tutorId);
      setItems(data.notifications || []);
      setUnread(data.unread_count || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!tutorId) return;
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await notificationApi.markRead(id);
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const handleMarkAll = async () => {
    if (!tutorId) return;
    await notificationApi.markAllRead(tutorId);
    setItems((cur) => cur.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnread(0);
  };

  const action = items.filter((n) => !n.read_at && (n.priority === 'high' || n.priority === 'urgent'));
  const updates = items.filter((n) => !n.read_at && n.priority !== 'high' && n.priority !== 'urgent');
  const read = items.filter((n) => n.read_at).slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2.5 text-[var(--foreground-muted)] hover:text-foreground hover:bg-[var(--background-secondary)] rounded-xl transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-h-[600px] overflow-y-auto bg-white border border-[var(--card-border)] rounded-2xl shadow-2xl z-50">
          <div className="p-3 border-b border-[var(--card-border)] flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && (
            <div className="p-6 text-center text-sm text-[var(--foreground-muted)]">You&apos;re caught up.</div>
          )}
          {action.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-rose-700 mb-2">Action needed</p>
              {action.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={handleMarkRead} />
              ))}
            </div>
          )}
          {updates.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-slate-600 mb-2">Updates</p>
              {updates.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={handleMarkRead} />
              ))}
            </div>
          )}
          {read.length > 0 && (
            <div className="px-3 py-2 opacity-60">
              <p className="text-xs font-medium text-slate-500 mb-2">Read</p>
              {read.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={handleMarkRead} />
              ))}
            </div>
          )}
          <div className="p-2 border-t border-[var(--card-border)] text-center">
            <Link href="/notifications" className="text-xs text-[var(--foreground-muted)] hover:text-primary">
              See all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const Wrap: any = n.link ? Link : 'div';
  return (
    <Wrap
      {...(n.link ? { href: n.link } : {})}
      onClick={() => !n.read_at && onRead(n.id)}
      className="block p-2 rounded-xl hover:bg-[var(--background-secondary)] cursor-pointer mb-1"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[n.priority] || PRIORITY_DOT.normal}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-2">{n.title}</p>
          {n.body && <p className="text-xs text-[var(--foreground-muted)] line-clamp-2">{n.body}</p>}
          <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">{formatRel(n.created_at)}</p>
        </div>
      </div>
    </Wrap>
  );
}
