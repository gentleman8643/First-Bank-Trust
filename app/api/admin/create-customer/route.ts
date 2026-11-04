import { NextResponse } from 'next/server';
import { getAdminClient, usernameToEmail } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

// Body: { name, username, password, email?, phone? }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { name, username, password, email, phone } = await request.json();
    if (!name || !username || !password) {
      return NextResponse.json({ error: 'name, username and password are required.' }, { status: 400 });
    }

    const admin = getAdminClient();
    const cleanUsername = String(username).trim().toLowerCase();

    // Reject duplicate usernames.
    const { data: dupe } = await admin.from('profiles').select('id').eq('username', cleanUsername).maybeSingle();
    if (dupe) return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });

    const loginEmail = usernameToEmail(cleanUsername);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername, display_name: name },
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? 'Could not create user.' }, { status: 400 });
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: created.user.id,
      display_name: name,
      email: email || loginEmail,
      phone: phone ?? null,
      username: cleanUsername,
      role: 'customer',
      status: 'active',
    });
    if (profileError) {
      // Roll back the auth user if the profile insert failed.
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, userId: created.user.id, username: cleanUsername });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
