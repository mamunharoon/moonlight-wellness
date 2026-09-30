-- Rollback for 20260930070000_apple_rpc_overload_cleanup.sql
--
-- Re-creates the original 12-argument public.apply_verified_apple_subscription_event
-- verbatim from 20260916120000_apple_verified_state_rpc.sql.
--
-- WARNING — this deliberately REINTRODUCES the overload-shadowing bug
-- 20260930070000 exists to fix: once both the 12-argument (this file) and
-- 13-argument (from 20260929120000, untouched by this rollback) functions
-- exist together again, apple-server-notifications' exact 12-named-argument
-- call will once again resolve to this old function, silently losing the
-- Google-row-aware entitlements recompute. This file exists for
-- migration-history symmetry (every migration in this repo has a paired
-- rollback) — running it is not expected to ever be the right operational
-- choice; dropping the 13-argument function's own p_verification_source
-- parameter default (not provided here) would be a more correct "undo the
-- extra parameter" rollback, but that was never this migration's job —
-- 20260930070000 only ever removed the stale overload, so this file only
-- ever restores it.

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
  p_event_type text
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
    environment, last_verified_at, raw_last_event, updated_at
  ) VALUES (
    p_user_id, 'apple', p_apple_original_transaction_id, p_apple_app_account_token,
    p_product_id, p_status, p_current_period_expires_at, COALESCE(p_cancel_at_period_end, false),
    p_environment, COALESCE(p_last_verified_at, now()), p_raw_event_summary, now()
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
    updated_at = now();

  WITH candidates AS (
    SELECT 'apple'::text AS provider, status, current_period_expires_at AS expires_at,
           cancel_at_period_end, last_verified_at AS verified_at
      FROM public.provider_subscriptions
     WHERE user_id = p_user_id AND provider = 'apple'
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
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text
) FROM anon;
REVOKE ALL ON FUNCTION public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text
) TO service_role;

COMMIT;
