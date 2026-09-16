-- Validation queries for 20260916100000_apple_subscription_entitlements_foundation.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. All three tables exist.
-- Expected: 3 rows (entitlements, provider_events, provider_subscriptions).
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('entitlements', 'provider_subscriptions', 'provider_events')
ORDER BY table_name;

-- 2. RLS is enabled on all three.
-- Expected: 3 rows, all relrowsecurity = true.
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('entitlements', 'provider_subscriptions', 'provider_events')
ORDER BY relname;

-- 3. authenticated has SELECT-own only on entitlements/provider_subscriptions.
-- Expected: exactly 2 rows, cmd = 'SELECT', roles = {authenticated}.
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('entitlements', 'provider_subscriptions')
ORDER BY tablename;

-- 4. provider_events has zero policies at all.
-- Expected: 0 rows.
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'provider_events';

-- 5. authenticated has no INSERT/UPDATE/DELETE on any of the three tables.
-- Expected: 0 rows.
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND grantee = 'authenticated'
  AND table_name IN ('entitlements', 'provider_subscriptions', 'provider_events')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 6. anon has no privilege at all on any of the three tables.
-- Expected: 0 rows.
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND grantee = 'anon'
  AND table_name IN ('entitlements', 'provider_subscriptions', 'provider_events');

-- 7. The two uniqueness backstops on provider_subscriptions exist.
-- Expected: 2 rows (provider_subscriptions_stripe_sub_unique, provider_subscriptions_apple_txn_unique).
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.provider_subscriptions'::regclass AND contype = 'u'
ORDER BY conname;

-- 7b. The Apple product-id allow-list CHECK constraint exists and lists
--     exactly the two known product ids.
-- Expected: 1 row, definition mentions both
-- 'com.zavaraai.wakewise.plus.monthly' and 'com.zavaraai.wakewise.plus.annual'.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.provider_subscriptions'::regclass
  AND conname = 'provider_subscriptions_apple_product_id_allowlist';

-- 8. The idempotency backstop on provider_events exists.
-- Expected: 1 row (provider_events_unique).
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.provider_events'::regclass AND contype = 'u';

-- 9. Existing subscriptions table and its policies are completely
--    untouched by this migration (sanity check, not a new assertion).
-- Expected: same policy set this project already had before this
-- migration — subscriptions_select_own only.
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subscriptions';
