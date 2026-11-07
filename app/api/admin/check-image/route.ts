import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

// Mint a short-lived signed URL so a banker can view a deposited cheque image.
// GET ?path=<storage path inside the deposit-checks bucket>
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const path = new URL(request.url).searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.storage.from('deposit-checks').createSignedUrl(path, 300); // 5 minutes
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl });
}
