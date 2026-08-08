-- Sprint 2 Stage 1 rollback for 20260807210000_sprint2_subscriptions_foundation.sql
--
-- Drops the SELECT policy and the UNIQUE(user_id) constraint
-- unconditionally (safe — removes access rules, not data). The table
-- itself is dropped only if it is empty. If a future stage has already
-- written real subscription rows (e.g. a Stripe webhook handler going
-- live), this rollback leaves the table in place and raises a notice
-- instead of silently destroying that data — same non-destructive
-- philosophy as every prior rollback in this project, extended to cover
-- "the migration created the whole table" rather than just columns.
--
-- Re-running this rollback after the table is already gone is a no-op
-- (every statement below is conditional on the object existing).

BEGIN;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_user_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      DROP CONSTRAINT subscriptions_user_id_key;
  END IF;
END $$;

DO $$
DECLARE
  row_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.subscriptions' INTO row_count;

  IF row_count = 0 THEN
    DROP TABLE public.subscriptions;
  ELSE
    RAISE NOTICE 'subscriptions rollback: table has % row(s) — not dropped. Drop manually once you have confirmed that data does not need to be kept.', row_count;
  END IF;
END $$;

COMMIT;
