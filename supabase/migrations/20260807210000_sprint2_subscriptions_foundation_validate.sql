-- Sprint 2 Stage 1 validation queries for
-- 20260807210000_sprint2_subscriptions_foundation.sql — READ-ONLY.
--
-- Run each block and compare against "Expected". None of these mutate
-- data or schema.

-- 1. Table and columns exist with the expected types/defaults.
-- Expected: 10 rows — id, user_id, plan, status, provider, started_at,
-- expires_at, cancel_at_period_end, created_at, updated_at.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 2. CHECK constraints on plan/status/provider are present.
-- Expected: 3 rows (one per enum column), each showing the allowed
-- value list in its definition.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass
  AND contype = 'c';

-- 3. UNIQUE(user_id) constraint is present.
-- Expected: 1 row, conname = 'subscriptions_user_id_key'.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass
  AND contype = 'u';

-- 4. RLS is enabled.
-- Expected: relrowsecurity = true.
SELECT relrowsecurity
FROM pg_class
WHERE oid = 'public.subscriptions'::regclass;

-- 5. Exactly one policy exists, SELECT-only, owner-scoped, authenticated-only.
-- Expected: 1 row — subscriptions_select_own, cmd = SELECT,
-- roles = {authenticated}, qual mentions auth.uid() = user_id.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subscriptions';

-- 6. No new table is empty by default (expected state right after this
-- migration, before any plan-assignment mechanism exists).
-- Expected: 0.
SELECT count(*) FROM public.subscriptions;
