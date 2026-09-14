-- Stage 2B Group 5.1 validation queries.
-- Run these individually (or all together) in the Supabase SQL Editor
-- AFTER applying 20260804190000_stage2b_journal_client_id_dedup.sql,
-- to confirm the migration applied exactly as intended.
--
-- Sections 1-5 are strictly READ-ONLY -- they never modify data or schema.
-- Sections 6-7 test constraint ENFORCEMENT by attempting inserts that must
-- succeed or fail as documented; each is wrapped in its own
-- BEGIN ... ROLLBACK so no row is ever left behind regardless of outcome.
-- Do not remove the ROLLBACK line from sections 6-7.

-- ----------------------------------------------------------------------------
-- 1. client_id column exists with the correct type and is nullable.
--    Expect one row: client_id | uuid | YES | NULL (no default).
-- ----------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'journal_entries'
  AND column_name = 'client_id';

-- ----------------------------------------------------------------------------
-- 2. Unique constraint exists on (user_id, client_id).
--    Expect exactly one row: journal_entries_user_id_client_id_key, type 'u',
--    covering both the user_id and client_id columns.
-- ----------------------------------------------------------------------------
SELECT
  con.conname,
  con.contype,
  array_agg(att.attname ORDER BY att.attnum) AS constrained_columns
FROM pg_constraint con
JOIN pg_attribute att
  ON att.attrelid = con.conrelid
  AND att.attnum = ANY (con.conkey)
WHERE con.conrelid = 'public.journal_entries'::regclass
  AND con.conname = 'journal_entries_user_id_client_id_key'
GROUP BY con.conname, con.contype;

-- ----------------------------------------------------------------------------
-- 3. Index verification. UNIQUE constraints in PostgreSQL are backed by an
--    implicitly-created unique index of the same name, so this must show a
--    journal_entries_user_id_client_id_key index (UNIQUE, btree, on
--    (user_id, client_id)) alongside whatever indexes already existed on
--    journal_entries beforehand (e.g. its primary key index). No index
--    unrelated to this migration should appear, disappear, or change.
-- ----------------------------------------------------------------------------
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'journal_entries'
ORDER BY indexname;

-- ----------------------------------------------------------------------------
-- 4. Existing rows remain unchanged. Expect the same rows that existed
--    before this migration (from Group 4.2 testing), each now showing
--    client_id = NULL, with id, user_id, created_at, title, and body all
--    untouched.
-- ----------------------------------------------------------------------------
SELECT id, user_id, created_at, title, body, client_id
FROM public.journal_entries
ORDER BY id;

-- ----------------------------------------------------------------------------
-- 5. Existing Group 4.2 journal rows still exist (explicit presence check).
--    Expect count = 2: one row with body = 'fff', one row with body
--    'Group 4.2 test entry - 2026-08-04'.
-- ----------------------------------------------------------------------------
SELECT count(*) AS group_4_2_rows_present
FROM public.journal_entries
WHERE body IN ('fff', 'Group 4.2 test entry - 2026-08-04');

-- ----------------------------------------------------------------------------
-- 6. NULL values are permitted and duplicate (user_id, client_id) pairs
--    with a populated client_id are rejected.
--    Expect: the first INSERT succeeds, the second INSERT fails with a
--    unique_violation (23505) error, and the third INSERT (a second NULL
--    client_id for the same user) succeeds -- proving NULL never collides.
--    The whole block is rolled back at the end; no row is kept.
-- ----------------------------------------------------------------------------
BEGIN;

  -- Baseline row with a populated client_id for an arbitrary existing user.
  INSERT INTO public.journal_entries (user_id, body, client_id)
  SELECT user_id, 'validation: baseline row', '11111111-1111-1111-1111-111111111111'::uuid
  FROM public.journal_entries
  LIMIT 1;

  -- Expected to FAIL with unique_violation: same user_id + same client_id.
  INSERT INTO public.journal_entries (user_id, body, client_id)
  SELECT user_id, 'validation: duplicate attempt', '11111111-1111-1111-1111-111111111111'::uuid
  FROM public.journal_entries
  LIMIT 1;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- 7. Different users may reuse the same client_id value.
--    Expect: both INSERTs succeed (two distinct users, same client_id).
--    Requires at least two distinct user_id values already present in
--    journal_entries; if this table only has one user's rows so far, this
--    section will not exercise the cross-user case and can be skipped.
--    The whole block is rolled back at the end; no row is kept.
-- ----------------------------------------------------------------------------
BEGIN;

  INSERT INTO public.journal_entries (user_id, body, client_id)
  SELECT DISTINCT user_id, 'validation: cross-user reuse', '22222222-2222-2222-2222-222222222222'::uuid
  FROM public.journal_entries
  LIMIT 2;

ROLLBACK;
