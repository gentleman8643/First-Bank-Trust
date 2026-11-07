import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { COUNTRY_NAMES, currencyFor } from '@/lib/countries';

export const dynamic = 'force-dynamic';

// Update a customer. Any of these may be sent; only the ones present are changed.
// Body: {
//   userId,
//   country?,                 -> also re-stamps their accounts/transactions currency
//   name?,                    -> fixes the display name everywhere (profile + auth metadata)
//   disabled?: boolean,       -> locks the customer out (login shows "under review")
//   codeFreeDays?: number     -> 0 turns code-free OFF; >0 lets them log in without a code for N days
// }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { userId, country, name, disabled, codeFreeDays } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const admin = getAdminClient();

    const { data: target } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    if (target.role !== 'customer') return NextResponse.json({ error: 'Only customers can be changed here.' }, { status: 403 });

    const patch: Record<string, unknown> = {};

    // Country (re-currencies their accounts + history).
    let currency: string | undefined;
    if (country !== undefined) {
      if (!COUNTRY_NAMES.includes(country)) return NextResponse.json({ error: 'Choose a valid country.' }, { status: 400 });
      currency = currencyFor(country);
      patch.country = country;
    }

    // Display name — keep the profile row and the auth user_metadata in sync so the
    // name shown in the app can never drift back to an old value.
    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
      patch.display_name = clean;
      await admin.auth.admin.updateUserById(userId, { user_metadata: { display_name: clean } });
    }

    // Disable / enable. Enabling leaves every other detail untouched.
    if (disabled !== undefined) {
      patch.disabled = !!disabled;
      patch.status = disabled ? 'suspended' : 'active';
    }

    // Code-free login window. 0 (or negative) turns it off; a positive number of
    // days opens a window during which this customer signs in without a code.
    if (codeFreeDays !== undefined) {
      const days = Number(codeFreeDays);
      patch.code_free_until = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

    const { error: profileError } = await admin.from('profiles').update(patch).eq('id', userId);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    if (currency) {
      const { error: accountError } = await admin.from('accounts').update({ currency }).eq('user_id', userId);
      if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
      const { error: txnError } = await admin.from('transactions').update({ currency }).eq('user_id', userId);
      if (txnError) return NextResponse.json({ error: txnError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, country, currency });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
