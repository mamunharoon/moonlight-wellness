-- Sprint 2 Stage 3A: Stripe (test mode) foundation — schema only, no UI/app code.
--
-- Scope:
--   1. Additively extend public.subscriptions with the three identifiers a
--      Stripe integration needs to map its own objects back to a row here:
--      stripe_customer_id, stripe_subscription_id, stripe_price_id.
--   2. Add public.stripe_webhook_events — an idempotency ledger so a
--      redelivered Stripe webhook event is a safe no-op rather than
--      reprocessed.
--
-- Why no RLS policy changes: exactly zero. The Stage 1 migration already
-- left `subscriptions` with owner-SELECT only and no authenticated
-- INSERT/UPDATE/DELETE policy, specifically anticipating "a service-role
-- client — Stripe webhook handler, admin tool, etc." as the only writer.
-- This migration does not touch that boundary at all — the three new
-- columns are additive, and every write to them (from Stage 3A's Edge
-- Functions) goes through the service-role key, which already bypasses
-- RLS by default. No new policy is needed or added.
--
-- Why UNIQUE, nullable columns: a subscriptions row exists before a user
-- ever reaches Stripe (Stage 1's "no row = free" default), so these three
-- columns start NULL for every user and are only populated once a Stripe
-- Customer/Subscription actually exists for them. Postgres UNIQUE
-- constraints treat multiple NULLs as distinct, so many free users can
-- all have stripe_customer_id = NULL simultaneously without conflict.
--
-- Why a separate stripe_webhook_events table rather than relying on the
-- upserts alone being idempotent: the upserts genuinely are idempotent
-- (same event redelivered -> same final row state), but "webhook
-- processing must be idempotent" is stated as an explicit requirement,
-- and Stripe's own guidance is to track processed event ids and skip
-- duplicates before doing any work — this also gives a clean audit trail
-- of what was received. RLS enabled, zero policies: same "no
-- authenticated/anon access at all, service-role only" pattern already
-- used by subscriptions' own write boundary.
--
-- Out of scope (explicitly untouched by this migration): Apple/Google
-- billing, invoices, taxation, coupons, analytics, admin functions
-- (Stage 2), the entitlement model (entitlements.js's isSubscribed()
-- reads plan/status exactly as before — this migration adds columns
-- alongside them, not new enum values), and every existing RLS policy.
--
-- This migration is additive and reversible. See the paired rollback file:
--   supabase/migrations/20260808150000_sprint2_stage3a_stripe_foundation_rollback.sql
--
-- Per Sprint 2 Stage 1/2A's own precedent, this migration is written but
-- not applied to the live database in this batch — see the Stage 3A report.

BEGIN;

-- ============================================================================
-- 1. Extend public.subscriptions additively.
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_stripe_customer_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_stripe_customer_id_key UNIQUE (stripe_customer_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_stripe_subscription_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
  END IF;
END $$;

-- ============================================================================
-- 2. Create public.stripe_webhook_events additively.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies created for authenticated/anon — same "service-role only"
-- pattern as subscriptions' own write boundary. See file header.

COMMIT;
