import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { currencyFor } from '@/lib/countries';
import { ACCOUNT_TYPE_LABELS, buildAccount, type AccountInput } from '@/lib/accounts';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const num = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

// Opens a checking/savings/money market/credit card/IRA/loan/mortgage account for a customer.
// Body: { userId, type, name?, amount, ...type-specific fields (see lib/accounts.ts) }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const body = await request.json();
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const admin = getAdminClient();
    const { data: owner } = await admin.from('profiles').select('role, country, display_name').eq('id', userId).maybeSingle();
    if (!owner) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    if (owner.role !== 'customer') return NextResponse.json({ error: 'Accounts can only be opened for customers.' }, { status: 403 });

    const input: AccountInput = {
      type: body.type,
      name: str(body.name),
      amount: num(body.amount) ?? NaN,
      creditLimit: num(body.creditLimit),
      apr: num(body.apr),
      network: body.network,
      apy: num(body.apy),
      minimumBalance: num(body.minimumBalance),
      iraType: body.iraType,
      contributionsThisYear: num(body.contributionsThisYear),
      contributionLimit: num(body.contributionLimit),
      loanType: str(body.loanType),
      originalAmount: num(body.originalAmount),
      interestRate: num(body.interestRate),
      termMonths: num(body.termMonths),
      originationDate: str(body.originationDate),
      dueDay: num(body.dueDay),
      propertyAddress: str(body.propertyAddress),
      rateType: body.rateType,
      monthlyEscrow: num(body.monthlyEscrow),
    };

    let built;
    try {
      built = buildAccount(input);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    const currency = currencyFor(owner.country);
    const { data, error } = await admin
      .from('accounts')
      .insert({
        user_id: userId,
        name: built.name,
        type: built.type,
        masked_number: built.maskedNumber,
        balance: built.balance,
        available_balance: built.available,
        currency,
        details: built.details,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await notify(admin, userId, {
      title: 'New account opened',
      body: `Your ${ACCOUNT_TYPE_LABELS[built.type].toLowerCase()} “${built.name}” is now available.`,
      kind: 'account',
      link: 'dashboard',
    });

    return NextResponse.json({ ok: true, accountId: data.id, name: built.name, maskedNumber: built.maskedNumber, details: built.details });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
