-- Validation queries for 20260919130000_user_intentions_ordered_list.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. The column exists, jsonb, NOT NULL, default '[]'.
-- Expected: 1 row, data_type = jsonb, is_nullable = NO, column_default = '[]'::jsonb.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_intentions' AND column_name = 'intentions';

-- 2. Every existing row backfilled - no row has a null/empty intentions array.
-- Expected: 0 rows.
SELECT id, user_id, intention, intentions
FROM public.user_intentions
WHERE intentions IS NULL OR jsonb_array_length(intentions) = 0;

-- 3. Every row's intentions[0] matches its own intention column (Primary mirror intact).
-- Expected: 0 rows.
SELECT id, user_id, intention, intentions
FROM public.user_intentions
WHERE intentions ->> 0 IS DISTINCT FROM intention;

-- 4. The shape CHECK constraint exists.
-- Expected: 1 row.
SELECT conname FROM pg_constraint
WHERE conname = 'user_intentions_intentions_shape' AND conrelid = 'public.user_intentions'::regclass;

-- 5. The pre-existing intention column and its NOT NULL are untouched.
-- Expected: 1 row, data_type = text, is_nullable = NO.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_intentions' AND column_name = 'intention';

-- 6. The pre-existing UNIQUE(user_id) constraint is untouched.
-- Expected: 1 row.
SELECT conname FROM pg_constraint
WHERE conname = 'user_intentions_user_id_key' AND conrelid = 'public.user_intentions'::regclass;

-- 7. RLS is still enabled with the same four owner-only policies (unchanged by this migration).
-- Expected: relrowsecurity = true.
SELECT relrowsecurity FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relname = 'user_intentions';

-- Expected: 4 rows (select/insert/update/delete _own).
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_intentions';
