'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, MessageSquare, Receipt, WalletCards, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiGet } from '@/lib/api';
import { formatMoney } from '@/lib/countries';

type Item = { id: string; title: string; body: string; when: string; unread: boolean; target: string; kind: string };

const timeAgo = (iso: string) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const iconFor = (kind: string) => {
  if (kind === 'message') return MessageSquare;
  if (kind === 'transaction') return Receipt;
  if (kind === 'account' || kind === 'pending') return WalletCards;
  return Info;
};

/**
 * The bell in the top bar.
 *  - customers: their own notifications (approvals, banker messages, new accounts...)
 *  - admins: what needs attention (transfers waiting for review, unread customer messages)
 * `onNavigate` receives where the item points (a customer screen name, or 'review-queue' / 'messages' for admins).
 */
export function NotificationBell({ role, onNavigate }: { role: 'admin' | 'customer'; onNavigate: (target: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [count, setCount] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      if (role === 'admin') {
        const summary = await apiGet<{
          pending: number; unreadMessages: number;
          pendingItems: { id: string; customer: string; merchant: string; amount: number; currency: string; category: string; transaction_date: string }[];
          messageItems: { user_id: string; customer: string; body: string; created_at: string }[];
        }>('/api/admin/summary');
        const next: Item[] = [
          ...summary.pendingItems.map((t) => ({
            id: `t-${t.id}`, title: `${t.category} awaiting review`, body: `${t.customer} · ${t.merchant} · ${formatMoney(Math.abs(Number(t.amount)), t.currency)}`,
            when: t.transaction_date, unread: true, target: 'review-queue', kind: 'pending',
          })),
          ...summary.messageItems.map((m, index) => ({
            id: `m-${m.user_id}-${index}`, title: `New message from ${m.customer}`, body: m.body, when: m.created_at, unread: true, target: 'messages', kind: 'message',
          })),
        ];
        setItems(next);
        setCount(summary.pending + summary.unreadMessages);
      } else if (supabase) {
        const { data } = await supabase.from('notifications').select('id, title, body, kind, link, created_at, read_at').order('created_at', { ascending: false }).limit(20);
        const next: Item[] = (data ?? []).map((row: any) => ({
          id: row.id, title: row.title, body: row.body ?? '', when: row.created_at, unread: !row.read_at, target: row.link ?? 'dashboard', kind: row.kind ?? 'info',
        }));
        setItems(next);
        setCount(next.filter((item) => item.unread).length);
      }
    } catch {
      /* keep what we have */
    }
  }, [role]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => { setOpen(!open); if (!open) load(); };

  const markAllRead = async () => {
    if (role !== 'customer' || !supabase) return;
    await supabase.rpc('mark_notifications_read');
    await load();
  };

  const go = (item: Item) => { setOpen(false); onNavigate(item.target); };

  return (
    <div className="relative" ref={box}>
      <button className="icon-button" onClick={toggle} aria-label={count ? `Notifications, ${count} new` : 'Notifications'} aria-expanded={open}>
        <Bell size={18} />
        {count > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c4874b] px-1 text-[10px] font-bold leading-none text-white">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="absolute right-[-60px] top-12 z-50 w-[min(92vw,380px)] rounded-2xl border border-stone-200 bg-white shadow-soft sm:right-0" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink">{role === 'admin' ? 'Needs your attention' : 'Notifications'}</p>
            {role === 'customer' && count > 0 && <button className="flex items-center gap-1 text-xs font-semibold text-forest" onClick={markAllRead}><CheckCheck size={14} /> Mark all read</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">{role === 'admin' ? 'Nothing is waiting for you.' : 'You’re all caught up.'}</p>
            ) : items.map((item) => {
              const Icon = iconFor(item.kind);
              return (
                <button key={item.id} onClick={() => go(item)} className={`flex w-full gap-3 border-b border-stone-50 px-4 py-3 text-left transition hover:bg-[#f4f8f4] ${item.unread ? 'bg-[#f9fbf8]' : ''}`}>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e5f0e6] text-forest"><Icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate text-sm font-medium text-ink">{item.title}</span>{item.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#c4874b]" aria-label="unread" />}</span>
                    {item.body && <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-600">{item.body}</span>}
                    <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(item.when)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
