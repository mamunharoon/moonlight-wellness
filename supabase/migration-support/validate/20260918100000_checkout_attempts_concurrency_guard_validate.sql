-- Validation queries for 20260918100000_checkout_attempts_concurrency_guard.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. The table exists with the expected columns.
-- Expected: 14 rows (id, user_id, client_attempt_id, billing_interval,
-- status, stripe_checkout_session_id, checkout_url, lease_expires_at,
-- stripe_expires_at, consumed_at, failure_code, failure_message,
-- created_at, updated_at).
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'checkout_attempts'
ORDER BY ordinal_position;

-- 2. The three unique indexes exist.
-- Expected: 3 rows — checkout_attempts_user_client_attempt_key,
-- checkout_attempts_one_live_per_user, checkout_attempts_stripe_session_id_key.
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'checkout_attempts' AND indexname LIKE 'checkout_attempts_%';

-- 3. RLS is enabled with zero policies (default-deny for anon/authenticated).
-- Expected: relrowsecurity = true.
SELECT relrowsecurity FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relname = 'checkout_attempts';

-- Expected: 0 rows.
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'checkout_attempts';

-- 4. claim_checkout_attempt exists with the expected signature.
-- Expected: 1 row.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'claim_checkout_attempt';

-- 5. SECURITY DEFINER with a fixed, empty search_path.
-- Expected: prosecdef = true; proconfig contains 'search_path='.
SELECT p.prosecdef, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'claim_checkout_attempt';

-- 6. Only service_role can execute it — anon/authenticated/PUBLIC have no privilege.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'claim_checkout_attempt'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC');

-- 7. service_role does have EXECUTE.
-- Expected: 1 row.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'claim_checkout_attempt'
  AND grantee = 'service_role';

-- 8. provider_subscriptions, subscriptions and their existing
--    policies/grants are completely untouched by this migration.
-- Expected: same policy sets this project already had.
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('subscriptions', 'provider_subscriptions')
ORDER BY tablename, policyname;
