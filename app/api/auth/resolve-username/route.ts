import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Body: { username } -> { email } so the client can sign in with Supabase Auth.
export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('email')
      .eq('username', String(username).trim().toLowerCase())
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'No account with that username.' }, { status: 404 });

    return NextResponse.json({ email: data.email });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
