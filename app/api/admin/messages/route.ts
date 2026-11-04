import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// GET            -> list of conversations (one per customer who has written), newest first, with unread counts
// GET ?userId=.. -> the full thread with one customer (oldest first)
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const admin = getAdminClient();
  const userId = new URL(request.url).searchParams.get('userId');

  if (userId) {
    const { data, error } = await admin.from('messages').select('id, sender, body, created_at, read_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  }

  const { data, error } = await admin.from('messages').select('user_id, sender, body, created_at, read_at').order('created_at', { ascending: false }).limit(3000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await admin.from('profiles').select('id, display_name, username');
  const names = new Map((profiles ?? []).map((p) => [p.id, p]));
  const byUser = new Map<string, { userId: string; name: string; username: string; lastBody: string; lastAt: string; lastSender: string; unread: number }>();
  for (const row of data ?? []) {
    const existing = byUser.get(row.user_id);
    const who = names.get(row.user_id);
    if (!existing) {
      byUser.set(row.user_id, {
        userId: row.user_id, name: who?.display_name ?? 'Unknown', username: who?.username ?? '',
        lastBody: row.body, lastAt: row.created_at, lastSender: row.sender, unread: 0,
      });
    }
    if (row.sender === 'customer' && !row.read_at) byUser.get(row.user_id)!.unread += 1;
  }
  return NextResponse.json({ conversations: Array.from(byUser.values()) });
}

// POST { action: 'reply', userId, body } -> banker replies (customer gets a bell notification)
// POST { action: 'read',  userId }       -> marks that customer's messages as read
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { action, userId, body } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    const admin = getAdminClient();

    if (action === 'read') {
      const { error } = await admin.from('messages').update({ read_at: new Date().toISOString() }).eq('user_id', userId).eq('sender', 'customer').is('read_at', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'reply') {
      const text = String(body ?? '').trim();
      if (!text) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
      if (text.length > 2000) return NextResponse.json({ error: 'Messages can be up to 2000 characters.' }, { status: 400 });
      const { data: customer } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (!customer || customer.role !== 'customer') return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
      const { error } = await admin.from('messages').insert({ user_id: userId, sender: 'staff', body: text });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await notify(admin, userId, { title: 'New message from your banker', body: text.length > 120 ? `${text.slice(0, 117)}...` : text, kind: 'message', link: 'messages' });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
