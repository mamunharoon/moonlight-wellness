-- Sprint 2 Stage 1: subscriptions table — foundation only, no payment processing.
--
-- Scope:
--   1. Create public.subscriptions: one row per user, tracking plan/status/
--      provider for future entitlement checks.
--   2. Enable RLS with a SELECT-only policy for `authenticated`.
--
-- Purpose:
--   Establishes the subscription foundation (plans, entitlement checks,
--   future Stripe/Apple/Google compatibility) this sprint's application
--   layer (src/lib/entitlements.js, src/context/SubscriptionContext.jsx)
--   is built against. No plan-assignment mechanism exists yet — this
--   migration creates the table only, it does not backfill or grant any
--   user a row. A user with no row is treated as plan='free' by the
--   application layer (see SubscriptionContext.jsx), so this table being
--   entirely empty after this migration runs is the expected, correct
--   starting state, not a bug.
--
-- Why one row per user (UNIQUE(user_id)), not a subscription-history
-- table: this sprint explicitly excludes real payment processing,
-- invoicing, and billing history — a single current-state row per user
-- is the smallest design that satisfies "current plan / status / renewal
-- date" (this sprint's actual UI requirement) without speculatively
-- building history tracking nothing yet writes to. A future payments
-- stage can evolve this without a breaking change: it would add new
-- tables (invoices, events) that reference this one, not restructure it.
--
-- Why no INSERT/UPDATE/DELETE policy for `authenticated`: this table's
-- own plan/status columns are the sole authority the entitlement layer
-- trusts. With no payment verification in this sprint, granting
-- self-service writes would let any signed-in user grant themselves
-- 'plus' for free. Writes are reserved for a future trusted process
-- (a service-role client — Stripe webhook handler, admin tool, etc. —
-- which bypasses RLS by default and therefore needs no additional
-- policy here). This is also the "underlying architecture" for the
-- future admin portal referenced in this sprint's brief: the schema
-- already supports service-role management; no admin-specific schema
-- work is needed until that portal is actually built.
--
-- Out of scope (explicitly untouched by this migration): every other
-- table, all Stripe/Apple/Google integration, invoices, taxation,
-- discount codes, coupons, affiliate programs, analytics.
--
-- This migration is additive and reversible. See the paired rollback file:
--   supabase/migrations/20260807210000_sprint2_subscriptions_foundation_rollback.sql

BEGIN;

-- ============================================================================
-- 1. Create public.subscriptions additively. Do not assume the table is
--    absent — safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'cancelled', 'expired')),
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'stripe', 'apple', 'google')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. One subscription row per user, idempotent via pg_constraint
--    inspection — matches the Stage 2B convention (PostgreSQL has no
--    ADD CONSTRAINT IF NOT EXISTS syntax).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_user_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ============================================================================
-- 3. RLS: owner-read only. No `authenticated` INSERT/UPDATE/DELETE policy
--    is created — see the file header for why. No USING (true). No
--    `public` or `anon` role. No service-role key here (service role
--    bypasses RLS by default and needs none).
-- ============================================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

COMMIT;
