import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { currencyFor } from '@/lib/countries';
import { generateHistory } from '@/lib/history';

export const dynamic = 'force-dynamic';

// Show, hide or rebuild the pre-built (seeded) statement history for ONE customer.
// Body: { userId, visible: boolean, regenerate?: boolean }
//  - visible=true : un-hides existing seeded rows; if there are none yet, builds a fresh ~2-year history.
//  - visible=false: hides all seeded rows (the customer no longer sees them).
//  - regenerate=true: throws away the seeded rows and builds a brand new, different history.
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { userId, visible, regenerate } = await request.json();
    if (!userId || (typeof visible !== 'boolean' && !regenerate)) return NextResponse.json({ error: 'userId and visible required' }, { status: 400 });

    const admin = getAdminClient();

    if (visible === false && !regenerate) {
      const { error } = await admin.from('transactions').update({ is_hidden: true }).eq('user_id', userId).eq('source', 'seed');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, visible: false });
    }

    if (!regenerate) {
      const { count } = await admin.from('transactions').select('id', { count: 'exact', head: false }).eq('user_id', userId).eq('source', 'seed').limit(1);
      if ((count ?? 0) > 0) {
        const { error } = await admin.from('transactions').update({ is_hidden: false }).eq('user_id', userId).eq('source', 'seed');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, visible: true });
      }
    } else {
      const { error } = await admin.from('transactions').delete().eq('user_id', userId).eq('source', 'seed');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: owner } = await admin.from('profiles').select('country').eq('id', userId).maybeSingle();
    const currency = currencyFor(owner?.country);
    const rows = generateHistory({ currency, months: 24 }).map((entry) => ({
      user_id: userId,
      merchant: entry.merchant.toUpperCase(),
      amount: entry.direction === 'in' ? entry.amount : -entry.amount,
      direction: entry.direction === 'in' ? 'credit' : 'debit',
      status: 'complete',
      category: entry.category,
      note: entry.note ?? null,
      transaction_date: entry.date,
      source: 'seed',
      is_hidden: false,
      currency,
    }));

    for (let from = 0; from < rows.length; from += 400) {
      const { error } = await admin.from('transactions').insert(rows.slice(from, from + 400));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, visible: true, added: rows.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
