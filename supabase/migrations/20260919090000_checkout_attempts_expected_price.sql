-- Legacy-Price Webhook Remediation — the immutable expected-price field.
--
-- Root cause being fixed here: create-checkout-session/index.ts and
-- stripe-webhook/index.ts's admission check for checkout.session.completed
-- previously re-verified the subscription's price against the CURRENT
-- STRIPE_PRICE_PLUS_MONTHLY/YEARLY secret values at event-processing time.
-- If those secrets rotate between a Checkout Session being created and its
-- completion webhook arriving, a perfectly legitimate checkout — created
-- while the old price was still current — would be wrongly rejected.
--
-- The fix: record the price actually used at the moment the Stripe
-- Checkout Session is created (an immutable, server-resolved fact,
-- never a client-supplied value — see create-checkout-session/index.ts's
-- own priceIdForInterval() call), and compare the completed session's
-- real subscription price against THAT recorded value instead of
-- whatever the secrets currently say. This makes checkout admission
-- correct regardless of price rotation timing.
--
-- Purely additive: one nullable column, no constraint changes, no data
-- migration. RLS (enabled, zero policies — default-deny for anon/
-- authenticated) and the claim_checkout_attempt RPC's service-role-only
-- grants are both completely untouched; this column is written directly
-- by create-checkout-session's own service-role client, the same way
-- stripe_checkout_session_id/checkout_url already are, not through the
-- RPC.

BEGIN;

ALTER TABLE public.checkout_attempts
  ADD COLUMN IF NOT EXISTS expected_stripe_price_id text;

COMMENT ON COLUMN public.checkout_attempts.expected_stripe_price_id IS
  'The Stripe Price ID resolved server-side (never client-supplied) at the moment this attempt''s Checkout Session was created. Used by stripe-webhook to admit checkout.session.completed even after STRIPE_PRICE_PLUS_MONTHLY/YEARLY later rotate — see this migration''s header comment.';

COMMIT;
