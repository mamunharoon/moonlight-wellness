-- Validation queries -- READ-ONLY.
-- Run these individually (or all together) in the Supabase SQL Editor
-- AFTER applying 20260914120000_global_timezone_support.sql, to confirm
-- the migration applied exactly as intended.
--
-- None of these statements modify data or schema.

-- ----------------------------------------------------------------------------
-- 1. rhythms columns -- expect the existing columns (id, user_id,
--    wake_up_time, bedtime, updated_at, ...) PLUS the newly added
--    `timezone` (text, nullable). No column should be missing or renamed.
-- ----------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rhythms'
ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 2. The sanity-check constraint -- expect exactly one row,
--    rhythms_timezone_not_blank, type 'c' (check).
-- ----------------------------------------------------------------------------
SELECT conrelid::regclass AS table_name, conname, contype
FROM pg_constraint
WHERE conrelid = 'public.rhythms'::regclass
  AND conname = 'rhythms_timezone_not_blank';

-- ----------------------------------------------------------------------------
-- 3. Existing rows are untouched and timezone is NULL for all of them
--    immediately after this migration (no guessed backfill) -- expect
--    total_rows = timezone_null_rows right after applying, and 0 for
--    non_ascii/blank_after_trim (the CHECK constraint should make the
--    latter impossible going forward, but this confirms no row somehow
--    already had a blank string before the constraint existed).
-- ----------------------------------------------------------------------------
SELECT
  count(*) AS total_rows,
  count(*) FILTER (WHERE timezone IS NULL) AS timezone_null_rows,
  count(*) FILTER (WHERE timezone IS NOT NULL) AS timezone_set_rows,
  count(*) FILTER (WHERE timezone IS NOT NULL AND length(btrim(timezone)) = 0) AS blank_after_trim
FROM public.rhythms;

-- ----------------------------------------------------------------------------
-- 4. Spot-check the distinct set of confirmed timezones once users start
--    setting them (empty result set immediately after migration is
--    expected and correct).
-- ----------------------------------------------------------------------------
SELECT timezone, count(*) AS user_count
FROM public.rhythms
WHERE timezone IS NOT NULL
GROUP BY timezone
ORDER BY user_count DESC;
