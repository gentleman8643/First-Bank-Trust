import { NextResponse } from 'next/server';
import { getAdminClient, hashCode } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Verifies the logged-in user's access code. Requires a valid session token.
// Body: { code }. Marks the code used on success.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

    const admin = getAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });

    const { data: row, error } = await admin
      .from('member_access_codes')
      .select('code_digest, expires_at, used_at')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'No code issued. Ask your banker.' }, { status: 403 });

    if (row.used_at) return NextResponse.json({ error: 'That code was already used.' }, { status: 403 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'That code has expired.' }, { status: 403 });

    const digest = await hashCode(String(code));
    if (digest !== row.code_digest) return NextResponse.json({ error: 'Incorrect access code.' }, { status: 403 });

    await admin.from('member_access_codes').update({ used_at: new Date().toISOString() }).eq('user_id', userData.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
