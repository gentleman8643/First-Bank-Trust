import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const ACK_TEXT =
  "Thanks for your message — we've received it and a banker will get back to you shortly. " +
  "If this is urgent, you can call us on (276) 555-0147.";

// Instant, non-AI acknowledgement after a customer sends a message. The customer's
// browser can only insert its own 'customer' rows (RLS), so this server route posts
// the 'staff' acknowledgement. To avoid spamming, it only replies when the banker's
// last message was NOT already this acknowledgement within the last few minutes.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const admin = getAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    const userId = userData.user.id;

    // Look at the most recent message in this thread.
    const { data: last } = await admin
      .from('messages')
      .select('sender, body, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Only acknowledge right after a customer message, and not if we just sent an ack
    // in the last 10 minutes (prevents a reply storm on back-to-back messages).
    const { data: recentAcks } = await admin
      .from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .eq('sender', 'staff')
      .eq('body', ACK_TEXT)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(1);

    if (last?.sender === 'customer' && (!recentAcks || recentAcks.length === 0)) {
      await admin.from('messages').insert({ user_id: userId, sender: 'staff', body: ACK_TEXT });
      return NextResponse.json({ ok: true, acked: true });
    }

    return NextResponse.json({ ok: true, acked: false });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
