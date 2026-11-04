-- ============================================================
--  UPDATE 2 — enforce the access-code gate inside the database
--  HOW TO USE: Supabase -> SQL Editor -> New query -> paste all -> Run
--  Safe to run more than once.
-- ============================================================

-- 1. True only if the signed-in customer entered a banker-issued code in the last 24 hours.
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
      AND last_access_code_at IS NOT NULL
      AND last_access_code_at > now() - interval '24 hours'
  );
$$;
REVOKE ALL ON FUNCTION public.code_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.code_verified() TO authenticated;

-- 2. SECURITY FIX: customers must not be able to edit their own profile row
--    (that would let them change their own role or the code timestamp).
--    Profile changes now go through the server only.
DROP POLICY IF EXISTS "customers_update_own_profile" ON public.profiles;

-- 3. Customers only see their data after a valid code.
DROP POLICY IF EXISTS "customers_read_own_accounts" ON public.accounts;
CREATE POLICY "customers_read_own_accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.code_verified());

DROP POLICY IF EXISTS "customers_read_own_transactions" ON public.transactions;
CREATE POLICY "customers_read_own_transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND is_hidden = false AND public.code_verified());

DROP POLICY IF EXISTS "customers_insert_own_transactions" ON public.transactions;
CREATE POLICY "customers_insert_own_transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND is_hidden = false AND source = 'customer' AND public.code_verified());

-- Done. You should see "Success. No rows returned."
