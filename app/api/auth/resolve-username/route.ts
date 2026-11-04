import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Body: { username } -> { email } so the client can sign in with Supabase Auth.
// The email returned is the account's real LOGIN email (from Supabase Auth),
// not the contact email the banker may have typed on the customer's profile.
export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

    const admin = getAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .select('id')
      .eq('username', String(username).trim().toLowerCase())
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!profile) return NextResponse.json({ error: 'No account with that username.' }, { status: 404 });

    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(profile.id);
    if (authError || !authUser.user?.email) {
      return NextResponse.json({ error: 'No account with that username.' }, { status: 404 });
    }

    return NextResponse.json({ email: authUser.user.email });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
