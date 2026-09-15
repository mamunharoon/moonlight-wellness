-- Rollback for 20260915100000_account_deletion_requests.sql
--
-- Drops the SELECT policy and the partial unique index unconditionally
-- (safe — removes access rules, not data). The table itself is dropped
-- only if it is empty, matching the subscriptions-foundation rollback's
-- own non-destructive philosophy — if real deletion requests exist by
-- the time this rollback is considered, it leaves the table in place and
-- raises a notice instead of silently destroying them.
--
-- Re-running this rollback after the table is already gone is a no-op
-- (every statement below is conditional on the object existing).

BEGIN;

DROP POLICY IF EXISTS "account_deletion_requests_select_own" ON public.account_deletion_requests;

DROP INDEX IF EXISTS public.account_deletion_requests_one_pending_per_user;

DO $$
DECLARE
  row_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'account_deletion_requests'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.account_deletion_requests' INTO row_count;

  IF row_count = 0 THEN
    DROP TABLE public.account_deletion_requests;
  ELSE
    RAISE NOTICE 'account_deletion_requests rollback: table has % row(s) — not dropped. Drop manually once you have confirmed that data does not need to be kept.', row_count;
  END IF;
END $$;

COMMIT;
