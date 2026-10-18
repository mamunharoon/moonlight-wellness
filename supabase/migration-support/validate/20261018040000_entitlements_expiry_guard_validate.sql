-- Validation queries for 20261018040000_entitlements_expiry_guard.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. Both RPCs still exist, SECURITY DEFINER, same arg counts as before
--    (signature unchanged — this migration only replaces function
--    bodies; see the migration's own "SIGNATURE WARNING" for why these
--    exact counts were re-verified, not assumed, this round).
-- Expected: 2 rows (apply_verified_apple_subscription_event with 13 args,
-- apply_verified_google_subscription_event with 12 args), prosecdef = true.
SELECT proname, pronargs, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('apply_verified_apple_subscription_event', 'apply_verified_google_subscription_event')
ORDER BY proname;

-- 1a. No overload was accidentally created (the exact failure mode
--    20260930070000 had to clean up once already — see that migration's
--    own header). Expected: 1 row each (not 2) — confirms CREATE OR
--    REPLACE actually replaced the live function rather than shadowing
--    it with a new signature.
SELECT proname, count(*) AS overload_count
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('apply_verified_apple_subscription_event', 'apply_verified_google_subscription_event')
GROUP BY proname;

-- 2. Only service_role may execute either RPC (unchanged by this migration).
-- Expected: 0 rows.
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('apply_verified_apple_subscription_event', 'apply_verified_google_subscription_event')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');

-- 3. The actual behavioural fix — re-run the exact repro that surfaced
--    this bug: a user with a stale 'active'-but-past-expiry Google row
--    and a genuinely-still-valid Apple row must now resolve to Apple,
--    not Google. Replace :target_user with the real UUID under
--    investigation.
-- Expected (post-migration, as of this check — recompute after the
-- projection refresh runs, e.g. by re-calling either RPC once, or after
-- the migration's own step 3 has executed):
--   active_provider = 'apple', expires_at = the Apple row's own
--   current_period_expires_at (NOT the Google row's already-past one).
-- plan stays 'plus' throughout this specific case — the fix here is a
-- re-attribution (which provider/date), not a downgrade.
SELECT user_id, plan, status, active_provider, expires_at, cancel_at_period_end, updated_at
FROM public.entitlements
WHERE user_id = :target_user;

-- 4. No entitlements row anywhere currently claims plan='plus' on the
--    strength of a recurring-provider (stripe/apple/google) record whose
--    own expires_at has already passed, or is null.
-- Expected: 0 rows.
SELECT e.user_id, e.active_provider, e.expires_at, ps.current_period_expires_at, ps.status
FROM public.entitlements e
JOIN public.provider_subscriptions ps
  ON ps.user_id = e.user_id AND ps.provider = e.active_provider
WHERE e.plan = 'plus'
  AND e.active_provider IN ('stripe', 'apple', 'google')
  AND (ps.current_period_expires_at IS NULL OR ps.current_period_expires_at <= now());

-- 5. A manual grant with a null expires_at still authorizes (the one
--    documented exception is preserved — not accidentally tightened away).
-- Manual smoke test (run only in a disposable/test project):
--   a. Ensure a provider_subscriptions row exists with
--      provider='manual', status='active', current_period_expires_at=NULL
--      for a throwaway test user.
--   b. Re-run either RPC (or the migration's own step 3) for that user.
--   c. Confirm public.entitlements.plan = 'plus' for that user afterward.

-- 6. No row transitioned 'free' -> 'plus' as a result of this migration
--    (the new rule is strictly stricter; that direction should be
--    structurally impossible — see the migration's own step 3 note).
--    Compare a pre-migration snapshot of entitlements (plan, user_id) —
--    taken BEFORE applying this migration — against the post-migration
--    table; every user_id that was 'free' before must still be 'free'
--    after. No single query substitutes for having taken that snapshot;
--    recorded here as a required manual step, not an automatable check.

-- 7. Sanity: this migration touched no RLS policy, grant, or column on
--    subscriptions/provider_subscriptions/entitlements/provider_events
--    beyond the two function bodies and the one-time entitlements
--    backfill — same set 20260929120000's own validate file already
--    checks for its own scope.
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.provider_subscriptions'::regclass AND contype = 'u'
ORDER BY conname;
-- Expected: unchanged from before this migration (3 rows: stripe_sub_unique,
-- apple_txn_unique, google_token_unique).
