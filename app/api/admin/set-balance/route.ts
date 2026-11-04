import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

// Create or update an account balance for a customer.
// Body: { userId, accountId?, name?, type?, maskedNumber?, balance }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const body = await request.json();
    const { userId, accountId, name, type, maskedNumber, balance } = body;
    const amount = Number(balance);
    if (Number.isNaN(amount)) return NextResponse.json({ error: 'balance must be a number' }, { status: 400 });

    const admin = getAdminClient();

    if (accountId) {
      const { error } = await admin
        .from('accounts')
        .update({ balance: amount, available_balance: amount })
        .eq('id', accountId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!userId) return NextResponse.json({ error: 'userId required to create an account' }, { status: 400 });
    const { data, error } = await admin
      .from('accounts')
      .insert({
        user_id: userId,
        name: name || 'Checking',
        type: type || 'checking',
        masked_number: maskedNumber || `x${Math.floor(1000 + Math.random() * 8999)}`,
        balance: amount,
        available_balance: amount,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, accountId: data.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
