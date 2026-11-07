import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// A signed-in customer uploads the front and back photos of a cheque for mobile deposit.
// Requires a valid session token. Files go into the private 'deposit-checks' bucket
// under the customer's own user id; the paths are returned for storing on the deposit.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const admin = getAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    const userId = userData.user.id;

    const form = await request.formData();
    const front = form.get('front');
    const back = form.get('back');
    if (!(front instanceof File) || !(back instanceof File)) {
      return NextResponse.json({ error: 'Both the front and back images are required.' }, { status: 400 });
    }

    const save = async (file: File, side: 'front' | 'back'): Promise<string> => {
      if (file.size === 0) throw new Error(`The ${side} image is empty.`);
      if (file.size > MAX_BYTES) throw new Error(`The ${side} image is larger than 8 MB.`);
      if (!ALLOWED.includes(file.type)) throw new Error(`The ${side} image must be a photo (JPEG, PNG, WebP or HEIC).`);
      const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const path = `${userId}/${Date.now()}-${side}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error } = await admin.storage.from('deposit-checks').upload(path, bytes, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      return path;
    };

    const frontPath = await save(front, 'front');
    const backPath = await save(back, 'back');

    return NextResponse.json({ ok: true, frontPath, backPath });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
