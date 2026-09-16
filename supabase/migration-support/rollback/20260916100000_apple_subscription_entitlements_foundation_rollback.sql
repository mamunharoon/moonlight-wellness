-- Rollback for 20260916100000_apple_subscription_entitlements_foundation.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Drops exactly the three new tables (and, by cascade, their indexes,
-- policies, and constraints) this migration created. Nothing else —
-- `subscriptions`, `stripe_webhook_events`, and every other existing
-- table/policy/grant is completely untouched by this file.
--
-- Safe to run at any time before the tables hold real data (they cannot
-- yet, since no Edge Function writes to them in this phase — see
-- docs/apple-subscription-implementation.md). If this is ever run after
-- real Apple/Stripe provider data has been written here, that data is
-- permanently lost — confirm row counts are zero (or acceptable to lose)
-- before running, per this project's own established rollback-file
-- convention.

BEGIN;

DROP TABLE IF EXISTS public.provider_events;
DROP TABLE IF EXISTS public.provider_subscriptions;
DROP TABLE IF EXISTS public.entitlements;

COMMIT;
