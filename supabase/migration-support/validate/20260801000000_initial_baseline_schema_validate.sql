-- Initial baseline schema validation -- READ-ONLY, single execution.
-- Every statement below is a SELECT. None of them modify data or schema.
--
-- Run this whole file in one go (Supabase SQL Editor, or `psql -f`) against
-- BOTH live DEV (kvdxuhyndevrfvsalgnx) and, after this baseline is actually
-- applied there, PROD (wqpszprbuqdjcfmdqdlv) -- diff the two result sets.
-- Every "expect" note below distinguishes a project where ONLY this
-- baseline has been applied (fresh/PROD-before-the-other-11-migrations)
-- from live DEV (baseline + all 11 tracked migrations already applied) --
-- read the note that matches the project you are actually running this
-- against.
--
-- This file replaces the single-purpose validation script this repo
-- previously shipped for this migration; it consolidates every check into
-- one execution rather than one query per concern.

-- ============================================================================
-- 1. Table existence -- expect all four rows present, either way.
-- ============================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY table_name;

-- ============================================================================
-- 2. Columns -- name, order, type, nullability, default, identity status
--    and generation mode, in one row per column. On a fresh/PROD-only
--    project, expect EXACTLY the columns in
--    20260801000000_initial_baseline_schema.sql's own CREATE TABLE
--    statements, nothing else. On live DEV, expect those PLUS every
--    column the 11 tracked migrations add (profiles: first_name,
--    last_name, avatar_url, created_at, is_admin, beta_access; rhythms:
--    timezone; journal_entries: client_id) -- see this migration's own
--    header for exactly which migration adds each one.
-- ============================================================================
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default,
  is_identity,
  identity_generation,
  identity_start,
  identity_increment,
  identity_minimum,
  identity_maximum,
  identity_cycle
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 3. Identity sequence configuration -- the actual sequence object backing
--    each bigint identity column (rhythms.id, journal_entries.id,
--    user_intentions.id -- profiles.id is a plain uuid, no sequence).
--    Expect one row per identity column, owned by that column, on any
--    project (fresh or live DEV).
--
--    Corrected: this previously joined pg_depend on deptype = 'a'
--    (DEPENDENCY_AUTO), which is the dependency type Postgres uses for a
--    legacy `serial`/`bigserial` column's sequence (created via
--    ALTER SEQUENCE ... OWNED BY). A `GENERATED ALWAYS AS IDENTITY`
--    column's sequence -- what rhythms.id/journal_entries.id/
--    user_intentions.id actually are -- is instead recorded with
--    deptype = 'i' (DEPENDENCY_INTERNAL), which is what marks the
--    sequence as an intrinsic, non-independent part of its owning
--    column. Filtering on 'a' would silently return zero rows against
--    these three tables even though the sequences genuinely exist.
-- ============================================================================
SELECT
  s.sequencename,
  s.data_type,
  s.start_value,
  s.increment_by,
  s.min_value,
  s.max_value,
  s.cycle,
  s.last_value,
  dep.refobjid::regclass AS owning_table,
  att.attname AS owning_column
FROM pg_sequences s
JOIN pg_class seqclass ON seqclass.relname = s.sequencename AND seqclass.relnamespace = s.schemaname::regnamespace
JOIN pg_depend dep ON dep.objid = seqclass.oid AND dep.deptype = 'i'
JOIN pg_attribute att ON att.attrelid = dep.refobjid AND att.attnum = dep.refobjsubid
WHERE s.schemaname = 'public'
  AND dep.refobjid IN (
    'public.rhythms'::regclass, 'public.journal_entries'::regclass, 'public.user_intentions'::regclass
  )
ORDER BY dep.refobjid::regclass::text, att.attname;

-- ============================================================================
-- 4. Constraints -- primary key, foreign key, unique and check, in one
--    result set. On a fresh/PROD-only project, expect exactly one 'p'
--    (primary key) and one 'f' (foreign key, to auth.users, ON DELETE
--    CASCADE) row per table, and ZERO 'u'/'c' rows. On live DEV, also
--    expect: rhythms_user_id_key ('u'), rhythms_timezone_not_blank ('c'),
--    user_intentions_user_id_key ('u'), and
--    journal_entries_user_id_client_id_key ('u') -- all added later, see
--    this migration's own header.
-- ============================================================================
SELECT
  conrelid::regclass AS table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  'public.profiles'::regclass, 'public.rhythms'::regclass,
  'public.journal_entries'::regclass, 'public.user_intentions'::regclass
)
ORDER BY table_name, contype, conname;

-- ============================================================================
-- 5. Indexes -- expect, on ANY project (fresh or live DEV), only each
--    table's own primary-key index plus one index per later-added unique
--    constraint from §4 above (Postgres creates a supporting index for
--    every unique/primary-key constraint automatically) -- no independent
--    /custom CREATE INDEX exists anywhere on these four tables.
-- ============================================================================
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY tablename, indexname;

-- ============================================================================
-- 6. RLS enabled/forced state -- expect rowsecurity = true and
--    forcerowsecurity = false for all four, on any project.
-- ============================================================================
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY relname;

-- ============================================================================
-- 7. Policy definitions -- expect ZERO rows on a fresh/PROD-only project
--    (this baseline defines none -- see its own header). On live DEV,
--    expect the full set 20260804082844 creates (profiles: 3 -- select/
--    insert/update, no delete; rhythms: 4; journal_entries: 4;
--    user_intentions: 4), every one scoped to {authenticated} only, never
--    {public} or {anon}.
-- ============================================================================
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 8. Triggers -- non-internal only (tgisinternal excludes constraint-
--    backed system triggers, e.g. those enforcing a foreign key, which
--    are not application-defined triggers). Expect ZERO rows on any
--    project -- confirmed live that no custom trigger exists on any of
--    these four tables, and no tracked migration adds one.
-- ============================================================================
SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
  AND NOT t.tgisinternal
ORDER BY table_name, trigger_name;

-- ============================================================================
-- 9. Table-level grants for anon/authenticated/service_role -- for
--    comparison only; this migration issues no explicit GRANT/REVOKE
--    (see its own header, §6), so any row seen here on a fresh/PROD-only
--    project is a Supabase platform default, not something this file
--    controls. On live DEV, `profiles` additionally reflects
--    20260915160000's narrower column-level INSERT/UPDATE grant (that
--    migration revokes the table-level INSERT/UPDATE seen here and
--    grants back only specific columns -- this query shows table-level
--    grants only; cross-check column-level grants separately via
--    information_schema.column_privileges if a discrepancy is suspected).
-- ============================================================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================================
-- 10. Extension -- expect pgcrypto present in the `extensions` schema on
--     any project (provisioned by this migration; also a Supabase
--     platform default on new projects regardless).
-- ============================================================================
SELECT extname, extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname = 'pgcrypto';

-- ============================================================================
-- 11. Migration ledger -- Supabase-specific (supabase_migrations.schema_migrations);
--     skip this section if running against a non-Supabase-managed Postgres,
--     where this schema will not exist. Expect this baseline's own
--     version (20260801000000) plus all 11 tracked versions
--     (20260804082844 through 20260916120000) present on live DEV once
--     this baseline has actually been applied and its version recorded;
--     on a project where only `db push` of the forward SQL was tested
--     without a matching ledger entry, this baseline's own row may be
--     absent even though its tables exist -- that is a ledger bookkeeping
--     gap, not a schema problem, and is out of scope for this read-only
--     script to fix.
-- ============================================================================
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260801000000',
  '20260804082844', '20260804190000', '20260807210000', '20260808120000',
  '20260808150000', '20260914120000', '20260915100000', '20260915160000',
  '20260916100000', '20260916110000', '20260916120000'
)
ORDER BY version;

-- ============================================================================
-- 12. Row counts -- expect 0 for all four on a fresh/PROD-only project
--     (schema only, no data). On live DEV, non-zero counts are expected
--     and are NOT inspected here beyond a count -- this script never
--     selects or displays row contents.
-- ============================================================================
SELECT 'profiles' AS table_name, count(*) FROM public.profiles
UNION ALL
SELECT 'rhythms', count(*) FROM public.rhythms
UNION ALL
SELECT 'journal_entries', count(*) FROM public.journal_entries
UNION ALL
SELECT 'user_intentions', count(*) FROM public.user_intentions;
