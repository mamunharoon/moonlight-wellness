-- Read-only validation for 20261019160000_admin_list_subscriptions_multi_provider.sql.
-- Safe to run any time, against any environment. Must be run as (or via
-- `supabase db query --linked`, which connects as) a role that can see
-- pg_proc — the function's own `WHERE public.is_admin()` gate only
-- applies to actually CALLING it as a real authenticated session, not to
-- these introspection queries.

-- 1. Confirm the new return shape is live (9 columns, not the old 6).
SELECT p.proname, p.pronargs,
       pg_get_function_result(p.oid) AS return_shape
FROM pg_proc p
WHERE p.proname = 'admin_list_subscriptions' AND p.pronamespace = 'public'::regnamespace;
-- Expect return_shape to mention environment, cancel_at_period_end,
-- provider_record_count alongside the original 6 columns.

-- 2. Confirm grants: only service_role (via SECURITY DEFINER's owner) and
--    `authenticated` (EXECUTE) can call it; PUBLIC/anon cannot.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'admin_list_subscriptions' AND routine_schema = 'public';
-- Expect exactly one row: authenticated / EXECUTE.

-- 3. Confirm the function owner is postgres (SECURITY DEFINER runs with
--    the owner's privileges, not the caller's).
SELECT pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
WHERE p.proname = 'admin_list_subscriptions' AND p.pronamespace = 'public'::regnamespace;
-- Expect: postgres.

-- 4. Spot-check: for any user with at least one provider_subscriptions
--    row, confirm provider_record_count matches a direct count (read-only,
--    no RPC call — this re-derives the same candidates CTE's count by
--    hand to catch a logic error in the function body itself).
WITH direct_counts AS (
  SELECT user_id, count(*) AS c
  FROM (
    SELECT user_id FROM public.provider_subscriptions WHERE provider IN ('apple', 'google', 'manual')
    UNION ALL
    SELECT user_id FROM public.subscriptions
  ) x
  GROUP BY user_id
)
SELECT dc.user_id, dc.c AS expected_record_count
FROM direct_counts dc
ORDER BY dc.user_id
LIMIT 20;
-- Compare this against admin_list_subscriptions()'s own
-- provider_record_count for the same user_ids when called live as a real
-- admin session (not reproduced here, since that requires a real JWT).
