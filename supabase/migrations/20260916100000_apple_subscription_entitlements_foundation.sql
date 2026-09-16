-- Apple Subscription Architecture, Phase C — provider-neutral entitlement
-- foundation.
--
-- *** PROPOSED — NOT YET APPLIED. This migration was written as part of
-- "Implement the first safe, testable phase of native Apple
-- subscriptions" and was deliberately NOT run against the live project —
-- see that task's own explicit "Do not apply migrations to a live
-- project during this task" instruction. Applying it is a future,
-- separate, deliberate action requiring explicit owner approval, exactly
-- like every other migration in this project (see
-- supabase/migration-support/README.md). ***
--
-- Implements the schema proposed in docs/apple-subscription-architecture.md
-- §7: a provider-neutral `entitlements` table (the one row per user a
-- future entitlement check should read once a later task cuts over to
-- it) fed by `provider_subscriptions` (one row per user x provider x
-- provider-specific subscription identity — Stripe and Apple can coexist
-- for the same user, unlike the existing single-row-per-user
-- `subscriptions` table) and `provider_events` (an append-only,
-- idempotency-enforcing audit trail generalising this project's own
-- already-proven stripe_webhook_events pattern to every provider).
--
-- Deliberately additive: does not touch `subscriptions`, its RLS
-- policies, or any existing Stripe code path. `subscriptions` remains
-- the live, authoritative table SubscriptionContext.jsx reads from —
-- cutting the app over to reading `entitlements` instead is explicitly
-- out of scope for this migration and this task.
--
-- Security requirements (all satisfied below, matching this project's
-- already-verified `subscriptions`/`account_deletion_requests`/the
-- 20260915160000 harden migration's own pattern, confirmed live-tested
-- in a prior task in this series):
--   - RLS enabled on every new table.
--   - `authenticated` may SELECT only their own row on `entitlements`
--     and `provider_subscriptions` — no INSERT/UPDATE/DELETE policy is
--     defined for authenticated on any of the three tables, so RLS's
--     default-deny blocks every write regardless of the table-level
--     grant; the explicit REVOKEs below are additional, deliberate
--     defense-in-depth on top of that (not the only thing preventing a
--     write), matching 20260915160000's own stated reasoning for
--     exactly this belt-and-suspenders pattern.
--   - `provider_events` has no policy for authenticated/anon at all and
--     no grant either — support/audit access only, via the service
--     role.
--   - The two unique constraints on `provider_subscriptions`
--     (provider+stripe_subscription_id, provider+apple_original_transaction_id)
--     are what makes an Apple original transaction id (or a Stripe
--     subscription id) unable to ever be linked to two different
--     WakeWise accounts at the database level, not merely by
--     application-code discipline.
--   - `provider_events`' own unique constraint (provider+provider_event_id)
--     is the idempotency/replay-protection backstop for both the future
--     Apple Server Notifications handler and any other provider.
--
-- No server-verified data is written by this migration — it only
-- creates the tables. Every actual write must go through a service-role
-- Edge Function (supabase/functions/verify-apple-transaction,
-- supabase/functions/apple-server-notifications — both added in this
-- same task as fail-closed stubs, since real verification requires
-- Apple credentials this task does not have and must not commit).
--
-- Reversible: see the paired rollback file. No existing table, column,
-- policy, or data is touched by this migration in any way.

BEGIN;

-- ============================================================================
-- 1. entitlements — the single, precedence-resolved row per user.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trial', 'active', 'grace_period', 'billing_retry', 'cancelled', 'expired', 'refunded', 'revoked')),
  active_provider text CHECK (active_provider IN ('stripe', 'apple', 'google', 'manual')),
  expires_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. provider_subscriptions — one row per user x provider x identity;
--    the full evidence trail multiple simultaneous providers need.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.provider_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'apple', 'google', 'manual')),
  -- Provider-specific identifiers — nullable because each provider only
  -- populates its own column(s); never a shared/overloaded key.
  stripe_customer_id text,
  stripe_subscription_id text,
  apple_original_transaction_id text,
  apple_app_account_token uuid,
  google_purchase_token text,
  product_id text,
  status text NOT NULL
    CHECK (status IN ('trial', 'active', 'grace_period', 'billing_retry', 'cancelled', 'expired', 'refunded', 'revoked')),
  current_period_expires_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  -- Apple/Google only — a sandbox transaction must never be able to
  -- satisfy a production entitlement check, or vice versa.
  environment text CHECK (environment IN ('production', 'sandbox')),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  -- Minimum non-sensitive evidence only — never a full JWS/receipt. See
  -- docs/apple-subscription-architecture.md §7's retention note.
  raw_last_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT provider_subscriptions_stripe_sub_unique UNIQUE (provider, stripe_subscription_id),
  CONSTRAINT provider_subscriptions_apple_txn_unique UNIQUE (provider, apple_original_transaction_id)
);

CREATE INDEX IF NOT EXISTS provider_subscriptions_user_id_idx ON public.provider_subscriptions (user_id);

-- ============================================================================
-- 3. provider_events — append-only idempotency + audit trail, every
--    provider, generalising stripe_webhook_events.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe', 'apple', 'google')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload_summary jsonb,

  CONSTRAINT provider_events_unique UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS provider_events_user_id_idx ON public.provider_events (user_id);

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY entitlements_select_own ON public.entitlements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY provider_subscriptions_select_own ON public.provider_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- provider_events: intentionally zero policies for authenticated or
-- anon — RLS enabled + no policy = zero rows returned for any
-- non-service-role caller, by design.

-- ============================================================================
-- 5. Grants — explicit defense-in-depth on top of RLS (see header note).
-- ============================================================================

REVOKE ALL ON public.entitlements FROM anon;
REVOKE ALL ON public.provider_subscriptions FROM anon;
REVOKE ALL ON public.provider_events FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.entitlements FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.provider_subscriptions FROM authenticated;
REVOKE ALL ON public.provider_events FROM authenticated;

GRANT SELECT ON public.entitlements TO authenticated;
GRANT SELECT ON public.provider_subscriptions TO authenticated;
-- provider_events: no grant to authenticated at all.

COMMIT;
