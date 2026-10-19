-- admin_list_subscriptions() — recognise Stripe, Apple AND Google, using
-- the same expiry-aware entitlement rules already established and live
-- (apply_verified_apple_subscription_event /
-- apply_verified_google_subscription_event, 20261018040000's own
-- candidates/granting/winner CTE), instead of only ever reading the
-- legacy, Stripe-only public.subscriptions table.
--
-- PROPOSED — NOT YET APPLIED. Prepared per explicit instruction ("don't
-- apply migrations... yet"). Not run against DEV or Production by this
-- task.
--
-- Finding this fixes (N-04,
-- reports/p2c-prg-dash-verification-2026-10-19.md): the owner's one
-- account with a currently live, non-Stripe (Apple) entitlement was
-- reported by the live admin_list_subscriptions() as a CANCELLED,
-- already-expired Stripe row — a stale, misleading legacy value, not the
-- account's real current status. Confirmed with real DEV data, read-only,
-- before this fix was written.
--
-- Why DROP + CREATE, not CREATE OR REPLACE: the RETURNS TABLE column list
-- is changing (three new columns added) — Postgres rejects an in-place
-- REPLACE that changes a function's return type; the existing function
-- must be dropped first. Nothing else about its identity (name, argument
-- list, SECURITY DEFINER, grants) changes.
--
-- Traced every real consumer before changing the return shape (see the
-- report above for the full trace): exactly one call chain exists in this
-- codebase — src/lib/adminApi.js's fetchAdminSubscriptions(), called only
-- by src/pages/AdminSubscriptions.jsx. supabase-js's .rpc() returns rows
-- as plain objects keyed by column name (PostgREST JSON, not a positional
-- tuple), so this is additive-safe for that one consumer: every existing
-- column (user_id, email, plan, status, provider, expires_at) keeps its
-- exact name and type; only new columns are added
-- (environment, cancel_at_period_end, provider_record_count). The
-- accompanying client change (same commit batch, not part of this
-- migration) reads the three new columns additively and does not require
-- them to exist to keep rendering the original five.
--
-- Resolution logic — deliberately byte-identical in shape to
-- apply_verified_*_subscription_event's own candidates/granting/winner
-- CTE (20261018040000), not a new interpretation of the rules:
--   - candidates: every provider_subscriptions row for
--     provider IN ('apple', 'google', 'manual'), UNION ALL every row in
--     the legacy public.subscriptions table — hardcoded as provider =
--     'stripe' for EVERY row in that table, exactly like the existing,
--     already-live apply_verified_* RPCs already do (not reading that
--     table's own `provider` column, which defaults to 'manual' for a
--     row admin_set_subscription_status() creates — a pre-existing
--     inconsistency in the established design, not introduced or fixed
--     here; deviating from the established hardcoding would make this
--     read-side view disagree with what apply_verified_* itself would
--     resolve for the same candidate set, which would be worse).
--   - granting: status must be access-granting
--     (trial|active|grace_period|billing_retry) AND (expires_at IS NULL
--     AND provider = 'manual') OR (expires_at IS NOT NULL AND
--     expires_at > now()) — the exact §6/expiry-guard rule.
--   - winner: DISTINCT ON (user_id), most recent verified_at wins —
--     the exact tie-break rule, mirroring 20261018040000's own
--     "safe projection refresh" bulk-recompute query.
--
-- Multi-provider users are never double-counted: the final SELECT is
-- still exactly one row per public.profiles id (LEFT JOIN, same as
-- before) — a user with both an Apple and a Google row still produces
-- exactly one output row, with provider_record_count surfacing that they
-- have more than one underlying record without duplicating the user.
-- A user whose only candidates are all expired/non-granting correctly
-- resolves to plan='free', provider=NULL — while provider_record_count
-- still reports their real (non-granting) record history, distinguishing
-- "has subscription records" from "is currently subscribed."
--
-- Owner-only access is completely unchanged: `WHERE public.is_admin()`
-- is the identical gate as before: a non-admin caller still gets zero
-- rows back, not an error (closed by default, same as every other
-- function this stage introduced). No RLS policy, no grant beyond the
-- function's own REVOKE/GRANT pair, and no other table/column is touched.
--
-- Never surfaces journal_entries or any other private content — this
-- function's own JOINs never reference that table at all.
--
-- Sandbox vs. production: the new `environment` column is sourced
-- directly from provider_subscriptions.environment for an apple/google
-- winner (NULL for a stripe/manual winner, which have no sandbox/
-- production concept in this schema). This migration does not compute or
-- expose any revenue figure — it is a read-only reconciliation column,
-- exactly the information DASH-02 ("sandbox excluded from revenue
-- metrics") will need and did not have before.
--
-- Reversible: see the paired rollback file (restores the pre-fix
-- function body verbatim, five-column return shape, Stripe-only).

BEGIN;

DROP FUNCTION IF EXISTS public.admin_list_subscriptions();

CREATE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE (
  user_id uuid,
  email text,
  plan text,
  status text,
  provider text,
  environment text,
  cancel_at_period_end boolean,
  expires_at timestamptz,
  provider_record_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT
      ps.user_id,
      ps.provider,
      ps.status,
      ps.current_period_expires_at AS expires_at,
      ps.cancel_at_period_end,
      ps.last_verified_at AS verified_at,
      ps.environment
    FROM public.provider_subscriptions ps
    WHERE ps.provider IN ('apple', 'google', 'manual')
    UNION ALL
    SELECT
      s.user_id,
      'stripe'::text AS provider,
      s.status,
      s.expires_at,
      s.cancel_at_period_end,
      s.updated_at AS verified_at,
      NULL::text AS environment
    FROM public.subscriptions s
  ),
  granting AS (
    SELECT *
    FROM candidates
    WHERE status IN ('trial', 'active', 'grace_period', 'billing_retry')
      AND (
        (expires_at IS NULL AND provider = 'manual')
        OR (expires_at IS NOT NULL AND expires_at > now())
      )
  ),
  winners AS (
    SELECT DISTINCT ON (user_id)
      user_id, provider, status, expires_at, cancel_at_period_end, environment
    FROM granting
    ORDER BY user_id, verified_at DESC NULLS LAST
  ),
  record_counts AS (
    SELECT user_id, count(*)::int AS record_count
    FROM candidates
    GROUP BY user_id
  )
  SELECT
    p.id AS user_id,
    u.email,
    CASE WHEN w.user_id IS NOT NULL THEN 'plus' ELSE 'free' END AS plan,
    COALESCE(w.status, 'active') AS status,
    w.provider,
    w.environment,
    COALESCE(w.cancel_at_period_end, false) AS cancel_at_period_end,
    w.expires_at,
    COALESCE(rc.record_count, 0) AS provider_record_count
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN winners w ON w.user_id = p.id
  LEFT JOIN record_counts rc ON rc.user_id = p.id
  WHERE public.is_admin()
  ORDER BY u.email ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;

COMMIT;
