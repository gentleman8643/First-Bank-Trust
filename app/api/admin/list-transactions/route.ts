import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

const PAGE = 1000;
const MAX_ROWS = 10000;

// GET ?userId=...  -> every transaction for that customer (including hidden ones)
// GET ?pending=1   -> all pending customer transfers awaiting approval, with customer names
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const pendingOnly = url.searchParams.get('pending');
  const admin = getAdminClient();

  // The database returns at most 1000 rows per request, so read page by page.
  const rows: any[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let query = admin.from('transactions').select('*').order('transaction_date', { ascending: false }).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (userId) query = query.eq('user_id', userId);
    if (pendingOnly) query = query.eq('status', 'pending').eq('source', 'customer');
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const { data: profiles } = await admin.from('profiles').select('id, display_name, username');
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string]));
  const transactions = rows.map((t) => ({ ...t, customer_name: names.get(t.user_id) ?? 'Unknown' }));
  return NextResponse.json({ transactions });
}
