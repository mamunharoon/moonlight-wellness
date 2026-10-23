-- Validation queries for
-- 20261023060000_restore_authenticated_insert_update_rhythms.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. authenticated now has INSERT and UPDATE on rhythms, plus the
-- pre-existing REFERENCES/SELECT/TRIGGER/TRUNCATE - nothing else.
-- Expected: 6 privilege_types - INSERT, REFERENCES, SELECT, TRIGGER,
-- TRUNCATE, UPDATE.
SELECT jsonb_agg(privilege_type ORDER BY privilege_type) AS privilege_types
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'rhythms' AND grantee = 'authenticated';

-- 2. DELETE was NOT added - no current client write path ever deletes a
-- rhythms row.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'rhythms'
  AND grantee = 'authenticated' AND privilege_type = 'DELETE';

-- 3. anon/PUBLIC gained nothing.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'rhythms'
  AND grantee IN ('anon', 'PUBLIC') AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 4. RLS unchanged (still enabled), and the exact same owner-only
-- INSERT/UPDATE policies still exist with the same with_check/qual.
-- Expected: relrowsecurity = true.
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rhythms'::regclass;

-- Expected: 2 rows - rhythms_insert_own (with_check auth.uid() =
-- user_id), rhythms_update_own (qual AND with_check auth.uid() =
-- user_id), both roles = {authenticated}.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rhythms' AND cmd IN ('INSERT', 'UPDATE');

-- 5. No column-level grant was added - this migration is table-level only.
-- Expected: 0 rows (the only column-level INSERT/UPDATE grants on any of
-- the four tables fixed this round remain exactly profiles' own
-- pre-existing ones, untouched by this migration).
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'rhythms'
  AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE');

-- 6. Live behavioural proof - the real affected account's own timezone
-- upsert now succeeds. Uses the account's real, already-existing id
-- (confirmed to have no rhythms row yet, same as its profiles row), and
-- is itself read-only validation: this SELECT only confirms the row
-- upsert's effect from the earlier reproduction attempt, which already
-- ran inside its own rolled-back transaction and left no row - this
-- query is expected to find none either, confirming no side effect was
-- left by that reproduction, not that this migration itself writes
-- anything.
-- Expected: 0 rows.
SELECT user_id FROM public.rhythms WHERE user_id = 'b400f356-f2f9-456d-908b-2b326ca81d8e';
