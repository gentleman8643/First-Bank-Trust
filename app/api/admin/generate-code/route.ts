import { NextResponse } from 'next/server';
import { getAdminClient, hashCode } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

const TTL_MS = 24 * 60 * 60 * 1000;

// Body: { userId } -> returns the raw 6-digit code ONCE for the admin to pass on.
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const digest = await hashCode(code);
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

    const admin = getAdminClient();
    // One active code per user: upsert on user_id.
    const { error } = await admin
      .from('member_access_codes')
      .upsert({ user_id: userId, code_digest: digest, expires_at: expiresAt, used_at: null }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, code, expiresAt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
