import type { SupabaseClient } from '@supabase/supabase-js';

// Creates a bell notification for a customer. Server-only (uses the service-role client).
// Best effort: a failed notification must never break the action that triggered it.
export async function notify(
  admin: SupabaseClient,
  userId: string,
  note: { title: string; body?: string; kind?: string; link?: string },
): Promise<void> {
  try {
    await admin.from('notifications').insert({
      user_id: userId,
      title: note.title,
      body: note.body ?? null,
      kind: note.kind ?? 'info',
      link: note.link ?? null,
    });
  } catch {
    /* ignore */
  }
}
