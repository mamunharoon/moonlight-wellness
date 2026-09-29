-- WakeWise Phase 2B — RevenueCat / Google entitlement support.
--
-- *** PROPOSED — NOT YET APPLIED. *** Prepared per Phase 2B's own explicit
-- instruction ("prepare any required migration... do not apply it without
-- my explicit approval"). Not run against DEV or Production by this task.
-- See the paired validate/rollback files and the Phase 2B report.
--
-- Extends the already-applied, already-live
-- 20260916100000_apple_subscription_entitlements_foundation.sql /
-- 20260916120000_apple_verified_state_rpc.sql — this migration adds
-- exactly what is missing for Google (via RevenueCat) to participate
-- safely in the same multi-provider entitlement model Apple already uses,
-- without touching a single existing row, policy, or grant those two
-- migrations created.
--
-- What this migration does, and why each piece is needed:
--
--   1. provider_subscriptions_google_token_unique — a UNIQUE
--      (provider, google_purchase_token) constraint, mirroring the
--      existing provider_subscriptions_stripe_sub_unique /
--      provider_subscriptions_apple_txn_unique constraints exactly. Today
--      Apple has this DB-level "one purchase identity can never belong to
--      two WakeWise accounts" backstop; Google does not, because nothing
--      has ever written a google_purchase_token before now. Required
--      before any Google write path (this migration's own new RPC below)
--      can safely exist.
--
--   2. provider_subscriptions.verification_source — a new, nullable text
--      column recording where a row's last write actually came from
--      ('stripe_webhook' | 'apple_direct' | 'revenuecat' | 'manual').
--      Existing rows (there are none in production yet — Apple
--      credentials remain unconfigured, per the Phase 1 audit) are
--      unaffected; the column defaults to NULL, meaning "not recorded,"
--      never a guessed value for a row written before this column
--      existed. This is what lets a future client read
--      (entitlementSnapshot.js, already prepared to read it once this is
--      applied — see that file's own header) report an honest
--      "last verification source" instead of only inferring it from
--      provider alone.
--
--   3. CREATE OR REPLACE FUNCTION public.apply_verified_apple_subscription_event
--      — the EXISTING, already-applied Apple RPC, re-defined with the
--      SAME signature plus one new optional parameter
--      (p_verification_source, default NULL — so the existing Apple Edge
--      Functions that call this RPC today, which do not pass this
--      parameter, are completely unaffected and continue to work
--      unmodified) and one corrected line in its own entitlement-recompute
--      CTE: the "candidates" query now also UNIONs any 'google' row the
--      user has in provider_subscriptions. Without this fix, a user with
--      BOTH an Apple and a Google subscription would have their Google
--      entitlement silently ignored every time the Apple RPC recomputes
--      `entitlements` — exactly the kind of "losing sight of another
--      verified provider" bug this phase's own architecture explicitly
--      forbids. This RPC has never been exercised against real production
--      data (Apple credentials remain unconfigured — see the Phase 1
--      audit), so this change carries effectively zero live-data risk
--      today.
--
--   4. CREATE FUNCTION public.apply_verified_google_subscription_event —
--      a NEW function, the exact structural mirror of the Apple RPC
--      (idempotent event recording, ownership enforcement via the new
--      unique constraint above with row-level locking, newer-wins
--      ordering, upsert provider_subscriptions, recompute entitlements
--      from ALL THREE providers). Callable only by service_role, exactly
--      like its Apple counterpart — never reachable by any
--      client-authenticated role.
--
-- Security properties (identical to the existing Apple RPC, see that
-- migration's own header for the full rationale, not repeated here):
-- SECURITY DEFINER with a fixed empty search_path, EXECUTE revoked from
-- PUBLIC/anon/authenticated and granted only to service_role, no SQL
-- string concatenation with any untrusted value, ownership conflicts
-- raise an exception rather than silently reassigning.
--
-- Reversible: see the paired rollback file.

BEGIN;

-- ============================================================================
-- 1. Google uniqueness backstop.
-- ============================================================================

ALTER TABLE public.provider_subscriptions
  ADD CONSTRAINT provider_subscriptions_google_token_unique UNIQUE (provider, google_purchase_token);

-- ============================================================================
-- 2. verification_source — honest "where did this come from" recording.
-- ============================================================================

ALTER TABLE public.provider_subscriptions
  ADD COLUMN verification_source text
    CHECK (verification_source IN ('stripe_webhook', 'apple_direct', 'revenuecat', 'manual'));

-- ============================================================================
-- 3. Apple RPC — additive: +p_verification_source (default NULL, existing
--    callers unaffected), and the candidates CTE now also considers
--    Google.
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

  -- Recompute the unified entitlements row — Stripe (legacy table, read
  -- only) OR ANY provider_subscriptions row for this user, Apple AND
  -- Google both (the actual fix this migration makes to this RPC).
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
    SELECT * FROM candidates WHERE status IN ('trial', 'active', 'grace_period', 'billing_retry')
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
-- 4. Google RPC — new, structural mirror of the Apple RPC above.
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

  -- Same three-provider recompute as the Apple RPC above — kept as an
  -- identical, independent copy (not a shared helper function) so each
  -- RPC's own transaction is self-contained; see this migration's own
  -- header for why a shared PL/pgSQL helper was not introduced instead.
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
    SELECT * FROM candidates WHERE status IN ('trial', 'active', 'grace_period', 'billing_retry')
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

COMMIT;
