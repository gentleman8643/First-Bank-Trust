-- ============================================================
--  First Bank & Trust — full database setup
--  HOW TO USE:
--   1. Supabase dashboard -> SQL Editor -> New query
--   2. Paste this entire file
--   3. Click "Run"
--  Safe to run more than once (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

-- ---------- 1. CORE TABLES ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'money_market')),
  masked_number text NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  available_balance numeric(14,2) NOT NULL DEFAULT 0,
  business_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  merchant text NOT NULL,
  amount numeric(14,2) NOT NULL,
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('pending', 'complete', 'cancelled', 'received')),
  category text NOT NULL DEFAULT 'General',
  note text,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. EXTRA COLUMNS ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_access_code_at timestamptz;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS institution_name text NOT NULL DEFAULT 'First Bank & Trust';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_business boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS institution_name text NOT NULL DEFAULT 'First Bank & Trust';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS counterparty_email text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS counterparty_phone text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_country text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS admin_description text;
-- is_hidden: admin can hide/show history for a customer. source: 'staff' | 'seed' | 'customer'
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- ---------- 3. ACCESS CODES ----------
CREATE TABLE IF NOT EXISTS public.member_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code_digest text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 4. CONTACT REQUESTS ----------
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  street_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  interest text NOT NULL,
  loan_reason text,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 5. ROW LEVEL SECURITY ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "customers_read_own_profile" ON public.profiles;
CREATE POLICY "customers_read_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
-- NOTE: customers get NO update policy on profiles (it would let them change their own role).
-- After running this file, also run UPDATE_2_RUN_THIS_IN_SQL_EDITOR.sql (access-code gate).
DROP POLICY IF EXISTS "customers_update_own_profile" ON public.profiles;

-- accounts (customers read their own; writes happen via server/service role)
DROP POLICY IF EXISTS "customers_read_own_accounts" ON public.accounts;
CREATE POLICY "customers_read_own_accounts" ON public.accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- transactions (customers read their own + create their own pending transfers)
DROP POLICY IF EXISTS "customers_read_own_transactions" ON public.transactions;
CREATE POLICY "customers_read_own_transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id AND is_hidden = false);
DROP POLICY IF EXISTS "customers_insert_own_transactions" ON public.transactions;
-- Customers can only ever submit PENDING transfers; the admin approves them.
CREATE POLICY "customers_insert_own_transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND is_hidden = false AND source = 'customer');

-- access codes: no browser access at all (server/service role only)
DROP POLICY IF EXISTS "no_client_access_codes" ON public.member_access_codes;
CREATE POLICY "no_client_access_codes" ON public.member_access_codes FOR SELECT TO anon, authenticated USING (false);

-- contact requests: anyone can submit, nobody can read from the browser
DROP POLICY IF EXISTS "public_submit_contact_requests" ON public.contact_requests;
CREATE POLICY "public_submit_contact_requests" ON public.contact_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public_cannot_read_contact_requests" ON public.contact_requests;
CREATE POLICY "public_cannot_read_contact_requests" ON public.contact_requests FOR SELECT TO anon, authenticated USING (false);

-- ---------- 6. INDEXES ----------
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_date_idx ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_account_id_idx ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS contact_requests_created_at_idx ON public.contact_requests(created_at DESC);

-- ============================================================
--  DONE. You should see "Success. No rows returned."
-- ============================================================
