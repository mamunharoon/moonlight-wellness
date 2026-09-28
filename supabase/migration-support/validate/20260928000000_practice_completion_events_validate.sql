-- Validation queries for 20260928000000_practice_completion_events.sql —
-- READ-ONLY. Run each block and compare against "Expected". None of these
-- mutate data or schema.

-- 1. Table and columns exist with the expected types/defaults.
-- Expected: 12 rows — event_id, user_id, session_id, journey,
-- practice_type, completed_at, duration_seconds, local_date, timezone,
-- outcome, idempotency_key, created_at.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'practice_completion_events'
ORDER BY ordinal_position;

-- 2. Every CHECK constraint is present with the expected definition.
-- Expected: 7 rows — journey/practice_type/outcome allowlists,
-- duration_seconds >= 0 (or null), timezone format, session_id and
-- idempotency_key not-blank.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.practice_completion_events'::regclass
  AND contype = 'c'
ORDER BY conname;

-- 3. user_id foreign key is ON DELETE CASCADE (matches routine_responses).
-- Expected: 1 row, confdeltype = 'c' (CASCADE).
SELECT
  conname,
  CASE confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' ELSE confdeltype::text END AS on_delete
FROM pg_constraint
WHERE conrelid = 'public.practice_completion_events'::regclass
  AND contype = 'f';

-- 4. Idempotency — the exact unique constraint the whole design depends on.
-- Expected: 1 row, definition mentions "UNIQUE (user_id, idempotency_key)".
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.practice_completion_events'::regclass
  AND contype = 'u';

-- 5. All three expected indexes exist.
-- Expected: 3 rows — user_completed_at_idx, user_local_date_idx,
-- user_journey_practice_idx (plus the PK's own implicit index, not listed
-- here since pg_indexes includes it too — 4 total if you count that one).
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'practice_completion_events'
ORDER BY indexname;

-- 6. RLS is enabled.
-- Expected: relrowsecurity = true.
SELECT relrowsecurity
FROM pg_class
WHERE oid = 'public.practice_completion_events'::regclass;

-- 7. Exactly two policies exist — SELECT and INSERT, both owner-scoped,
-- authenticated-only. No UPDATE/DELETE policy should exist at all.
-- Expected: 2 rows — practice_completion_events_select_own (cmd=SELECT),
-- practice_completion_events_insert_own (cmd=INSERT); both
-- roles={authenticated}, qual/with_check mention auth.uid() = user_id.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'practice_completion_events';

-- 8. Grants — authenticated has exactly SELECT+INSERT; anon/PUBLIC have
-- nothing.
-- Expected: rows for grantee='authenticated' showing SELECT and INSERT
-- only; no rows at all for grantee in ('anon', 'PUBLIC').
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'practice_completion_events'
ORDER BY grantee, privilege_type;

-- 9. New table is empty by default (expected state right after this
-- migration — nothing has been recorded yet).
-- Expected: 0.
SELECT count(*) FROM public.practice_completion_events;
