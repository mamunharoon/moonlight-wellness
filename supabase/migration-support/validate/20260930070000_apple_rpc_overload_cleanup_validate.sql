-- Validation queries for 20260930070000_apple_rpc_overload_cleanup.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. Exactly ONE overload of apply_verified_apple_subscription_event
--    remains, and it is the 13-argument (fixed) version.
-- Expected: 1 row, pronargs = 13, prosecdef = true.
SELECT proname, pronargs, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'apply_verified_apple_subscription_event';

-- 2. That remaining function still has p_verification_source with a
--    DEFAULT — required for the existing, unmodified Apple Edge Functions
--    (which never pass this parameter) to keep resolving and working.
-- Expected: 1 row; args_with_defaults ends with
-- "p_verification_source text DEFAULT NULL::text".
SELECT pg_get_function_identity_arguments(oid) AS args,
       pg_get_function_arguments(oid) AS args_with_defaults
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'apply_verified_apple_subscription_event';

-- 3. Grants on the remaining function are unchanged from
--    20260929120000's own grants (service_role only).
-- Expected: 0 rows (no PUBLIC/anon/authenticated EXECUTE grant survives).
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'apply_verified_apple_subscription_event'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');

-- Expected: 1 row, grantee = service_role.
SELECT routine_name, grantee
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'apply_verified_apple_subscription_event'
  AND grantee = 'service_role';

-- 4. apply_verified_google_subscription_event is untouched by this
--    migration (sanity check, not a new assertion).
-- Expected: 1 row, pronargs = 12.
SELECT proname, pronargs, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'apply_verified_google_subscription_event';

-- 5. Live resolution proof (manual smoke test, run only with a disposable
--    synthetic test account — inserts and then fully deletes real rows,
--    never a real subscriber):
--    a. INSERT a throwaway row into auth.users (id only).
--    b. SELECT * FROM apply_verified_apple_subscription_event(...) using
--       the EXACT 12 named parameters
--       supabase/functions/apple-server-notifications/index.ts sends
--       (p_user_id, p_apple_original_transaction_id, p_product_id,
--       p_status, p_current_period_expires_at, p_cancel_at_period_end,
--       p_environment, p_apple_app_account_token, p_last_verified_at,
--       p_raw_event_summary, p_provider_event_id, p_event_type — no
--       p_verification_source) → expect (true, 'applied').
--    c. Confirm the resulting public.entitlements row for that test user
--       shows plan='plus'.
--    d. DELETE FROM public.provider_events WHERE provider_event_id =
--       <the test event id> (not cascaded by the user delete below).
--    e. DELETE FROM auth.users WHERE id = <the test id> (cascades
--       provider_subscriptions + entitlements).
--    f. Re-count all four tables for the test id/event id — expect 0
--       everywhere.
