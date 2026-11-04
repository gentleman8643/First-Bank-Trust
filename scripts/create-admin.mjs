// One-off: create (or reset) the admin account.
// Usage: node scripts/create-admin.mjs <username> <password> [displayName]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const [username, password, displayName = 'Administrator'] = process.argv.slice(2);
if (!username || !password) { console.error('Usage: node scripts/create-admin.mjs <username> <password> [displayName]'); process.exit(1); }

const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const clean = username.trim().toLowerCase();
const email = `${clean.replace(/[^a-z0-9._-]/g, '')}@firstbanktrust.local`;

let userId;
const { data: existing } = await admin.from('profiles').select('id').eq('username', clean).maybeSingle();
if (existing) {
  userId = existing.id;
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw error;
  await admin.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', userId);
  console.log('Existing user updated to admin with new password.');
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: clean, display_name: displayName } });
  if (error && error.code === 'email_exists') {
    // Login already exists without a profile (e.g. from an earlier partial run): reuse it.
    const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (lErr) throw lErr;
    const found = list.users.find((u) => u.email === email);
    if (!found) throw new Error('Login exists but could not be found.');
    userId = found.id;
    const { error: uErr } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (uErr) throw uErr;
  } else if (error) {
    throw error;
  } else {
    userId = data.user.id;
  }
  const { error: pErr } = await admin.from('profiles').upsert({ id: userId, display_name: displayName, email, username: clean, role: 'admin', status: 'active' });
  if (pErr) throw pErr;
  console.log('Admin created.');
}
console.log('Username:', clean, '| id:', userId);
