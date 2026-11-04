import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

// What needs the banker's attention right now (drives the admin bell).
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const admin = getAdminClient();
  const [pending, unread, recentPending, recentMessages] = await Promise.all([
    admin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('source', 'customer'),
    admin.from('messages').select('id', { count: 'exact', head: true }).eq('sender', 'customer').is('read_at', null),
    admin.from('transactions').select('id, user_id, merchant, amount, currency, category, transaction_date').eq('status', 'pending').eq('source', 'customer').order('transaction_date', { ascending: false }).limit(5),
    admin.from('messages').select('user_id, body, created_at').eq('sender', 'customer').is('read_at', null).order('created_at', { ascending: false }).limit(5),
  ]);

  const ids = Array.from(new Set([...(recentPending.data ?? []).map((t) => t.user_id), ...(recentMessages.data ?? []).map((m) => m.user_id)]));
  const { data: profiles } = ids.length ? await admin.from('profiles').select('id, display_name').in('id', ids) : { data: [] as { id: string; display_name: string }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return NextResponse.json({
    pending: pending.count ?? 0,
    unreadMessages: unread.count ?? 0,
    pendingItems: (recentPending.data ?? []).map((t) => ({ ...t, customer: names.get(t.user_id) ?? 'Customer' })),
    messageItems: (recentMessages.data ?? []).map((m) => ({ ...m, customer: names.get(m.user_id) ?? 'Customer' })),
  });
}
