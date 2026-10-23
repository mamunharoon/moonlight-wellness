-- Rollback for 20261023070000_restore_authenticated_select_subscriptions.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Removes exactly the one grant this migration added. Reintroduces the
-- exact entitlement-read failure this migration exists to fix (every
-- signed-in user's unified entitlement resolves to
-- VERIFICATION_UNAVAILABLE instead of their real plan/status, blocking
-- every premium-gated screen). No data implications either direction -
-- grants don't affect existing rows.
--
-- Re-running this rollback after it's already been applied is a no-op in
-- effect (re-revoking an already-absent privilege succeeds harmlessly).

BEGIN;

REVOKE SELECT ON public.subscriptions FROM authenticated;

COMMIT;
