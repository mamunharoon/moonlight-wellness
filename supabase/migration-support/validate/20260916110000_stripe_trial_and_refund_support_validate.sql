-- Validation queries for 20260916110000_stripe_trial_and_refund_support.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. trial_used_at exists on subscriptions, nullable timestamptz.
-- Expected: 1 row, data_type = 'timestamp with time zone', is_nullable = 'YES'.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'trial_used_at';

-- 2. status CHECK constraint now allows exactly the five expected values.
-- Expected: the constraint definition text should list
-- 'trial','active','cancelled','expired','refunded' and no others.
SELECT pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_attribute att
  ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
WHERE con.conrelid = 'public.subscriptions'::regclass
  AND con.contype = 'c'
  AND att.attname = 'status';

-- 3. Exactly one CHECK constraint governs status (no leftover duplicate
--    from a previous run).
-- Expected: 1 row.
SELECT count(*) AS status_check_constraint_count
FROM pg_constraint con
JOIN pg_attribute att
  ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
WHERE con.conrelid = 'public.subscriptions'::regclass
  AND con.contype = 'c'
  AND att.attname = 'status';

-- 4. No existing row was altered by this migration (sanity check — this
--    migration only adds a column and widens a constraint, never
--    UPDATEs existing rows).
-- Expected: row count unchanged from before this migration ran (compare
-- manually against your own pre-migration count; nothing here can assert
-- that automatically).
SELECT count(*) AS total_subscription_rows FROM public.subscriptions;

-- 5. RLS/grants on subscriptions are completely unchanged by this
--    migration (sanity check).
-- Expected: same policy set this project already had — subscriptions_select_own only.
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subscriptions';
