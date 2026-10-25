-- Validation queries for 20261025040000_grant_select_for_deletion_where_clause.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. Column-level SELECT present on exactly each table's own filter
--    column, for service_role.
-- Expected: 8 rows - (checkout_attempts,user_id), (entitlements,user_id),
-- (journal_entries,user_id), (practice_completion_events,user_id),
-- (profiles,id), (routine_responses,user_id), (rhythms,user_id),
-- (user_intentions,user_id).
SELECT table_name, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND grantee = 'service_role' AND privilege_type = 'SELECT'
  AND table_name IN ('journal_entries','user_intentions','rhythms','routine_responses',
                      'practice_completion_events','entitlements','profiles','checkout_attempts')
ORDER BY table_name, column_name;

-- 2. No TABLE-LEVEL SELECT was granted on any of these 8 (confirms the
--    column-level choice - a table-level grant would show here as an
--    'ALL COLUMNS' style match).
-- Expected: 0 rows.
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee='service_role' AND privilege_type='SELECT'
  AND table_name IN ('journal_entries','user_intentions','rhythms','routine_responses',
                      'practice_completion_events','entitlements','profiles','checkout_attempts');

-- 3. No column-level SELECT on any OTHER column of these tables (e.g.
--    journal_entries.body, profiles.email) was granted - confirms the
--    grant is scoped to exactly the one filter column per table, not
--    every column individually.
-- Expected: 0 rows.
SELECT table_name, column_name FROM information_schema.column_privileges
WHERE table_schema='public' AND grantee='service_role' AND privilege_type='SELECT'
  AND table_name IN ('journal_entries','user_intentions','rhythms','routine_responses',
                      'practice_completion_events','entitlements','profiles','checkout_attempts')
  AND NOT ( (table_name <> 'profiles' AND column_name = 'user_id') OR (table_name = 'profiles' AND column_name = 'id') );

-- 4. No INSERT/UPDATE/DELETE column or table grant was added alongside
--    this (DELETE itself is unchanged from 20261025020000 - not touched
--    by this migration).
-- Expected: 0 rows.
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee='service_role' AND privilege_type IN ('INSERT','UPDATE')
  AND table_name IN ('journal_entries','user_intentions','rhythms','routine_responses',
                      'practice_completion_events','entitlements','profiles','checkout_attempts');

-- 5. PUBLIC/anon/authenticated gained nothing from this migration
--    specifically (pre-existing baseline grants on these roles,
--    documented in E-169/E-171, are untouched either way - this checks
--    only for anything NEW).
-- Expected: 0 rows.
SELECT grantee, table_name, column_name FROM information_schema.column_privileges
WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated') AND privilege_type='SELECT'
  AND table_name IN ('journal_entries','user_intentions','rhythms','routine_responses',
                      'practice_completion_events','entitlements','profiles','checkout_attempts')
  AND ( (table_name <> 'profiles' AND column_name = 'user_id') OR (table_name = 'profiles' AND column_name = 'id') );

-- 6. RLS unchanged - still enabled on all 8.
-- Expected: relrowsecurity = true for all 8.
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('journal_entries','user_intentions','rhythms','routine_responses',
                   'practice_completion_events','entitlements','profiles','checkout_attempts')
ORDER BY relname;

-- 7. Live behavioural proof, read-only and non-destructive: the exact
--    filtered DELETE the deletion flow performs on each table, as
--    service_role, wrapped in a transaction that is always rolled back.
-- Expected: all 8 succeed (no 42501 error). Run once per table:
--   BEGIN; SET LOCAL ROLE service_role;
--   DELETE FROM public.<table> WHERE <user_id|id> = '8a8f893b-9c1f-4fce-b36e-0e6ea6bca481';
--   ROLLBACK;
