import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { COUNTRY_NAMES, currencyFor } from '@/lib/countries';

export const dynamic = 'force-dynamic';

// Change which country a customer banks in. Their accounts and history switch to that country's currency.
// Body: { userId, country }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { userId, country } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!country || !COUNTRY_NAMES.includes(country)) return NextResponse.json({ error: 'Choose a valid country.' }, { status: 400 });

    const admin = getAdminClient();
    const currency = currencyFor(country);

    const { data: target } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    if (target.role !== 'customer') return NextResponse.json({ error: 'Only customers can be changed here.' }, { status: 403 });

    const { error: profileError } = await admin.from('profiles').update({ country }).eq('id', userId);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    const { error: accountError } = await admin.from('accounts').update({ currency }).eq('user_id', userId);
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
    const { error: txnError } = await admin.from('transactions').update({ currency }).eq('user_id', userId);
    if (txnError) return NextResponse.json({ error: txnError.message }, { status: 500 });

    return NextResponse.json({ ok: true, country, currency });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
