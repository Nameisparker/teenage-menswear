-- Why a payment failed, kept where the admin can see it.
--
-- Razorpay sends error_description with every payment.failed event and the
-- webhook was throwing it away, leaving an order that says only "failed".
-- That is not enough to act on: "international cards not supported" is the
-- shop's problem to fix, "insufficient funds" is the customer's, and the two
-- look identical without this column.
--
-- Deliberately no grant. 20260901000000 revoked table-wide insert/update on
-- orders from anon and authenticated and granted named columns back, so a
-- column added afterwards is writable only by the service role — which is
-- exactly who writes this one.
alter table public.orders add column payment_error text;

comment on column public.orders.payment_error is
  'Razorpay''s error_description for the most recent failed payment attempt.
   Written by the razorpay-webhook Edge Function, and cleared when a later
   attempt on the same order succeeds.';
