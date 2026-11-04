import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { currencyFor } from '@/lib/countries';

export const dynamic = 'force-dynamic';

// Add a single history entry, or bulk-seed many, for a customer.
// Body (single): { userId, merchant, amount, direction: 'in'|'out', note?, category? }
// Body (bulk):   { userId, entries: [ { merchant, amount, direction, note?, category?, date? } ] }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const body = await request.json();
    const { userId, entries } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const admin = getAdminClient();
    // History is recorded in the currency of the customer's country.
    const { data: owner } = await admin.from('profiles').select('country').eq('id', userId).maybeSingle();
    const currency = currencyFor(owner?.country);
    const toRow = (e: any) => {
      const amt = Math.abs(Number(e.amount));
      const isIn = e.direction === 'in' || e.direction === 'credit';
      return {
        user_id: userId,
        merchant: String(e.merchant || 'ENTRY').toUpperCase(),
        amount: isIn ? amt : -amt,
        direction: isIn ? 'credit' : 'debit',
        status: ['pending', 'complete', 'cancelled'].includes(e.status ?? body.status) ? (e.status ?? body.status) : 'complete',
        category: e.category || 'Staff entry',
        note: e.note || 'Added by staff.',
        admin_description: e.note || null,
        source: body.source === 'seed' ? 'seed' : 'staff',
        is_hidden: false,
        currency,
        transaction_date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
      };
    };

    const rows = Array.isArray(entries) ? entries.map(toRow) : [toRow(body)];
    if (rows.length === 0) return NextResponse.json({ error: 'nothing to add' }, { status: 400 });

    const { error } = await admin.from('transactions').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, added: rows.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
