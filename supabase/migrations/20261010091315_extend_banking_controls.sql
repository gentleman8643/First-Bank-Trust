/*
# Extend banking controls and transfer details

1. Modified tables
- `profiles.username`: stable member login name.
- `profiles.last_access_code_at`: timestamp used to require another code after the 24-hour access window.
- `accounts.institution_name`: bank or card provider shown on account and payment history.
- `accounts.is_business`: marks business accounts.
- `transactions.institution_name`: provider or receiving bank shown to members.
- `transactions.counterparty_email` and `counterparty_phone`: required transfer contact fields.
- `transactions.transfer_country`: selected destination country.
- `transactions.payment_details`: structured wire details for the selected country.
- `transactions.admin_description`: staff-authored review or cancellation note.

2. New Tables
- `member_access_codes`: one row per member identity with a username, one-time code digest, expiry, and last-use timestamp. Raw codes are never stored.

3. Security
- Existing customer-owned row policies remain in place.
- Access-code rows are private to the authenticated member and cannot be read by anonymous visitors.
- Sensitive balance, status, and review fields remain outside customer-editable workflows.

4. Important notes
- A trusted staff function should create the digest and rotate codes in production.
- Wire payment details are stored as structured JSON so the form can support country-specific fields without changing the table.
*/

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

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.member_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code_digest text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_access_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_read_own_access_code" ON public.member_access_codes;
CREATE POLICY "members_read_own_access_code" ON public.member_access_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "members_insert_own_access_code" ON public.member_access_codes;
CREATE POLICY "members_insert_own_access_code" ON public.member_access_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "members_update_own_access_code" ON public.member_access_codes;
CREATE POLICY "members_update_own_access_code" ON public.member_access_codes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "members_delete_own_access_code" ON public.member_access_codes;
CREATE POLICY "members_delete_own_access_code" ON public.member_access_codes FOR DELETE TO authenticated USING (auth.uid() = user_id);
