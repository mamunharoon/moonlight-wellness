-- Entitlements projection — expiry guard (recurring-provider staleness fix).
--
-- PROPOSED — NOT YET APPLIED. Prepared per explicit instruction ("prepare
-- any necessary SQL changes as new forward migrations... do not apply
-- migrations... yet"). Not run against DEV or Production by this task.
-- Brought into this worktree (revenuecat-native-purchase-integration,
-- the branch actually deployed to DEV's get-beta-video-url v34) and
-- reviewed separately here, after being drafted against `dev` — this
-- header records what that review found and corrects two things the
-- draft got wrong.
--
-- Problem this fixes (found via a live DEV read-only investigation):
-- apply_verified_apple_subscription_event and
-- apply_verified_google_subscription_event (both from
-- 20260929120000_revenuecat_google_entitlement_support.sql) recompute
-- public.entitlements' single resolved row by picking the
-- access-granting (`trial|active|grace_period|billing_retry`) candidate
-- with the most recent `last_verified_at`/`updated_at` — with NO check
-- that candidate's own `expires_at`/`current_period_expires_at` is still
-- in the future. A provider whose billing period has already elapsed but
-- whose `status` column hasn't yet been flipped by a later webhook (e.g.
-- Google sent a CANCELLATION event, which correctly sets
-- cancel_at_period_end=true but leaves status='active' until a later
-- EXPIRATION event arrives) can therefore "win" the tie-break over a
-- genuinely-still-valid provider purely because it was verified more
-- recently — attributing the resolved entitlement to the wrong provider
-- and surfacing an already-past date, and, in the case where NO provider
-- is actually still valid, incorrectly continuing to report `plan='plus'`
-- indefinitely (nothing ever re-evaluates a stored row purely because
-- time passed — only a new webhook/RPC call does).
--
-- This mirrors the fix already deployed (DEV project kvdxuhyndevrfvsalgnx,
-- get-beta-video-url v34, from THIS branch) for the actual
-- media-authorization boundary:
-- supabase/functions/_shared/entitlementResolution.ts's
-- isCurrentlyAccessGranting()/isAuthorizedForPremiumAccess(). That guard
-- is correct and already tested
-- (src/lib/entitlementResolution.manualGrantExpiry.test.js,
-- src/lib/betaVideoUrlAccess.test.js) — it is NOT itself being changed
-- here. This migration brings the SAME rule into the two RPCs below, so
-- the stored `entitlements` projection stops disagreeing with the real
-- authorization boundary, and stops being wrong-by-construction if
-- anything ever starts reading it (nothing does today — see step 3's own
-- note). The client display resolver (src/lib/entitlementResolution.js)
-- gets the identical guard as a separate, non-SQL code change in this
-- same batch — see that file's own header; it is not part of this
-- migration.
--
-- Exact rule applied (identical to isCurrentlyAccessGranting):
--   1. status must still be access-granting (unchanged).
--   2. provider = 'manual' AND expires_at IS NULL -> granting (the one
--      documented exception — an indefinite legacy/admin grant).
--   3. Every other case (including a 'manual' row that DOES carry a real
--      expires_at — see 20260929120000's own RPC header and §9a of
--      docs/phase-2c-access-specification.md): granting only if
--      expires_at IS NOT NULL AND expires_at > now(). A recurring
--      provider (stripe/apple/google) with a NULL expires_at is a
--      data-integrity problem and fails closed, exactly like the
--      deployed media-authorization guard.
--
-- COMPLETE AFFECTED RPC LIST (confirmed by this review, not assumed):
-- exactly two functions write to public.entitlements anywhere in this
-- schema —
--   grep -rn "INSERT INTO public.entitlements" supabase/migrations/
-- returns only 20260916120000_apple_verified_state_rpc.sql (the
-- ORIGINAL apply_verified_apple_subscription_event body, since
-- superseded) and 20260929120000_revenuecat_google_entitlement_support.sql
-- (the CURRENT body of both RPCs — see below for why 20260916120000's own
-- copy is irrelevant to what CREATE OR REPLACE below actually targets).
-- No manual-grant RPC exists yet (Phase 2C §9a is design-only, not
-- built); stripe-webhook/index.ts never writes provider_subscriptions or
-- entitlements at all (Stripe stays on the legacy `subscriptions` table
-- only). Real call sites funnelling into these two RPCs (all unaffected
-- by this migration — same signatures, same named-argument shape):
-- supabase/functions/apple-server-notifications/index.ts,
-- supabase/functions/_shared/applyVerifiedAppleTransaction.ts (shared by
-- verify-apple-transaction and reconcile-apple-subscriptions), and
-- supabase/functions/revenuecat-webhook/index.ts (both the apple and the
-- google branch).
--
-- SIGNATURE WARNING (the reason this review exists — see
-- 20260930070000_apple_rpc_overload_cleanup.sql's own header for the
-- exact incident): CREATE OR REPLACE FUNCTION matches by EXACT argument
-- type signature, not by name alone — a signature that doesn't match the
-- live function character-for-character creates a SILENT, SHADOWING
-- OVERLOAD rather than replacing it, exactly as already happened once in
-- this schema's history. The two signatures below were re-verified
-- against the current live state, not merely copied forward:
--   - apply_verified_apple_subscription_event: 13 arguments (uuid, text,
--     text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb,
--     text, text, text) — the ONLY surviving overload, confirmed by
--     20260930070000 explicitly DROPping the stale 12-argument one (its
--     own header documents discovering TWO live overloads and the
--     call-resolution bug that caused).
--   - apply_verified_google_subscription_event: 12 arguments (uuid,
--     text, text, text, timestamptz, boolean, text, timestamptz, jsonb,
--     text, text, text) — has never had more than one signature; it was
--     born with p_verification_source already included
--     (20260929120000), so no overload-cleanup migration was ever needed
--     for it.
--
-- Deliberately NOT an edit to 20260929120000_revenuecat_google_entitlement_support.sql,
-- 20260916120000_apple_verified_state_rpc.sql, or
-- 20260930070000_apple_rpc_overload_cleanup.sql (all already applied) —
-- this is a new, additive CREATE OR REPLACE FUNCTION migration against
-- the exact signatures those three left live, the same pattern
-- 20260929120000 itself used. Same security posture (SECURITY DEFINER,
-- empty search_path, EXECUTE granted only to service_role) as the
-- versions being replaced — no grant/policy changes needed.
--
-- Reversible: see the paired rollback file (restores the pre-fix RPC
-- bodies verbatim, at the same two live signatures above — it does NOT
-- reintroduce or interact with the already-resolved 12/13-argument
-- overload incident, which is out of this migration's scope in either
-- direction).

BEGIN;

-- ============================================================================
-- 1. Apple RPC — same (sole surviving, 13-argument) signature, corrected
--    `granting` CTE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_verified_apple_subscription_event(
  p_user_id uuid,
  p_apple_original_transaction_id text,
  p_product_id text,
  p_status text,
  p_current_period_expires_at timestamptz,
  p_cancel_at_period_end boolean,
  p_environment text,
  p_apple_app_account_token uuid,
  p_last_verified_at timestamptz,
  p_raw_event_summary jsonb,
  p_provider_event_id text,
  p_event_type text,
  p_verification_source text DEFAULT NULL
)
RETURNS TABLE (applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_owner uuid;
  v_existing_verified_at timestamptz;
  v_event_inserted boolean := true;
BEGIN
  IF p_user_id IS NULL OR p_apple_original_transaction_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'apply_verified_apple_subscription_event: user_id, apple_original_transaction_id and status are required';
  END IF;

  IF p_provider_event_id IS NOT NULL THEN
    INSERT INTO public.provider_events (provider, provider_event_id, event_type, user_id, payload_summary)
    VALUES ('apple', p_provider_event_id, COALESCE(p_event_type, 'unknown'), p_user_id, p_raw_event_summary)
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING true INTO v_event_inserted;

    IF v_event_inserted IS NOT true THEN
      RETURN QUERY SELECT false, 'duplicate_event'::text;
      RETURN;
    END IF;
  END IF;

  SELECT user_id, last_verified_at
    INTO v_existing_owner, v_existing_verified_at
    FROM public.provider_subscriptions
   WHERE provider = 'apple' AND apple_original_transaction_id = p_apple_original_transaction_id
   FOR UPDATE;

  IF v_existing_owner IS NOT NULL AND v_existing_owner <> p_user_id THEN
    RAISE EXCEPTION 'apple_original_transaction_id % is already linked to a different WakeWise account', p_apple_original_transaction_id
      USING ERRCODE = 'unique_violation';
  END IF;

  IF v_existing_verified_at IS NOT NULL AND p_last_verified_at IS NOT NULL
     AND v_existing_verified_at >= p_last_verified_at THEN
    RETURN QUERY SELECT false, 'stale_event'::text;
    RETURN;
  END IF;

  INSERT INTO public.provider_subscriptions (
    user_id, provider, apple_original_transaction_id, apple_app_account_token,
    product_id, status, current_period_expires_at, cancel_at_period_end,
    environment, last_verified_at, raw_last_event, verification_source, updated_at
  ) VALUES (
    p_user_id, 'apple', p_apple_original_transaction_id, p_apple_app_account_token,
    p_product_id, p_status, p_current_period_expires_at, COALESCE(p_cancel_at_period_end, false),
    p_environment, COALESCE(p_last_verified_at, now()), p_raw_event_summary, p_verification_source, now()
  )
  ON CONFLICT (provider, apple_original_transaction_id) DO UPDATE SET
    apple_app_account_token = excluded.apple_app_account_token,
    product_id = excluded.product_id,
    status = excluded.status,
    current_period_expires_at = excluded.current_period_expires_at,
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, public.provider_subscriptions.cancel_at_period_end),
    environment = excluded.environment,
    last_verified_at = excluded.last_verified_at,
    raw_last_event = excluded.raw_last_event,
    verification_source = COALESCE(excluded.verification_source, public.provider_subscriptions.verification_source),
    updated_at = now();

  -- Recompute the unified entitlements row — same three-provider
  -- candidate set as before, now additionally requiring the winning
  -- candidate's own expiry to still be current (the fix). Mirrors
  -- supabase/functions/_shared/entitlementResolution.ts's
  -- isCurrentlyAccessGranting() exactly: a null expires_at only grants
  -- for provider='manual'; every other case needs a real, still-future
  -- expires_at.
  WITH candidates AS (
    SELECT provider, status, current_period_expires_at AS expires_at,
           cancel_at_period_end, last_verified_at AS verified_at
      FROM public.provider_subscriptions
     WHERE user_id = p_user_id AND provider IN ('apple', 'google')
    UNION ALL
    SELECT 'stripe'::text, status, expires_at, cancel_at_period_end, updated_at
      FROM public.subscriptions
     WHERE user_id = p_user_id
  ),
  granting AS (
    SELECT * FROM candidates
     WHERE status IN ('trial', 'active', 'grace_period', 'billing_retry')
       AND (
         (expires_at IS NULL AND provider = 'manual')
         OR (expires_at IS NOT NULL AND expires_at > now())
       )
  ),
  winner AS (
    SELECT * FROM granting ORDER BY verified_at DESC NULLS LAST LIMIT 1
  )
  INSERT INTO public.entitlements (user_id, plan, status, active_provider, expires_at, cancel_at_period_end, updated_at)
  SELECT
    p_user_id,
    CASE WHEN EXISTS (SELECT 1 FROM winner) THEN 'plus' ELSE 'free' END,
    COALESCE((SELECT status FROM winner), 'active'),
    (SELECT provider FROM winner),
    (SELECT expires_at FROM winner),
    COALESCE((SELECT cancel_at_period_end FROM winner), false),
    now()
  ON CONFLICT (user_id) DO UPDATE SET
    plan = excluded.plan,
    status = excluded.status,
    active_provider = excluded.active_provider,
    expires_at = excluded.expires_at,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();

  RETURN QUERY SELECT true, 'applied'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text, text
) FROM anon;
REVOKE ALL ON FUNCTION public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text, text
) TO service_role;

-- ============================================================================
-- 2. Google RPC — same (sole, 12-argument) signature, corrected `granting`
--    CTE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_verified_google_subscription_event(
  p_user_id uuid,
  p_google_purchase_token text,
  p_product_id text,
  p_status text,
  p_current_period_expires_at timestamptz,
  p_cancel_at_period_end boolean,
  p_environment text,
  p_last_verified_at timestamptz,
  p_raw_event_summary jsonb,
  p_provider_event_id text,
  p_event_type text,
  p_verification_source text DEFAULT 'revenuecat'
)
RETURNS TABLE (applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_owner uuid;
  v_existing_verified_at timestamptz;
  v_event_inserted boolean := true;
BEGIN
  IF p_user_id IS NULL OR p_google_purchase_token IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'apply_verified_google_subscription_event: user_id, google_purchase_token and status are required';
  END IF;

  IF p_provider_event_id IS NOT NULL THEN
    INSERT INTO public.provider_events (provider, provider_event_id, event_type, user_id, payload_summary)
    VALUES ('google', p_provider_event_id, COALESCE(p_event_type, 'unknown'), p_user_id, p_raw_event_summary)
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING true INTO v_event_inserted;

    IF v_event_inserted IS NOT true THEN
      RETURN QUERY SELECT false, 'duplicate_event'::text;
      RETURN;
    END IF;
  END IF;

  SELECT user_id, last_verified_at
    INTO v_existing_owner, v_existing_verified_at
    FROM public.provider_subscriptions
   WHERE provider = 'google' AND google_purchase_token = p_google_purchase_token
   FOR UPDATE;

  IF v_existing_owner IS NOT NULL AND v_existing_owner <> p_user_id THEN
    RAISE EXCEPTION 'google_purchase_token is already linked to a different WakeWise account'
      USING ERRCODE = 'unique_violation';
  END IF;

  IF v_existing_verified_at IS NOT NULL AND p_last_verified_at IS NOT NULL
     AND v_existing_verified_at >= p_last_verified_at THEN
    RETURN QUERY SELECT false, 'stale_event'::text;
    RETURN;
  END IF;

  INSERT INTO public.provider_subscriptions (
    user_id, provider, google_purchase_token,
    product_id, status, current_period_expires_at, cancel_at_period_end,
    environment, last_verified_at, raw_last_event, verification_source, updated_at
  ) VALUES (
    p_user_id, 'google', p_google_purchase_token,
    p_product_id, p_status, p_current_period_expires_at, COALESCE(p_cancel_at_period_end, false),
    p_environment, COALESCE(p_last_verified_at, now()), p_raw_event_summary, p_verification_source, now()
  )
  ON CONFLICT (provider, google_purchase_token) DO UPDATE SET
    product_id = excluded.product_id,
    status = excluded.status,
    current_period_expires_at = excluded.current_period_expires_at,
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, public.provider_subscriptions.cancel_at_period_end),
    environment = excluded.environment,
    last_verified_at = excluded.last_verified_at,
    raw_last_event = excluded.raw_last_event,
    verification_source = COALESCE(excluded.verification_source, public.provider_subscriptions.verification_source),
    updated_at = now();

  -- Same corrected recompute as the Apple RPC above — kept as an
  -- identical, independent copy (matching 20260929120000's own stated
  -- reasoning for not sharing a PL/pgSQL helper between the two RPCs).
  WITH candidates AS (
    SELECT provider, status, current_period_expires_at AS expires_at,
           cancel_at_period_end, last_verified_at AS verified_at
      FROM public.provider_subscriptions
     WHERE user_id = p_user_id AND provider IN ('apple', 'google')
    UNION ALL
    SELECT 'stripe'::text, status, expires_at, cancel_at_period_end, updated_at
      FROM public.subscriptions
     WHERE user_id = p_user_id
  ),
  granting AS (
    SELECT * FROM candidates
     WHERE status IN ('trial', 'active', 'grace_period', 'billing_retry')
       AND (
         (expires_at IS NULL AND provider = 'manual')
         OR (expires_at IS NOT NULL AND expires_at > now())
       )
  ),
  winner AS (
    SELECT * FROM granting ORDER BY verified_at DESC NULLS LAST LIMIT 1
  )
  INSERT INTO public.entitlements (user_id, plan, status, active_provider, expires_at, cancel_at_period_end, updated_at)
  SELECT
    p_user_id,
    CASE WHEN EXISTS (SELECT 1 FROM winner) THEN 'plus' ELSE 'free' END,
    COALESCE((SELECT status FROM winner), 'active'),
    (SELECT provider FROM winner),
    (SELECT expires_at FROM winner),
    COALESCE((SELECT cancel_at_period_end FROM winner), false),
    now()
  ON CONFLICT (user_id) DO UPDATE SET
    plan = excluded.plan,
    status = excluded.status,
    active_provider = excluded.active_provider,
    expires_at = excluded.expires_at,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();

  RETURN QUERY SELECT true, 'applied'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_verified_google_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, timestamptz, jsonb, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_verified_google_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, timestamptz, jsonb, text, text, text
) FROM anon;
REVOKE ALL ON FUNCTION public.apply_verified_google_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, timestamptz, jsonb, text, text, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_google_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, timestamptz, jsonb, text, text, text
) TO service_role;

-- ============================================================================
-- 3. Safe projection refresh.
--
-- Every row written under the OLD (buggy) rule may already be wrong in
-- TWO distinct ways, not one:
--   (a) plan may say 'plus' with NOTHING genuinely valid behind it any
--       more (every candidate has actually lapsed) — this run corrects
--       that to 'free'.
--   (b) plan may correctly stay 'plus', but active_provider/expires_at/
--       status/cancel_at_period_end may be ATTRIBUTED TO THE WRONG
--       RECORD — exactly the live case this task's own investigation
--       found (Google's stale-but-recently-verified row outranking a
--       genuinely-valid Apple row). This run RE-POINTS such a row at the
--       actually-valid record, while plan stays 'plus' throughout. This
--       is a real, user-visible change in what is displayed (a different
--       provider, a different date), not merely an internal detail — do
--       not describe this step as "only ever downgrades" or "narrows
--       access": it corrects attribution for a row that keeps granting
--       access just as much as it can revoke a row that no longer should.
--
-- What this run can NEVER do: turn a row that is correctly 'free' under
-- the OLD rule into 'plus' under the NEW one. The new rule is a strict
-- subset of the old `granting` filter (adds an expiry condition, removes
-- nothing) — a candidate the old rule excluded is still excluded by the
-- new one. So the only two possible transitions for `plan` are
-- 'plus' -> 'plus' (possibly re-attributed, per (b) above) and
-- 'plus' -> 'free' (per (a) above); 'free' -> 'plus' cannot happen.
--
-- Idempotent and safe to re-run: read-then-upsert, no destructive delete,
-- touches no subscriptions/provider_subscriptions row — only
-- public.entitlements, and only for users who already have at least one
-- subscriptions/provider_subscriptions row.
--
-- Blast radius today: public.entitlements has no confirmed reader
-- anywhere in this codebase as of this review (grep for
-- "from('entitlements')"/"public.entitlements" across src/ and
-- supabase/functions/ turns up only the two RPCs writing it and this
-- migration's own files) — so this step's practical effect today is
-- "stop storing a wrong snapshot," not "change what any user sees," since
-- nothing reads the snapshot yet. It is included regardless so the table
-- is correct from the moment anything does start reading it, rather than
-- carrying forward pre-fix data indefinitely.
-- ============================================================================

WITH target_users AS (
  SELECT user_id FROM public.provider_subscriptions
  UNION
  SELECT user_id FROM public.subscriptions
),
candidates AS (
  SELECT u.user_id, ps.provider, ps.status, ps.current_period_expires_at AS expires_at,
         ps.cancel_at_period_end, ps.last_verified_at AS verified_at
    FROM target_users u
    JOIN public.provider_subscriptions ps ON ps.user_id = u.user_id AND ps.provider IN ('apple', 'google')
  UNION ALL
  SELECT u.user_id, 'stripe'::text, s.status, s.expires_at, s.cancel_at_period_end, s.updated_at
    FROM target_users u
    JOIN public.subscriptions s ON s.user_id = u.user_id
),
granting AS (
  SELECT * FROM candidates
   WHERE status IN ('trial', 'active', 'grace_period', 'billing_retry')
     AND (
       (expires_at IS NULL AND provider = 'manual')
       OR (expires_at IS NOT NULL AND expires_at > now())
     )
),
winners AS (
  SELECT DISTINCT ON (user_id) user_id, provider, status, expires_at, cancel_at_period_end
    FROM granting
   ORDER BY user_id, verified_at DESC NULLS LAST
)
INSERT INTO public.entitlements (user_id, plan, status, active_provider, expires_at, cancel_at_period_end, updated_at)
SELECT
  u.user_id,
  CASE WHEN w.user_id IS NOT NULL THEN 'plus' ELSE 'free' END,
  COALESCE(w.status, 'active'),
  w.provider,
  w.expires_at,
  COALESCE(w.cancel_at_period_end, false),
  now()
FROM target_users u
LEFT JOIN winners w ON w.user_id = u.user_id
ON CONFLICT (user_id) DO UPDATE SET
  plan = excluded.plan,
  status = excluded.status,
  active_provider = excluded.active_provider,
  expires_at = excluded.expires_at,
  cancel_at_period_end = excluded.cancel_at_period_end,
  updated_at = now();

COMMIT;
