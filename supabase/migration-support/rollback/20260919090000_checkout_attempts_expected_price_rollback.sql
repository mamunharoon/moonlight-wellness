-- Rollback for 20260919090000_checkout_attempts_expected_price.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Drops exactly the one column this migration added. No other column,
-- constraint, index, or RLS policy on checkout_attempts is touched.

BEGIN;

ALTER TABLE public.checkout_attempts
  DROP COLUMN IF EXISTS expected_stripe_price_id;

COMMIT;
