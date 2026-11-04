import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const admin = getAdminClient();
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, display_name, email, username, role, status, country')
    .eq('role', 'customer')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: accounts } = await admin.from('accounts').select('id, user_id, name, type, masked_number, balance, available_balance, currency, details');
  const { data: codes } = await admin.from('member_access_codes').select('user_id, expires_at, used_at');

  const now = Date.now();
  const customers = (profiles ?? []).map((p) => {
    const codeRow = (codes ?? []).find((c) => c.user_id === p.id);
    const hasActiveCode = !!codeRow && !codeRow.used_at && new Date(codeRow.expires_at).getTime() > now;
    return {
      ...p,
      accounts: (accounts ?? []).filter((a) => a.user_id === p.id),
      hasActiveCode,
    };
  });

  return NextResponse.json({ customers });
}
