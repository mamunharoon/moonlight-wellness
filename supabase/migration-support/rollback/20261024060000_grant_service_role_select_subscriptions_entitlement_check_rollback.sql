-- Rollback for 20261024060000_grant_service_role_select_subscriptions_entitlement_check.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Removes exactly the two grants this migration added. Purely a grant
-- change - reversing it is safe and immediate, with no data
-- implications either direction.
--
-- Consequence of running this: get-beta-video-url's own premium
-- entitlement check (checkPremiumAccess) will fail its subscriptions/
-- provider_subscriptions read again (Postgres 42501), reintroducing the
-- exact 503 VERIFICATION_UNAVAILABLE condition the 2026-10-24 incident
-- traced - every Plus-classified id (57 of 86) would stop loading again
-- for every signed-in user, regardless of actual subscription status.
-- Only roll this back if the forward migration itself is confirmed to
-- be the cause of some OTHER, newly-discovered problem - not as a
-- routine, low-stakes revert.
--
-- Re-running this rollback after it's already been applied is a no-op
-- in effect (re-revoking a privilege that's already absent succeeds
-- harmlessly).

BEGIN;

REVOKE SELECT ON public.subscriptions FROM service_role;
REVOKE SELECT ON public.provider_subscriptions FROM service_role;

COMMIT;
