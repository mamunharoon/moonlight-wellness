-- Rollback for 20261023040000_revenuecat_webhook_provider_events_insert_grant.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Removes exactly the one grant this migration added. Purely a grant
-- change — reversing it is safe and immediate, with no data
-- implications either direction (grants don't affect existing rows;
-- every row already written to provider_events stays exactly as it is).
--
-- Consequence of running this: revenuecat-webhook's own direct
-- `provider_events` insert (the acknowledge-only/quarantine/
-- backend-scope-rejected branches) will fail with 42501 again —
-- reintroducing the exact condition the 2026-10-23 incident traced. With
-- the CURRENTLY DEPLOYED error-handling code (as of this migration),
-- that again means TEST/wrong-backend/malformed events 500 and
-- RevenueCat retries them pointlessly. The separate, still-uncommitted
-- error-handling fix (decoupling an audit-log failure from an
-- already-decided zero-write outcome) is NOT part of this migration and
-- is not assumed deployed here — do not roll this back expecting that
-- fix to quietly absorb it, unless that code is independently confirmed
-- live first.
--
-- Re-running this rollback after it's already been applied is a no-op
-- in effect (re-revoking a privilege that's already absent succeeds
-- harmlessly).

BEGIN;

REVOKE INSERT ON public.provider_events FROM service_role;

COMMIT;
