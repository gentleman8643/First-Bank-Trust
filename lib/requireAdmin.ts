import { getAdminClient } from './supabaseAdmin';

type AdminCheck = { ok: true; userId: string } | { ok: false; status: number; message: string };

// Verifies the request carries a valid Supabase session token belonging to an admin profile.
export async function requireAdmin(request: Request): Promise<AdminCheck> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, message: 'Missing session token.' };

  const admin = getAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { ok: false, status: 401, message: 'Invalid or expired session.' };

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();
  if (profileError || !profile) return { ok: false, status: 403, message: 'No profile found.' };
  if (profile.role !== 'admin') return { ok: false, status: 403, message: 'Admin access required.' };

  return { ok: true, userId: userData.user.id };
}
