-- Validation queries for 20260915100000_account_deletion_requests.sql — READ-ONLY.
--
-- Run each block and compare against "Expected". None of these mutate
-- data or schema.

-- 1. Table and columns exist with the expected types/defaults.
-- Expected: 10 rows — id, user_id, status, requested_at, scheduled_for,
-- cancelled_at, completed_at, billing_status_at_request, processing_note,
-- created_at, updated_at.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'account_deletion_requests'
ORDER BY ordinal_position;

-- 2. status CHECK constraint is present with exactly the 4 expected values.
-- Expected: 1 row, definition mentions pending/cancelled/processing/completed.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.account_deletion_requests'::regclass
  AND contype = 'c';

-- 3. user_id foreign key is ON DELETE SET NULL (not CASCADE, unlike every
-- other user-owned table in this project — this is deliberate, see the
-- forward migration's own header).
-- Expected: 1 row, confdeltype = 'n' (SET NULL).
SELECT
  conname,
  CASE confdeltype WHEN 'n' THEN 'SET NULL' WHEN 'c' THEN 'CASCADE' ELSE confdeltype::text END AS on_delete
FROM pg_constraint
WHERE conrelid = 'public.account_deletion_requests'::regclass
  AND contype = 'f';

-- 4. Partial unique index enforces one pending request per user.
-- Expected: 1 row, indexdef mentions "WHERE (status = 'pending'::text)".
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'account_deletion_requests'
  AND indexname = 'account_deletion_requests_one_pending_per_user';

-- 5. RLS is enabled.
-- Expected: relrowsecurity = true.
SELECT relrowsecurity
FROM pg_class
WHERE oid = 'public.account_deletion_requests'::regclass;

-- 6. Exactly one policy exists, SELECT-only, owner-scoped, authenticated-only.
-- Expected: 1 row — account_deletion_requests_select_own, cmd = SELECT,
-- roles = {authenticated}, qual mentions auth.uid() = user_id.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'account_deletion_requests';

-- 7. No new table is empty by default (expected state right after this
-- migration — nothing has requested deletion yet).
-- Expected: 0.
SELECT count(*) FROM public.account_deletion_requests;
