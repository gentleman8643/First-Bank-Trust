import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { isDebt } from '@/lib/accounts';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// Update an existing account's balance.
//  - Deposit-type accounts (checking, savings, money market, IRA): `balance` is the balance.
//  - Credit cards, loans and mortgages: `balance` is the AMOUNT OWED (enter it as a positive number).
// New accounts are opened through /api/admin/create-account.
// Body: { accountId, balance }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { accountId, balance } = await request.json();
    const amount = Number(balance);
    if (!accountId) return NextResponse.json({ error: 'accountId required (open new accounts with create-account)' }, { status: 400 });
    if (Number.isNaN(amount)) return NextResponse.json({ error: 'balance must be a number' }, { status: 400 });

    const admin = getAdminClient();
    const { data: account, error: loadError } = await admin.from('accounts').select('id, user_id, name, type, details').eq('id', accountId).maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (isDebt(account.type)) {
      const owed = Math.abs(amount);
      patch.balance = -owed;
      if (account.type === 'credit_card') {
        const limit = Number((account.details as Record<string, unknown>)?.creditLimit ?? 0);
        if (limit > 0 && owed > limit) return NextResponse.json({ error: 'The amount owed cannot be more than the credit limit.' }, { status: 400 });
        patch.available_balance = Math.round((limit - owed) * 100) / 100;
        patch.details = { ...(account.details as Record<string, unknown>), minimumPayment: owed === 0 ? 0 : Math.round(Math.max(owed * 0.02, Math.min(owed, 25)) * 100) / 100 };
      } else {
        patch.available_balance = 0;
      }
    } else {
      patch.balance = amount;
      patch.available_balance = amount;
    }

    const { error } = await admin.from('accounts').update(patch).eq('id', accountId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await notify(admin, account.user_id, { title: 'Balance updated', body: `Your ${account.name} account was updated by your banker.`, kind: 'account', link: 'dashboard' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
