-- Validation queries for 20260916120000_apple_verified_state_rpc.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. The function exists with the expected signature.
-- Expected: 1 row.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'apply_verified_apple_subscription_event';

-- 2. SECURITY DEFINER with a fixed, empty search_path.
-- Expected: prosecdef = true; proconfig contains 'search_path=' with an
-- empty value.
SELECT p.prosecdef, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'apply_verified_apple_subscription_event';

-- 3. Only service_role can execute it — anon/authenticated/PUBLIC have
-- no privilege at all.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'apply_verified_apple_subscription_event'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC');

-- 4. service_role does have EXECUTE.
-- Expected: 1 row.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'apply_verified_apple_subscription_event'
  AND grantee = 'service_role';

-- 5. Existing subscriptions table and its policies/grants are completely
--    untouched by this migration (sanity check, not a new assertion).
-- Expected: same policy set this project already had —
-- subscriptions_select_own only.
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subscriptions';
