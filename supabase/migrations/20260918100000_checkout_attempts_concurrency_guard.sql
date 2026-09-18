-- Duplicate-Subscription Remediation, Phase 1 — checkout_attempts.
--
-- Root cause being fixed: create-checkout-session had no protection
-- against (a) a user starting a second Stripe Checkout while a
-- non-terminal subscription/attempt already exists, and (b) two
-- concurrent requests (double-click, two tabs, two devices) both passing
-- a check-then-act race and each creating their own Checkout Session.
-- This table + RPC together make "at most one live checkout attempt per
-- user" a fact enforced by Postgres itself, not just application logic.
--
-- State machine (see create-checkout-session/index.ts and
-- stripe-webhook/index.ts for the transitions):
--   pending  -> server is checking eligibility / about to call Stripe.
--               Blocked only by its own short lease_expires_at (a few
--               minutes) — recovers on its own if the Edge Function
--               crashes mid-request, never blocks a user permanently.
--   open     -> a real Stripe Checkout Session exists and is still
--               usable. Blocked until Stripe's OWN recorded session
--               expiry (stripe_expires_at) or a checkout.session.expired
--               webhook — deliberately NOT the short pending lease, since
--               a real, still-open Checkout page must never be reclaimed
--               out from under the customer.
--   consumed -> checkout.session.completed was received for this
--               attempt. Terminal, success.
--   failed   -> the eligibility check blocked it, Stripe returned an
--               error, or its pending lease expired unclaimed. Terminal.
--   expired  -> the Stripe Checkout Session's own expiry passed without
--               completion. Terminal.
-- Only 'pending' and 'open' are "live" — enforced by the partial unique
-- index below, which is the actual correctness guarantee (the RPC's
-- application logic is a convenience layer on top, not the source of
-- truth for atomicity).
--
-- This table intentionally stores no payment details, no card data, no
-- JWT, and no more personal data than a user_id foreign key and an
-- opaque, client-generated attempt id. failure_code/failure_message hold
-- only a short Stripe error code/type, never a raw error object.
--
-- Deliberately NOT applied to the Stripe/provider ledger
-- (provider_subscriptions): that table must remain free to record two
-- genuinely conflicting real Stripe subscriptions when they exist (see
-- the DEV reconciliation task this migration is part of) — this table
-- solves a completely different problem (our own request concurrency),
-- so it gets its own, unrelated uniqueness rule.

BEGIN;

CREATE TABLE public.checkout_attempts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_attempt_id           uuid NOT NULL,
  billing_interval            text NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  status                      text NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'open', 'consumed', 'failed', 'expired')),
  stripe_checkout_session_id  text,
  checkout_url                text,
  -- Short server-processing lease for the 'pending' state only — recovers
  -- an attempt abandoned because the Edge Function crashed before ever
  -- reaching Stripe. Deliberately separate from stripe_expires_at: a
  -- 'pending' row has no Stripe session yet, so there is nothing to wait
  -- on except our own processing; an 'open' row has a real Checkout page
  -- a customer may still be looking at, which must never be reclaimed on
  -- this short a timer.
  lease_expires_at            timestamptz,
  -- Stripe's own recorded Checkout Session expiry (session.expires_at,
  -- set explicitly and deliberately short at creation time — see
  -- create-checkout-session/index.ts). Only relevant once status='open'.
  stripe_expires_at           timestamptz,
  consumed_at                 timestamptz,
  failure_code                text,
  failure_message             text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Finds "is this the exact same logical request retrying" in O(1).
CREATE UNIQUE INDEX checkout_attempts_user_client_attempt_key
  ON public.checkout_attempts (user_id, client_attempt_id);

-- The actual correctness guarantee: Postgres itself refuses a second
-- 'pending'/'open' row for the same user, regardless of how many
-- concurrent requests race to insert one.
CREATE UNIQUE INDEX checkout_attempts_one_live_per_user
  ON public.checkout_attempts (user_id)
  WHERE status IN ('pending', 'open');

CREATE UNIQUE INDEX checkout_attempts_stripe_session_id_key
  ON public.checkout_attempts (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- RLS enabled, zero policies for anon/authenticated — the same
-- default-deny pattern this project already uses for provider_events
-- (see 20260916100000_apple_subscription_entitlements_foundation.sql).
-- Only service_role (which bypasses RLS by default, exactly like every
-- other Stripe/Apple write path in this project) may read or write this
-- table, via the Edge Functions' createSupabaseAdminClient().
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

-- claim_checkout_attempt — the one atomic entry point for starting or
-- resuming a checkout attempt.
--
-- Concurrency design: rather than an advisory lock spanning the
-- subsequent Stripe API call (unreliable here — Supabase Edge Functions
-- reach Postgres through PostgREST's pooled connections with no session
-- affinity across separate calls, and holding a DB lock open across a
-- slow external HTTP call is bad practice regardless), this function
-- optimistically INSERTs and catches unique_violation. The actual
-- arbiter of "only one live attempt per user" is the partial unique
-- index above, enforced by Postgres at the storage layer — correct under
-- any number of truly concurrent callers, no lock primitive needed.
--
-- On unique_violation, the same (user_id, client_attempt_id) pair is
-- re-checked FIRST: a concurrent caller retrying the identical attempt
-- may have just won the race, in which case this call must report
-- retry_same_attempt for ITS OWN row, not someone else's. Only when that
-- exact pair still doesn't exist does this treat the conflict as "a
-- different attempt is already live" and look up that other row.
--
-- Returns exactly one of four outcomes:
--   claimed_new             - a brand new 'pending' row was created.
--   retry_same_attempt      - (user_id, client_attempt_id) already has a
--                              row, in any status; caller decides what to
--                              do with it (see create-checkout-session).
--   stale_or_expired_reclaimed - a different attempt was pending past its
--                              lease, or open past its Stripe expiry;
--                              that row was closed out (failed/expired)
--                              and a brand new 'pending' row was created
--                              for THIS caller in the same transaction.
--   existing_open_attempt   - a different attempt is genuinely still
--                              live; nothing was created.
--
-- Security: SECURITY DEFINER with a fixed empty search_path (this
-- project's established hardening pattern — see
-- 20260916120000_apple_verified_state_rpc.sql), every reference fully
-- qualified. Deliberately callable ONLY by service_role (revoked from
-- PUBLIC/anon/authenticated below) — this function takes a raw p_user_id
-- parameter with no in-body ownership check of "does the caller own this
-- account," exactly like apply_verified_apple_subscription_event's own
-- documented reasoning. The trust boundary is therefore entirely at the
-- Edge Function layer: create-checkout-session must derive p_user_id
-- exclusively from a server-verified JWT (auth.getUser(jwt)), never from
-- a client-supplied request field, before calling this RPC with the
-- service-role client. RLS alone is not relied on for this protection —
-- REVOKE/GRANT on the function itself is the actual boundary, since a
-- SECURITY DEFINER function's own privileges are not constrained by RLS
-- on the tables it touches.
CREATE OR REPLACE FUNCTION public.claim_checkout_attempt(
  p_user_id uuid,
  p_client_attempt_id uuid,
  p_billing_interval text
)
-- attempt_status/attempt_checkout_url are deliberately NOT named
-- status/checkout_url: those are real column names on checkout_attempts,
-- and PL/pgSQL treats a RETURNS TABLE column exactly like a declared
-- variable in scope for the whole function body — reusing a column name
-- there makes every bare `status`/`checkout_url` reference inside the
-- function ambiguous between the OUT parameter and the table column
-- (caught by live-testing this function against DEV before relying on
-- it — see the DEV verification log this task recorded).
RETURNS TABLE (outcome text, attempt_id uuid, attempt_checkout_url text, attempt_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.checkout_attempts%ROWTYPE;
  v_lease_minutes CONSTANT integer := 2;
BEGIN
  IF p_user_id IS NULL OR p_client_attempt_id IS NULL OR p_billing_interval IS NULL THEN
    RAISE EXCEPTION 'claim_checkout_attempt: user_id, client_attempt_id and billing_interval are required';
  END IF;

  -- Same logical request retrying (any status) — always checked first,
  -- and always safe to report as-is regardless of what it currently is.
  SELECT * INTO v_row FROM public.checkout_attempts
   WHERE user_id = p_user_id AND client_attempt_id = p_client_attempt_id;
  IF FOUND THEN
    RETURN QUERY SELECT 'retry_same_attempt'::text, v_row.id, v_row.checkout_url, v_row.status;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.checkout_attempts (user_id, client_attempt_id, billing_interval, status, lease_expires_at)
    VALUES (p_user_id, p_client_attempt_id, p_billing_interval, 'pending', now() + make_interval(mins => v_lease_minutes))
    RETURNING * INTO v_row;

    RETURN QUERY SELECT 'claimed_new'::text, v_row.id, v_row.checkout_url, v_row.status;
    RETURN;
  EXCEPTION WHEN unique_violation THEN
    -- Re-check the EXACT same pair first (see header comment) — a
    -- concurrent identical retry may have already won.
    SELECT * INTO v_row FROM public.checkout_attempts
     WHERE user_id = p_user_id AND client_attempt_id = p_client_attempt_id;
    IF FOUND THEN
      RETURN QUERY SELECT 'retry_same_attempt'::text, v_row.id, v_row.checkout_url, v_row.status;
      RETURN;
    END IF;

    -- Otherwise the conflict is the one-live-attempt-per-user index — a
    -- different attempt already exists for this user.
    SELECT * INTO v_row FROM public.checkout_attempts
     WHERE user_id = p_user_id AND status IN ('pending', 'open')
     ORDER BY created_at DESC
     LIMIT 1;

    IF NOT FOUND THEN
      -- Should be unreachable: a unique_violation guarantees a
      -- conflicting row existed at INSERT time, and nothing in this
      -- design ever deletes a row. Fail loudly rather than guess.
      RAISE EXCEPTION 'claim_checkout_attempt: unique_violation with no discoverable conflicting row for user %', p_user_id;
    END IF;

    -- Reclaim an abandoned PENDING lease — the server crashed or timed
    -- out before ever reaching Stripe for that attempt.
    IF v_row.status = 'pending' AND v_row.lease_expires_at < now() THEN
      UPDATE public.checkout_attempts
         SET status = 'failed', failure_code = 'LEASE_EXPIRED', updated_at = now()
       WHERE id = v_row.id AND status = 'pending';

      INSERT INTO public.checkout_attempts (user_id, client_attempt_id, billing_interval, status, lease_expires_at)
      VALUES (p_user_id, p_client_attempt_id, p_billing_interval, 'pending', now() + make_interval(mins => v_lease_minutes))
      RETURNING * INTO v_row;

      RETURN QUERY SELECT 'stale_or_expired_reclaimed'::text, v_row.id, v_row.checkout_url, v_row.status;
      RETURN;
    END IF;

    -- Reclaim an OPEN session only once Stripe's OWN recorded expiry has
    -- passed — never on the short pending lease, and never merely
    -- because time has passed on our side.
    IF v_row.status = 'open' AND v_row.stripe_expires_at IS NOT NULL AND v_row.stripe_expires_at < now() THEN
      UPDATE public.checkout_attempts
         SET status = 'expired', updated_at = now()
       WHERE id = v_row.id AND status = 'open';

      INSERT INTO public.checkout_attempts (user_id, client_attempt_id, billing_interval, status, lease_expires_at)
      VALUES (p_user_id, p_client_attempt_id, p_billing_interval, 'pending', now() + make_interval(mins => v_lease_minutes))
      RETURNING * INTO v_row;

      RETURN QUERY SELECT 'stale_or_expired_reclaimed'::text, v_row.id, v_row.checkout_url, v_row.status;
      RETURN;
    END IF;

    -- Genuinely still live — nothing created.
    RETURN QUERY SELECT 'existing_open_attempt'::text, v_row.id, v_row.checkout_url, v_row.status;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_checkout_attempt(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_checkout_attempt(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_checkout_attempt(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_checkout_attempt(uuid, uuid, text) TO service_role;

COMMIT;
