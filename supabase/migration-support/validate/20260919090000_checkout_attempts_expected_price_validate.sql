-- Validation queries for 20260919090000_checkout_attempts_expected_price.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. The column exists, nullable text.
-- Expected: 1 row, data_type = text, is_nullable = YES.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'checkout_attempts' AND column_name = 'expected_stripe_price_id';

-- 2. RLS is still enabled with zero policies (unchanged by this migration).
-- Expected: relrowsecurity = true.
SELECT relrowsecurity FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relname = 'checkout_attempts';

-- Expected: 0 rows.
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'checkout_attempts';

-- 3. claim_checkout_attempt's grants are unchanged (service_role only).
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'claim_checkout_attempt'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC');

-- Expected: 1 row.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'claim_checkout_attempt'
  AND grantee = 'service_role';

-- 4. The three original unique indexes are unaffected.
-- Expected: 3 rows.
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'checkout_attempts' AND indexname LIKE 'checkout_attempts_%_key' OR indexname = 'checkout_attempts_one_live_per_user';
