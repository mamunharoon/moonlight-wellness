-- Rollback for 20260918100000_checkout_attempts_concurrency_guard.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Drops the RPC and the table together (the RPC has no reason to exist
-- without the table it operates on). Does not touch subscriptions,
-- provider_subscriptions, entitlements, or any of their rows/policies —
-- this feature is fully isolated to the one new table.

BEGIN;

DROP FUNCTION IF EXISTS public.claim_checkout_attempt(uuid, uuid, text);
DROP TABLE IF EXISTS public.checkout_attempts;

COMMIT;
