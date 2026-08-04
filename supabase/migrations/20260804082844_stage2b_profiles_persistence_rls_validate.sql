-- Stage 2B validation queries -- READ-ONLY.
-- Run these individually (or all together) in the Supabase SQL Editor
-- AFTER applying 20260804082844_stage2b_profiles_persistence_rls.sql,
-- to confirm the migration applied exactly as intended.
--
-- None of these statements modify data or schema.

-- ----------------------------------------------------------------------------
-- 1. profiles columns -- expect id, name, streak_days, vibe_points, avg_sleep,
--    updated_at (all pre-existing) PLUS first_name, last_name, avatar_url,
--    created_at (newly added). No column should be missing or renamed.
-- ----------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 2. Unique constraints on rhythms and user_intentions -- expect exactly
--    rhythms_user_id_key and user_intentions_user_id_key, each type 'u'.
-- ----------------------------------------------------------------------------
SELECT conrelid::regclass AS table_name, conname, contype
FROM pg_constraint
WHERE conrelid IN ('public.rhythms'::regclass, 'public.user_intentions'::regclass)
  AND contype = 'u'
ORDER BY table_name, conname;

-- ----------------------------------------------------------------------------
-- 3. RLS status for all four tables -- expect rowsecurity = true for all four.
-- ----------------------------------------------------------------------------
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY relname;

-- ----------------------------------------------------------------------------
-- 4. Policies for all four tables -- expect:
--      profiles:         3 policies (select, insert, update -- no delete)
--      rhythms:           4 policies (select, insert, update, delete)
--      journal_entries:   4 policies (select, insert, update, delete)
--      user_intentions:   4 policies (select, insert, update, delete)
--    All roles should show {authenticated} only -- never {public} or {anon}.
-- ----------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'rhythms', 'journal_entries', 'user_intentions')
ORDER BY tablename, cmd;

-- ----------------------------------------------------------------------------
-- 5. Row counts for all four tables -- expect 0 for all four (no data has
--    been written yet; this migration only changes schema/policies).
-- ----------------------------------------------------------------------------
SELECT 'profiles' AS table_name, count(*) FROM public.profiles
UNION ALL
SELECT 'rhythms', count(*) FROM public.rhythms
UNION ALL
SELECT 'journal_entries', count(*) FROM public.journal_entries
UNION ALL
SELECT 'user_intentions', count(*) FROM public.user_intentions;
