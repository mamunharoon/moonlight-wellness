-- Validation queries for 20260915160000_harden_profiles_and_anon_grants.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. authenticated no longer has unrestricted table-level INSERT/UPDATE
--    on profiles.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE');

-- 2. Exactly which columns authenticated can now INSERT on profiles.
-- Expected: exactly first_name, id, last_name (3 rows).
SELECT column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated' AND privilege_type = 'INSERT'
ORDER BY column_name;

-- 3. Exactly which columns authenticated can now UPDATE on profiles.
-- Expected: exactly avatar_url, first_name, last_name (3 rows).
SELECT column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
ORDER BY column_name;

-- 4. is_admin/beta_access are not writable by authenticated via any path.
-- Expected: 0 rows.
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated'
  AND column_name IN ('is_admin', 'beta_access') AND privilege_type IN ('INSERT', 'UPDATE');

-- 5. anon has no remaining privilege on the three service-role-only tables.
-- Expected: 0 rows.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
  AND table_name IN ('subscriptions', 'account_deletion_requests', 'stripe_webhook_events');

-- 6. authenticated's own access to those three tables is untouched
--    (still whatever it was before — this migration only revokes anon).
-- Expected: the same full table-level grant list as before this
-- migration (SELECT/INSERT/UPDATE/DELETE/etc.) — unchanged.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'authenticated'
  AND table_name IN ('subscriptions', 'account_deletion_requests', 'stripe_webhook_events')
ORDER BY table_name, privilege_type;

-- 7. Every existing RLS policy on all affected tables is untouched.
-- Expected: identical to the pre-migration policy list — one
-- profiles_select_own, profiles_insert_own, profiles_update_own each on
-- profiles; one select-own policy each on subscriptions and
-- account_deletion_requests; zero on stripe_webhook_events.
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'subscriptions', 'account_deletion_requests', 'stripe_webhook_events')
ORDER BY tablename, policyname;

-- 8. The SECURITY DEFINER admin functions are untouched (still exist,
--    still SECURITY DEFINER, still owned by postgres, still fixed
--    search_path) — this migration does not alter them at all, this
--    just confirms nothing else drifted.
-- Expected: 5 rows, all prosecdef = true, owner = postgres.
SELECT p.proname, r.rolname AS owner, p.prosecdef,
       (SELECT array_agg(cfg) FROM unnest(coalesce(p.proconfig, array[]::text[])) AS cfg) AS config
FROM pg_proc p
JOIN pg_roles r ON r.oid = p.proowner
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('is_admin', 'admin_list_users', 'admin_list_subscriptions', 'admin_set_beta_access', 'admin_set_subscription_status')
ORDER BY p.proname;
