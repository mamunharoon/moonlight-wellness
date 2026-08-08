-- Sprint 2 Stage 3A rollback for 20260808150000_sprint2_stage3a_stripe_foundation.sql
--
-- Drops the two new UNIQUE constraints unconditionally (safe — removes an
-- access rule, not data). Drops the three new subscriptions columns only
-- if every value in all three is still NULL for every row (i.e. no user
-- has actually reached Stripe yet); otherwise leaves them in place and
-- raises a notice, same non-destructive philosophy as every prior
-- rollback in this project. Drops stripe_webhook_events only if it is
-- empty, for the same reason the Stage 1 rollback only drops
-- `subscriptions` itself when it's empty.
--
-- Re-running this rollback after these objects are already gone is a
-- no-op (every statement below is conditional on the object existing).

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_stripe_customer_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_stripe_customer_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_stripe_subscription_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_stripe_subscription_id_key;
  END IF;
END $$;

DO $$
DECLARE
  populated_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.subscriptions WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL OR stripe_price_id IS NOT NULL'
    INTO populated_count;

  IF populated_count = 0 THEN
    ALTER TABLE public.subscriptions
      DROP COLUMN IF EXISTS stripe_customer_id,
      DROP COLUMN IF EXISTS stripe_subscription_id,
      DROP COLUMN IF EXISTS stripe_price_id;
  ELSE
    RAISE NOTICE 'stripe foundation rollback: % subscriptions row(s) have Stripe identifiers set — columns not dropped. Drop manually once you have confirmed that data does not need to be kept.', populated_count;
  END IF;
END $$;

DO $$
DECLARE
  row_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.stripe_webhook_events' INTO row_count;

  IF row_count = 0 THEN
    DROP TABLE public.stripe_webhook_events;
  ELSE
    RAISE NOTICE 'stripe foundation rollback: stripe_webhook_events has % row(s) — not dropped. Drop manually once you have confirmed that data does not need to be kept.', row_count;
  END IF;
END $$;

COMMIT;
