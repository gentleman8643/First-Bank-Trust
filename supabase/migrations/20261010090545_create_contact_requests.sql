/*
# Create public banking contact requests

1. New Tables
- `contact_requests`: inquiry records submitted by visitors who want a new account, loan, money market account, or credit card.
- `contact_requests.id`: generated request identifier.
- `contact_requests.full_name`, `email`, `phone`, `street_address`, `city`, `state`, `zip_code`: visitor contact details.
- `contact_requests.interest`: the product selected by the visitor.
- `contact_requests.loan_reason`: optional reason when the visitor asks about a loan.
- `contact_requests.message`: optional additional context.
- `contact_requests.status`: internal workflow status, initially `new`.
- `contact_requests.created_at`: submission timestamp.

2. Security
- Row-level security is enabled.
- Visitors may submit a request without signing in.
- Visitors cannot read, edit, or delete submitted requests.

3. Important notes
- Staff review access should be added through a trusted server-side staff workflow rather than exposing customer inquiries to the public browser.
*/

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  street_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  interest text NOT NULL CHECK (interest IN ('Checking account', 'Savings account', 'Money market', 'Credit card', 'Personal loan', 'Home loan', 'Auto loan', 'Business banking')),
  loan_reason text,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_submit_contact_requests" ON public.contact_requests;
CREATE POLICY "public_submit_contact_requests" ON public.contact_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public_cannot_read_contact_requests" ON public.contact_requests;
CREATE POLICY "public_cannot_read_contact_requests" ON public.contact_requests FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "public_cannot_update_contact_requests" ON public.contact_requests;
CREATE POLICY "public_cannot_update_contact_requests" ON public.contact_requests FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "public_cannot_delete_contact_requests" ON public.contact_requests;
CREATE POLICY "public_cannot_delete_contact_requests" ON public.contact_requests FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX IF NOT EXISTS contact_requests_created_at_idx ON public.contact_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS contact_requests_interest_idx ON public.contact_requests(interest);
