import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Inbox, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface Notification {
  id: string;
  kind: 'submission_created' | 'submission_approved' | 'submission_rejected';
  submission_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
}

export default function NotificationBell() {
  const { userId } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifs = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [] as Notification[];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as Notification[];
    },
    refetchOnWindowFocus: true,
  });

  const unread = (notifs.data ?? []).filter((n) => !n.read_at).length;

  // Realtime subscription — new notifications appear without refresh
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', userId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markAllRead() {
    if (!userId || unread === 0) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .is('read_at', null);
    qc.invalidateQueries({ queryKey: ['notifications', userId] });
  }

  async function onClickItem(n: Notification) {
    // Mark this one as read
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
      qc.invalidateQueries({ queryKey: ['notifications', userId] });
    }
    setOpen(false);
    // Route by kind
    if (n.kind === 'submission_created' && n.submission_id) {
      nav(`/review/${n.submission_id}`);
    } else if (n.submission_id) {
      // maker landing on their My submissions page
      nav('/my-submissions');
    }
  }

  if (!userId) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md hover:bg-white/10 transition w-9 h-9 flex items-center justify-center text-white"
        title="Notifications"
      >
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ring-2 ring-brand-700">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-slate-200 z-50">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
            <div className="font-semibold text-slate-900 text-sm">Notifications</div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {(notifs.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No notifications.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(notifs.data ?? []).map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onClickItem(n)}
                    className={`block w-full text-left px-4 py-3 hover:bg-slate-50 transition ${
                      n.read_at ? 'text-slate-600' : 'bg-brand-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="shrink-0 mt-0.5">{iconFor(n.kind)}</span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm ${n.read_at ? 'text-slate-700' : 'font-medium text-slate-900'}`}>
                          {n.message}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{timeAgo(n.created_at)}</div>
                      </div>
                      {!n.read_at && <span className="bg-brand-700 w-2 h-2 rounded-full mt-1.5 shrink-0" />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function iconFor(kind: string) {
  if (kind === 'submission_created') return <Inbox size={16} className="text-brand-700" />;
  if (kind === 'submission_approved') return <CheckCircle2 size={16} className="text-emerald-600" />;
  if (kind === 'submission_changes_requested') return <RotateCcw size={16} className="text-orange-600" />;
  return <XCircle size={16} className="text-red-600" />;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
