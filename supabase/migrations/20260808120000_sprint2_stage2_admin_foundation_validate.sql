-- Sprint 2 Stage 2 validation queries for
-- 20260808120000_sprint2_stage2_admin_foundation.sql — READ-ONLY.
--
-- Run each block and compare against "Expected". None of these mutate
-- data or schema. Run as a user known NOT to be an admin for query 6/7
-- to confirm the closed-by-default behaviour; run as a known admin to
-- confirm the open behaviour.

-- 1. New profiles columns exist with the expected types/defaults.
-- Expected: 2 rows — is_admin (boolean, false), beta_access (boolean, false).
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('is_admin', 'beta_access')
ORDER BY column_name;

-- 2. Existing profiles RLS policies are untouched by this migration.
-- Expected: 3 rows — profiles_select_own, profiles_insert_own,
-- profiles_update_own (same as before this migration ran).
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 3. Existing subscriptions RLS policy is untouched by this migration.
-- Expected: 1 row — subscriptions_select_own.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subscriptions'
ORDER BY policyname;

-- 4. All five functions exist, SECURITY DEFINER, fixed empty search_path.
-- Expected: 5 rows — admin_list_users, admin_list_subscriptions,
-- admin_set_beta_access, admin_set_subscription_status, is_admin.
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'is_admin', 'admin_list_users', 'admin_list_subscriptions',
    'admin_set_beta_access', 'admin_set_subscription_status'
  )
ORDER BY proname;

-- 5. Only `authenticated` may execute the admin functions — no `anon` or
-- `public` grant leaked through.
-- Expected: every row's grantee = 'authenticated'.
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_admin', 'admin_list_users', 'admin_list_subscriptions',
    'admin_set_beta_access', 'admin_set_subscription_status'
  )
ORDER BY routine_name, grantee;

-- 6. is_admin() reflects the calling user's own row.
-- Expected: matches the is_admin value on your own profiles row.
SELECT public.is_admin();

-- 7. Closed-by-default read behaviour: called as a non-admin, both list
-- functions return zero rows even though profiles/subscriptions rows
-- exist. Called as an admin, both return one row per registered user.
-- Expected: 0 rows as non-admin; >=1 row as admin.
SELECT * FROM public.admin_list_users();
SELECT * FROM public.admin_list_subscriptions();
