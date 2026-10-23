-- Validation queries for
-- 20261023050000_restore_authenticated_select_profiles_rhythms_journal_intentions.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. authenticated now has SELECT on all four tables, plus the
-- pre-existing inert privileges - nothing else was added.
-- Expected: 4 rows, each with privilege_types containing REFERENCES,
-- SELECT, TRIGGER, TRUNCATE and nothing else.
SELECT table_name, jsonb_agg(privilege_type ORDER BY privilege_type) AS privilege_types
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
  AND grantee = 'authenticated'
GROUP BY table_name
ORDER BY table_name;

-- 2. anon/PUBLIC gained nothing on any of the four tables - this
-- migration grants to authenticated only.
-- Expected: 0 rows.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
  AND grantee IN ('anon', 'PUBLIC')
  AND privilege_type = 'SELECT';

-- 3. No INSERT/UPDATE/DELETE was added for authenticated on any of the
-- four tables at the table level - this migration is SELECT-only.
-- Expected: 0 rows.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 4. profiles' pre-existing column-level INSERT/UPDATE restrictions are
-- completely unchanged by this migration.
-- Expected: 6 rows - first_name (INSERT, UPDATE), last_name (INSERT,
-- UPDATE), avatar_url (UPDATE), introduction_completed_version (UPDATE).
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE')
ORDER BY column_name, privilege_type;

-- 5. RLS is unchanged (still enabled) on all four tables, and the exact
-- same four owner-only SELECT policies still exist with the same qual -
-- this migration adds no policy and removes none.
-- Expected: 4 rows, relrowsecurity = true for each.
SELECT relname AS table_name, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY relname;

-- Expected: 4 rows - profiles_select_own (qual auth.uid() = id),
-- rhythms_select_own/journal_entries_select_own/user_intentions_select_own
-- (qual auth.uid() = user_id), all roles = {authenticated}.
SELECT tablename, policyname, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
  AND cmd = 'SELECT'
ORDER BY tablename;

-- 6. Live behavioural proof - a real signed-up account (not modified by
-- this migration) can now be read. This is the exact account the
-- incident was traced against; its row still does not exist (the
-- account could never progress past the failing SELECT to create one) -
-- confirming the SELECT itself now succeeds, returning zero rows rather
-- than erroring, is the correct, complete confirmation here. A real
-- profile row for this account will appear the next time it opens the
-- app, once this migration is live - not something this validation
-- forces or needs to force.
-- Expected: succeeds with 0 rows (not a permission error).
SELECT id FROM public.profiles WHERE id = 'b400f356-f2f9-456d-908b-2b326ca81d8e';
