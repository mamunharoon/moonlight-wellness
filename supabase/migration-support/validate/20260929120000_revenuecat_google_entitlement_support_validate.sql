-- Validation queries for 20260929120000_revenuecat_google_entitlement_support.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. The Google uniqueness backstop exists.
-- Expected: 1 row (provider_subscriptions_google_token_unique).
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.provider_subscriptions'::regclass
  AND conname = 'provider_subscriptions_google_token_unique';

-- 2. verification_source column exists with the expected CHECK values.
-- Expected: 1 row, column_name = 'verification_source', data_type = 'text'.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'provider_subscriptions' AND column_name = 'verification_source';

-- Expected: 1 row, definition mentions all four allowed values.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.provider_subscriptions'::regclass
  AND conname LIKE '%verification_source%';

-- 3. Both RPCs exist, SECURITY DEFINER, with the expected extra parameter.
-- Expected: 2 rows (apply_verified_apple_subscription_event with 13 args,
-- apply_verified_google_subscription_event with 12 args).
SELECT proname, pronargs, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('apply_verified_apple_subscription_event', 'apply_verified_google_subscription_event')
ORDER BY proname;

-- 4. Only service_role may execute either RPC.
-- Expected: 0 rows (no PUBLIC/anon/authenticated EXECUTE grant survives).
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('apply_verified_apple_subscription_event', 'apply_verified_google_subscription_event')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');

-- 5. Existing Apple rows (if any) and their unique/RLS/grant state on
--    provider_subscriptions/entitlements/provider_events are untouched by
--    this migration (sanity check, not a new assertion) — same set the
--    original 20260916100000 migration's own validate file already
--    checks.
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.provider_subscriptions'::regclass AND contype = 'u'
ORDER BY conname;
-- Expected: 3 rows now (stripe_sub_unique, apple_txn_unique, google_token_unique).

-- 6. Ownership-conflict behaviour for the new Google RPC (manual smoke
--    test, run only in a disposable/test project — inserts real rows):
--    a. Call apply_verified_google_subscription_event with a fresh
--       p_google_purchase_token for user A → expect (true, 'applied').
--    b. Call it again with the SAME p_google_purchase_token for user B →
--       expect an exception ("already linked to a different WakeWise
--       account"), never a silent reassignment.
