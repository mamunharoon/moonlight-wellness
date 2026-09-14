-- Sprint 2 Stage 3A validation queries for
-- 20260808150000_sprint2_stage3a_stripe_foundation.sql — READ-ONLY.
--
-- Run each block and compare against "Expected". None of these mutate
-- data or schema.

-- 1. New subscriptions columns exist, nullable, no default.
-- Expected: 3 rows — stripe_customer_id, stripe_price_id, stripe_subscription_id (text, nullable).
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriptions'
  AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id')
ORDER BY column_name;

-- 2. Both new UNIQUE constraints are present.
-- Expected: 2 rows.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass
  AND contype = 'u'
  AND conname LIKE 'subscriptions_stripe%';

-- 3. Existing subscriptions RLS policy is untouched by this migration.
-- Expected: 1 row — subscriptions_select_own (same as before this migration ran).
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subscriptions';

-- 4. stripe_webhook_events exists with the expected columns.
-- Expected: 3 rows — id (text), received_at (timestamptz), type (text).
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events'
ORDER BY column_name;

-- 5. stripe_webhook_events has RLS enabled and zero policies (service-role only).
-- Expected: relrowsecurity = true; second query returns 0 rows.
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.stripe_webhook_events'::regclass;
SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stripe_webhook_events';

-- 6. No existing user has Stripe identifiers yet (expected state right
-- after this migration, before any checkout has happened).
-- Expected: 0.
SELECT count(*) FROM public.subscriptions WHERE stripe_customer_id IS NOT NULL;
