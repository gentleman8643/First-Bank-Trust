import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client using the service_role key.
// NEVER import this into a client component — it has full database access.
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase server env vars are missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Next.js caches server-side fetches by default (and Vercel keeps that cache between
      // requests). That made admin lists, username lookups and code checks return STALE data.
      // Banking data must always be read live, so never use the cache.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return cached;
}

// Usernames are stored on profiles; we turn them into a login email behind the scenes.
export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${clean}@firstbanktrust.local`;
}

// Deterministic hash for access codes so raw codes are never stored.
export async function hashCode(code: string): Promise<string> {
  const secret = process.env.ACCESS_CODE_SECRET ?? 'fallback-secret';
  const data = new TextEncoder().encode(`${secret}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
