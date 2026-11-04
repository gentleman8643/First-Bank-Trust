import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

// Approve / complete / cancel a transaction, attach a note, hide it, or delete it.
// Body: { transactionId, status?: 'pending'|'complete'|'cancelled', note?, hidden?, remove? }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { transactionId, status, note, hidden, remove } = await request.json();
    if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 });

    const admin = getAdminClient();

    if (remove) {
      const { error } = await admin.from('transactions').delete().eq('id', transactionId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const patch: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!['pending', 'complete', 'cancelled'].includes(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      patch.status = status;
    }
    if (note !== undefined) { patch.admin_description = note; patch.note = note; }
    if (hidden !== undefined) patch.is_hidden = !!hidden;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

    const { error } = await admin.from('transactions').update(patch).eq('id', transactionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
