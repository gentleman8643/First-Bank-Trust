import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { currencyFor } from '@/lib/countries';
import { generateHistory } from '@/lib/history';

export const dynamic = 'force-dynamic';

// Extend a customer's statement: build fresh, randomised transactions (big wires
// plus everyday spending) from their most recent transaction date up to today,
// WITHOUT touching anything that is already there.
// Body: { userId }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const admin = getAdminClient();

    const { data: owner } = await admin.from('profiles').select('country').eq('id', userId).maybeSingle();
    const currency = currencyFor(owner?.country);

    // Find the newest transaction we already have for this customer.
    const { data: latest } = await admin
      .from('transactions')
      .select('transaction_date')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    // If there is no history at all, fall back to the last 90 days so the button
    // still does something useful; otherwise build from the last entry forward.
    const from = latest?.transaction_date
      ? new Date(latest.transaction_date)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);

    if (from >= now) {
      return NextResponse.json({ ok: true, added: 0, message: 'History is already up to date.' });
    }

    const rows = generateHistory({ currency, from, now }).map((entry) => ({
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

    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await admin.from('transactions').insert(rows.slice(i, i + 400));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, added: rows.length, from: from.toISOString() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
