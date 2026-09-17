-- Apple Subscription Architecture task, Phase D — the two confirmed
-- Stripe gaps from the earlier release-readiness audits:
--   (1) the advertised 7-day trial was never actually passed to Stripe
--       Checkout (no `subscription_data.trial_period_days`), and there
--       was no server-side record of whether a user had already used
--       one, so a repeat-trial check had nothing reliable to read;
--   (2) the webhook never handled `charge.refunded`/`charge.dispute.created`,
--       so a Stripe-side refund did not revoke entitlement.
--
-- APPLIED. Applied to the linked DEV project (kvdxuhyndevrfvsalgnx) and
-- live-verified on 2026-09-16, alongside 20260916100000 — see commit
-- ab68b7f ("docs: record applied and verified Apple subscription
-- database foundation") and `docs/apple-subscription-implementation.md`
-- Phase C. Confirmed present in the live migration ledger (`supabase
-- migration list --linked`, re-checked 2026-09-17). This comment
-- originally read "PROPOSED — NOT YET APPLIED... Not run against the
-- live project by this task," which is stale. Only this comment was
-- corrected; no executable SQL in this file was changed.
--
-- Both additions are minimal and additive to the existing `subscriptions`
-- table — no existing column, policy, or grant is touched.
--
--   trial_used_at: set server-side, once, the first time a trial is
--   actually confirmed started (stripe-webhook's checkout.session.completed
--   handler, only when the resulting subscription's status is
--   'trialing' — never set merely because a checkout session was
--   *created*, so an abandoned checkout never burns a user's one trial).
--   create-checkout-session reads this (never a client-supplied
--   "eligible" flag) to decide whether to pass
--   `subscription_data.trial_period_days` at all — see the accompanying
--   code change in supabase/functions/create-checkout-session/index.ts
--   and the new isTrialEligible() in
--   supabase/functions/_shared/planMapping.ts.
--
--   status now also allows 'refunded' — mapped from Stripe's
--   `charge.refunded` webhook event (see the accompanying code change in
--   supabase/functions/stripe-webhook/index.ts). Already excluded from
--   entitlements.js's ACTIVE_STATUSES (only 'trial'/'active' grant
--   access), so this alone revokes access — no change to
--   src/lib/entitlements.js was needed or made.
--   `charge.dispute.created` maps to the existing 'cancelled' value
--   (immediate access suspension pending resolution), not a new one —
--   kept minimal per this migration's own scope.
--
-- Reversible: see the paired rollback file.

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;

-- The original migration (20260807210000_sprint2_subscriptions_foundation.sql)
-- declared `status`'s CHECK inline with no explicit constraint name, so
-- Postgres auto-named it — normally `subscriptions_status_check` by its
-- own default convention, but this is looked up dynamically rather than
-- assumed, since this migration cannot be run against the live project
-- to confirm the exact name before being written (see this task's own
-- "do not apply migrations to a live project" instruction). Finds
-- whichever CHECK constraint currently governs the `status` column and
-- drops exactly that one, so the new, wider constraint added right after
-- is the only one left enforcing it — never two constraints silently
-- stacking, which would leave the old, narrower one still rejecting
-- 'refunded' even after this migration "succeeded".
DO $$
DECLARE
  existing_check_name text;
BEGIN
  SELECT con.conname INTO existing_check_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY (con.conkey)
  WHERE con.conrelid = 'public.subscriptions'::regclass
    AND con.contype = 'c'
    AND att.attname = 'status'
  LIMIT 1;

  IF existing_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', existing_check_name);
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trial', 'active', 'cancelled', 'expired', 'refunded'));

COMMIT;
