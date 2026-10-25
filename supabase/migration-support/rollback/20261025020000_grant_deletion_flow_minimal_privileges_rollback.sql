-- Rollback for 20261025020000_grant_deletion_flow_minimal_privileges.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Removes exactly the privileges this migration added. Purely a grant
-- change - reversing it is safe and immediate, with no data implications
-- either direction.
--
-- Consequence of running this: the account-deletion flow on production
-- fails again at the first affected step - account_deletion_requests
-- reads/writes return Postgres 42501 (the exact ASC-15 incident this
-- migration fixes), and even if that one table were separately patched,
-- the next step (deleting the user's own rows) would fail the same way
-- at journal_entries, then every other table in turn. Only roll this
-- back if the forward migration itself is confirmed to be the cause of
-- some OTHER, newly-discovered problem - not as a routine, low-stakes
-- revert.
--
-- Re-running this rollback after it's already been applied is a no-op
-- in effect (re-revoking a privilege that's already absent succeeds
-- harmlessly).

BEGIN;

REVOKE SELECT, INSERT, UPDATE ON public.account_deletion_requests FROM service_role;
REVOKE SELECT ON public.account_deletion_requests FROM authenticated;

REVOKE DELETE ON public.journal_entries FROM service_role;
REVOKE DELETE ON public.user_intentions FROM service_role;
REVOKE DELETE ON public.rhythms FROM service_role;
REVOKE DELETE ON public.routine_responses FROM service_role;
REVOKE DELETE ON public.practice_completion_events FROM service_role;
REVOKE DELETE ON public.provider_subscriptions FROM service_role;
REVOKE DELETE ON public.entitlements FROM service_role;
REVOKE DELETE ON public.subscriptions FROM service_role;
REVOKE DELETE ON public.profiles FROM service_role;

COMMIT;
