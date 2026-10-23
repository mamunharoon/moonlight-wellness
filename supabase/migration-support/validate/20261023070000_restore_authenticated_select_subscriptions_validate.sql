-- Validation queries for
-- 20261023070000_restore_authenticated_select_subscriptions.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. authenticated now has SELECT, plus the pre-existing inert
-- privileges - nothing else.
-- Expected: 4 privilege_types - REFERENCES, SELECT, TRIGGER, TRUNCATE.
SELECT jsonb_agg(privilege_type ORDER BY privilege_type) AS privilege_types
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'subscriptions' AND grantee = 'authenticated';

-- 2. No INSERT/UPDATE/DELETE was added for authenticated - SELECT only.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'subscriptions'
  AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 3. anon/PUBLIC gained nothing.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'subscriptions'
  AND grantee IN ('anon', 'PUBLIC') AND privilege_type = 'SELECT';

-- 4. RLS unchanged, and the exact same single owner-only SELECT policy
-- still exists with the same qual - this migration adds no policy.
-- Expected: relrowsecurity = true.
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.subscriptions'::regclass;

-- Expected: 1 row - subscriptions_select_own, qual auth.uid() = user_id,
-- roles = {authenticated}. Still the ONLY policy on this table (no
-- INSERT/UPDATE/DELETE policy exists or was added).
SELECT policyname, cmd, roles, qual
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions';
