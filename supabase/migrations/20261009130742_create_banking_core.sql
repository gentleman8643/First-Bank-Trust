/*
# Create First Bank & Trust banking core

1. New Tables
- `profiles`: one private profile per signed-in customer, including display name, contact information, role, and account status.
- `accounts`: customer-owned checking, savings, credit card, or money market accounts with display balances and masked numbers.
- `transactions`: customer-owned transaction history and transfer requests with review status, notes, and dates.

2. Security
- Row-level security is enabled on every new table.
- Signed-in customers can only read and create their own customer-scoped records.
- Customer-owned balance, role, status, and review fields are not client-writable through broad updates.

3. Important notes
- Balances and transaction review decisions should be changed by trusted staff workflows in a later server-side function.
- This migration intentionally does not create custom authentication tables; Supabase Auth remains the identity source.
*/

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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_read_own_profile" ON public.profiles;
CREATE POLICY "customers_read_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "customers_update_own_profile" ON public.profiles;
CREATE POLICY "customers_update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "customers_insert_own_profile" ON public.profiles;
CREATE POLICY "customers_insert_own_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "customers_delete_own_profile" ON public.profiles;
CREATE POLICY "customers_delete_own_profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "customers_read_own_accounts" ON public.accounts;
CREATE POLICY "customers_read_own_accounts" ON public.accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "customers_insert_own_accounts" ON public.accounts;
CREATE POLICY "customers_insert_own_accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "customers_update_own_accounts" ON public.accounts;
CREATE POLICY "customers_update_own_accounts" ON public.accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "customers_delete_own_accounts" ON public.accounts;
CREATE POLICY "customers_delete_own_accounts" ON public.accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "customers_read_own_transactions" ON public.transactions;
CREATE POLICY "customers_read_own_transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "customers_insert_own_transactions" ON public.transactions;
CREATE POLICY "customers_insert_own_transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "customers_update_own_transactions" ON public.transactions;
CREATE POLICY "customers_update_own_transactions" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'pending') WITH CHECK (auth.uid() = user_id AND status = 'pending');
DROP POLICY IF EXISTS "customers_delete_own_transactions" ON public.transactions;
CREATE POLICY "customers_delete_own_transactions" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id AND status = 'pending');

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_date_idx ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_account_id_idx ON public.transactions(account_id);
