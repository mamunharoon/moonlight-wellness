-- Rollback for 20261018040000_entitlements_expiry_guard.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Restores both RPCs to their exact prior (20260929120000, as left by
-- 20260930070000's own overload cleanup — see the forward migration's
-- header for why those are confirmed the correct, sole-surviving
-- signatures to target) `granting` CTE — status-only, no expiry check —
-- i.e. reintroduces the staleness bug this migration fixes. Does NOT
-- revert the projection refresh (step 3 of the forward migration): once
-- existing public.entitlements rows have been recomputed under the
-- corrected rule, there is no recorded "before" snapshot to restore them
-- to, and re-running the OLD (buggy) rule against current live data
-- would simply recompute the same kind of possibly-wrong row again on
-- the next webhook anyway — restoring the function bodies alone is
-- sufficient to fully undo this migration's behavioural change. Does
-- not touch provider_subscriptions, subscriptions, provider_events,
-- entitlements' schema, or any RLS/grant — and does not interact with,
-- reintroduce, or otherwise touch the already-resolved 12/13-argument
-- Apple overload incident (20260930070000), which stays exactly as it
-- is regardless of whether this rollback runs.

BEGIN;

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

COMMIT;
