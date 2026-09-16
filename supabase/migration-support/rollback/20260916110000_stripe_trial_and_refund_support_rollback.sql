-- Rollback for 20260916110000_stripe_trial_and_refund_support.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- *** WARNING ***: if any row currently has status = 'refunded', the
-- restored narrower CHECK constraint below will reject it and this
-- rollback will fail (safely — nothing is torn down half-way, since this
-- runs in one transaction). Confirm zero rows have status = 'refunded'
-- first if you intend to actually run this:
--   SELECT count(*) FROM public.subscriptions WHERE status = 'refunded';
-- If any exist, decide what those rows should become (e.g. 'cancelled')
-- before rolling back, or do not roll back.
--
-- Drops trial_used_at (a real data loss if any user's trial-eligibility
-- history had already been recorded there) and restores the original,
-- narrower status CHECK. Does not touch any other column, policy, or
-- grant on `subscriptions`.

BEGIN;

DO $$
DECLARE
  existing_check_name text;
BEGIN
  SELECT con.conname INTO existing_check_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY (con.conkey)
  WHERE con.conrelid = 'public.subscriptions'::regclass
    AND con.contype = 'c'
    AND att.attname = 'status'
  LIMIT 1;

  IF existing_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', existing_check_name);
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trial', 'active', 'cancelled', 'expired'));

ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS trial_used_at;

COMMIT;
