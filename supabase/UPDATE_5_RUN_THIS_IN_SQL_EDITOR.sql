-- ============================================================
--  UPDATE 5 — disable users, code-free login, deposit images
--  HOW TO USE: Supabase -> SQL Editor -> New query -> paste all -> Run
--  Safe to run more than once.
-- ============================================================

-- 1. New profile flags.
--    disabled        : when true the customer is locked out and sees an
--                      "account under review" screen at login.
--    code_free_until : when set to a future time the customer may sign in
--                      WITHOUT an access code until that moment passes.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS code_free_until timestamptz;

-- 2. Teach the database's access gate about code-free access.
--    A customer's data is visible when EITHER they entered a banker code in
--    the last 24 hours, OR they are inside an admin-granted code-free window.
--    A disabled customer is never allowed through, whatever the other flags say.
CREATE OR REPLACE FUNCTION public.code_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND disabled = false
      AND (
        (last_access_code_at IS NOT NULL AND last_access_code_at > now() - interval '24 hours')
        OR (code_free_until IS NOT NULL AND code_free_until > now())
      )
  );
$$;
REVOKE ALL ON FUNCTION public.code_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.code_verified() TO authenticated;

-- 3. Deposit images: a PRIVATE storage bucket for mobile check deposit photos.
--    Files are written by the server (service role) only; customers never read
--    them directly from the browser. Admins view them through a signed URL the
--    server mints. No public access.
INSERT INTO storage.buckets (id, name, public)
VALUES ('deposit-checks', 'deposit-checks', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Lock the bucket down: no anon/authenticated browser access at all.
DROP POLICY IF EXISTS "deposit_checks_no_browser_read"   ON storage.objects;
DROP POLICY IF EXISTS "deposit_checks_no_browser_write"  ON storage.objects;
CREATE POLICY "deposit_checks_no_browser_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "deposit_checks_no_browser_write" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (false);

NOTIFY pgrst, 'reload schema';

-- Done. You should see "Success. No rows returned."
