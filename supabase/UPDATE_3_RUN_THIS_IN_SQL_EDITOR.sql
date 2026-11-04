-- ============================================================
--  UPDATE 3 — countries and currencies
--  HOW TO USE: Supabase -> SQL Editor -> New query -> paste all -> Run
--  Safe to run more than once. Existing customers default to
--  United States / USD; you can change them later in the admin panel.
-- ============================================================

ALTER TABLE public.profiles     ADD COLUMN IF NOT EXISTS country  text NOT NULL DEFAULT 'United States';
ALTER TABLE public.accounts     ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Done. You should see "Success. No rows returned."
