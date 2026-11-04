-- ============================================================
--  UPDATE 4 — more account types, messages, notifications
--  HOW TO USE: Supabase -> SQL Editor -> New query -> paste all -> Run
--  Safe to run more than once.
-- ============================================================

-- 1. Accounts: credit cards, IRA, loans and mortgages need more types and a place for their details.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.accounts'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.accounts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('checking', 'savings', 'money_market', 'credit_card', 'ira', 'loan', 'mortgage'));

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Messages between a customer and their banker.
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,   -- the customer the conversation belongs to
  sender text NOT NULL CHECK (sender IN ('customer', 'staff')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS messages_user_created_idx ON public.messages (user_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_read_own_messages" ON public.messages;
CREATE POLICY "customers_read_own_messages" ON public.messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id AND public.code_verified());
DROP POLICY IF EXISTS "customers_send_own_messages" ON public.messages;
CREATE POLICY "customers_send_own_messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND sender = 'customer' AND read_at IS NULL AND public.code_verified());

-- 3. Notifications shown under the bell.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_read_own_notifications" ON public.notifications;
CREATE POLICY "customers_read_own_notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id AND public.code_verified());
-- No insert/update/delete policies: notifications are created by the server only.

-- 4. Customers may only flip "read" on their OWN rows, via these two functions (never edit content).
CREATE OR REPLACE FUNCTION public.mark_messages_read()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.messages SET read_at = now()
  WHERE user_id = auth.uid() AND sender = 'staff' AND read_at IS NULL AND public.code_verified();
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.notifications SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL AND public.code_verified();
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Done. You should see "Success. No rows returned."
