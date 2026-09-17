-- Apple Server Verification task, Phase 4 — the one atomic, service-role-
-- only write path for verified Apple subscription state.
--
-- APPLIED. Applied to the linked DEV project (kvdxuhyndevrfvsalgnx) and
-- live-verified on 2026-09-16 — see commit 8f64a56 ("docs: record
-- applied and verified Apple verified-state RPC migration") and
-- `docs/apple-subscription-implementation.md` Phase G. Confirmed present
-- in the live migration ledger (`supabase migration list --linked`,
-- re-checked 2026-09-17). This comment originally read "PROPOSED — NOT
-- YET APPLIED. Not run against the live project by this task," which is
-- stale. Only this comment was corrected; no executable SQL in this file
-- was changed.
--
-- Why an RPC rather than plain upserts from the Edge Function (the
-- pattern stripe-webhook/index.ts already uses successfully): this
-- write needs THREE properties together, atomically, which two separate
-- client-side .upsert() calls cannot guarantee:
--   1. Idempotent event recording (provider_events) AND the resulting
--      provider_subscriptions/entitlements write must succeed or fail
--      together — a crash between them must never leave a recorded
--      event with no corresponding state change, or vice versa.
--   2. Ownership enforcement: an apple_original_transaction_id that
--      already belongs to a different user_id must be refused, not
--      silently reassigned. Doing this as a read-then-write from the
--      Edge Function has a TOCTOU race; doing it as a single statement
--      inside one server-side transaction does not.
--   3. Newer-wins ordering: an out-of-order/delayed notification must
--      never overwrite a state the app already recorded from a more
--      recent one. Same race-safety argument as above.
-- A single SECURITY DEFINER function's body runs inside one Postgres
-- transaction, giving all three for free.
--
-- Security properties:
--   - SECURITY DEFINER with a fixed, empty search_path (`SET search_path
--     = ''`, every reference fully qualified as `public.`/`auth.`) —
--     exactly this project's own already-established hardening pattern
--     for definer functions (see 20260808120000_sprint2_stage2_admin_foundation.sql).
--   - EXECUTE is revoked from PUBLIC, anon, AND authenticated — granted
--     ONLY to service_role. This is deliberately different from this
--     project's existing admin_* RPCs (which ARE callable by an
--     authenticated admin user, gated by is_admin() inside the
--     function body): this function takes a raw user_id parameter with
--     no in-body ownership check of "does the caller own this account,"
--     so it must never be reachable by any client-authenticated role at
--     all — only the trusted server-side Edge Functions that have
--     already independently verified the Apple data (via
--     appleJwsVerification.ts / the App Store Server API call) may call
--     it, using the service-role client exactly like every other
--     Apple/Stripe write path in this project.
--   - No SQL string concatenation with any untrusted value anywhere in
--     this function — every value arrives as a typed, bound function
--     parameter (PL/pgSQL parameters are never interpolated as raw SQL
--     text), the same protection every other function in this project
--     already has by construction.
--   - Ownership conflict raises an exception (visible to the caller as
--     an error the Edge Function must handle and surface as "already
--     linked to a different account," per
--     docs/apple-subscription-architecture.md §9) rather than silently
--     reassigning or silently no-op'ing.
--   - Does not touch `subscriptions`, its RLS, or any Stripe write path
--     — only READS `subscriptions` (to fold the existing Stripe
--     entitlement into the unified `entitlements` recompute), never
--     writes it.
--
-- Reversible: see the paired rollback file.

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

  -- 1. Idempotent event recording. A duplicate provider_event_id is a
  -- safe, silent no-op — Apple redelivering the same notification must
  -- never be treated as new information.
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

  -- 2. Ownership enforcement. Lock the candidate row (if any) for this
  -- transaction to close the same TOCTOU window a client-side
  -- read-then-write would leave open.
  SELECT user_id, last_verified_at
    INTO v_existing_owner, v_existing_verified_at
    FROM public.provider_subscriptions
   WHERE provider = 'apple' AND apple_original_transaction_id = p_apple_original_transaction_id
   FOR UPDATE;

  IF v_existing_owner IS NOT NULL AND v_existing_owner <> p_user_id THEN
    RAISE EXCEPTION 'apple_original_transaction_id % is already linked to a different WakeWise account', p_apple_original_transaction_id
      USING ERRCODE = 'unique_violation';
  END IF;

  -- 3. Newer-wins ordering guard. An out-of-order/delayed notification
  -- must never overwrite state already recorded from a more recent one.
  -- The event was still recorded above (for idempotency/audit), but the
  -- subscription/entitlement state itself is left untouched.
  IF v_existing_verified_at IS NOT NULL AND p_last_verified_at IS NOT NULL
     AND v_existing_verified_at >= p_last_verified_at THEN
    RETURN QUERY SELECT false, 'stale_event'::text;
    RETURN;
  END IF;

  -- 4. Upsert the verified state.
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
    -- A NULL p_cancel_at_period_end means "the caller has no renewal-
    -- preference evidence for this call" (e.g. verify-apple-transaction
    -- verifying a bare transaction with no accompanying renewal info) —
    -- preserve whatever this row already recorded rather than silently
    -- resetting a real cancellation back to false. Only a caller that
    -- actually has fresh renewal-info evidence (the notification
    -- handler, or a reconciliation pass that also fetched renewal info)
    -- should ever pass a non-null value here.
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, public.provider_subscriptions.cancel_at_period_end),
    environment = excluded.environment,
    last_verified_at = excluded.last_verified_at,
    raw_last_event = excluded.raw_last_event,
    updated_at = now();

  -- 5. Recompute the unified entitlements row for this user — the same
  -- "pure OR across providers, most-recently-verified wins among
  -- access-granting records" rule implemented and tested in
  -- src/lib/entitlementResolution.js / supabase/functions/_shared/entitlementResolution.ts.
  -- Reads (never writes) the legacy `subscriptions` table to fold in
  -- any existing Stripe entitlement.
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
