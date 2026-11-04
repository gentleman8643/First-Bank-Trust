import { NextResponse } from 'next/server';
import { getAdminClient, usernameToEmail } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { COUNTRY_NAMES } from '@/lib/countries';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// Body: { name, username, password, country, email?, phone? }
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const { name, username, password, email, phone, country } = await request.json();
    if (!name || !username || !password) {
      return NextResponse.json({ error: 'name, username and password are required.' }, { status: 400 });
    }
    if (!country || !COUNTRY_NAMES.includes(country)) {
      return NextResponse.json({ error: 'Choose which country this customer banks in.' }, { status: 400 });
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
      country,
    });
    if (profileError) {
      // Roll back the auth user if the profile insert failed.
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    await notify(admin, created.user.id, { title: `Welcome to First Bank & Trust, ${String(name).split(' ')[0]}`, body: 'Your banker will open your accounts shortly. You can message them any time from Messages.', kind: 'info', link: 'messages' });
    return NextResponse.json({ ok: true, userId: created.user.id, username: cleanUsername });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
