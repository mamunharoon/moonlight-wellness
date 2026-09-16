-- Rollback for 20260916120000_apple_verified_state_rpc.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Drops exactly the one function this migration created. Does not touch
-- entitlements/provider_subscriptions/provider_events (their tables and
-- any rows already written by real calls to this function are left
-- completely untouched — only the function itself is removed, which
-- means the app can no longer WRITE new Apple state via this RPC until
-- it is re-applied, but no existing data is lost).

BEGIN;

DROP FUNCTION IF EXISTS public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text
);

COMMIT;
