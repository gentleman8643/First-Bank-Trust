import { supabase } from './supabase';

// Small helper: calls one of our API routes with the current user's session token.
async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const headers = { ...(await authHeader()) };
  const res = await fetch(path, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

// Multipart POST (file uploads). Do NOT set Content-Type; the browser adds the
// correct multipart boundary automatically. Still sends the session token.
export async function apiPostForm<T = any>(path: string, body: FormData): Promise<T> {
  const headers = { ...(await authHeader()) };
  const res = await fetch(path, { method: 'POST', headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}
