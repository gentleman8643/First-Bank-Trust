import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

// Show or hide the pre-built (seeded) history for ONE customer.
// Body: { userId, visible: boolean, entries?: [...] }
//  - visible=true: un-hides existing seeded rows; if none exist yet, inserts `entries`.
//  - visible=false: hides all seeded rows (customer no longer sees them).
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { userId, visible, entries } = await request.json();
    if (!userId || typeof visible !== 'boolean') return NextResponse.json({ error: 'userId and visible required' }, { status: 400 });

    const admin = getAdminClient();
    const { count } = await admin.from('transactions').select('id', { count: 'exact', head: false }).eq('user_id', userId).eq('source', 'seed').limit(1);

    if (!visible) {
      const { error } = await admin.from('transactions').update({ is_hidden: true }).eq('user_id', userId).eq('source', 'seed');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, visible: false });
    }

    if ((count ?? 0) > 0) {
      const { error } = await admin.from('transactions').update({ is_hidden: false }).eq('user_id', userId).eq('source', 'seed');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, visible: true });
    }

    if (!Array.isArray(entries) || entries.length === 0) return NextResponse.json({ error: 'entries required for first-time fill' }, { status: 400 });
    const rows = entries.map((e: any) => {
      const amt = Math.abs(Number(e.amount));
      const isIn = e.direction === 'in';
      return {
        user_id: userId,
        merchant: String(e.merchant || 'ENTRY').toUpperCase(),
        amount: isIn ? amt : -amt,
        direction: isIn ? 'credit' : 'debit',
        status: 'complete',
        category: e.category || 'History',
        note: e.note || null,
        transaction_date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
        source: 'seed',
        is_hidden: false,
      };
    });
    const { error } = await admin.from('transactions').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, visible: true, added: rows.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
