-- Validation queries for 20261025020000_grant_deletion_flow_minimal_privileges.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. account_deletion_requests: service_role now has exactly SELECT,
--    INSERT, UPDATE plus the pre-existing inert privileges - DELETE
--    deliberately withheld (never called by delete-account/index.ts).
-- Expected: 6 rows - INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'account_deletion_requests' AND grantee = 'service_role'
ORDER BY privilege_type;

-- 2. Specifically confirm DELETE was NOT added for service_role on
--    account_deletion_requests.
-- Expected: 0 rows.
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'account_deletion_requests'
  AND grantee = 'service_role' AND privilege_type = 'DELETE';

-- 3. account_deletion_requests: authenticated now has exactly SELECT
--    plus the pre-existing inert privileges - no INSERT/UPDATE/DELETE
--    (getMyDeletionRequest only ever reads).
-- Expected: 4 rows - REFERENCES, SELECT, TRIGGER, TRUNCATE.
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'account_deletion_requests' AND grantee = 'authenticated'
ORDER BY privilege_type;

-- 4. The 9 user-owned/profile tables this migration covers: service_role
--    now has exactly DELETE plus pre-existing inert privileges - no
--    SELECT/INSERT/UPDATE added (deleteUserOwnedRowsInOrder only ever
--    deletes, no .select() chained). checkout_attempts is DELIBERATELY
--    excluded - see the migration's own header: it does not exist on
--    production at all (a separate, unresolved blocker).
-- Expected: 9 rows, each 'DELETE' = true and
--  'select_insert_update_count' = 0.
SELECT
  t.table_name,
  EXISTS(
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema='public' AND g.table_name=t.table_name
      AND g.grantee='service_role' AND g.privilege_type='DELETE'
  ) AS has_delete,
  (
    SELECT count(*) FROM information_schema.role_table_grants g
    WHERE g.table_schema='public' AND g.table_name=t.table_name
      AND g.grantee='service_role' AND g.privilege_type IN ('SELECT','INSERT','UPDATE')
  ) AS select_insert_update_count
FROM (VALUES
  ('journal_entries'),('user_intentions'),('rhythms'),('routine_responses'),
  ('practice_completion_events'),('provider_subscriptions'),
  ('entitlements'),('subscriptions'),('profiles')
) AS t(table_name)
ORDER BY t.table_name;

-- 4b. Confirm checkout_attempts genuinely still does not exist on
--     production - this migration does not and should not reference it.
-- Expected: 0 rows.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'checkout_attempts';

-- 5. PUBLIC/anon gained nothing on any of the 10 tables this migration
--    touches.
-- Expected: 0 rows.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('account_deletion_requests','journal_entries','user_intentions','rhythms',
                      'routine_responses','practice_completion_events',
                      'provider_subscriptions','entitlements','subscriptions','profiles')
  AND grantee IN ('PUBLIC', 'anon');

-- 6. RLS is unchanged on all 10 tables - still enabled, no policy
--    created/altered/dropped by this migration.
-- Expected: relrowsecurity = true for all 10.
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('account_deletion_requests','journal_entries','user_intentions','rhythms',
                   'routine_responses','practice_completion_events',
                   'provider_subscriptions','entitlements','subscriptions','profiles')
ORDER BY relname;

-- 7. Cross-user isolation re-confirmed post-grant, exactly as tested
--    pre-grant (rolled back then; now the real grant is live, so this
--    read is genuinely scoped by the grant, not just the policy in
--    isolation) - run only if a real request row exists for the test
--    account; otherwise this returns 0 rows and proves nothing either
--    way (not a failure).
-- Expected (once a real row exists): a signed-in user can read their own
-- account_deletion_requests row and no one else's, via the app itself.

-- 8. Live behavioural proof (the actual incident, now fixed) - not a SQL
--    query, listed for completeness: the disposable PROD account
--    (mamunharoon@yahoo.com.au) reaches Final Confirmation and submits
--    DELETE MY ACCOUNT again; expect a 200/'deleted' response and the
--    account to be genuinely gone (auth.users, all 10 owned tables,
--    retained account_deletion_requests row) - same verification this
--    tracker already performs after every DEV success.
