-- Rollback for 20261023060000_restore_authenticated_insert_update_rhythms.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Removes exactly the two grants this migration added. Reintroduces the
-- exact 2026-10-23 timezone-save incident this migration exists to fix
-- (every signed-in user's timezone confirmation / wake-bed-timezone save
-- fails with "permission denied for table rhythms"). No data
-- implications either direction - grants don't affect existing rows.
--
-- Re-running this rollback after it's already been applied is a no-op in
-- effect (re-revoking an already-absent privilege succeeds harmlessly).

BEGIN;

REVOKE INSERT, UPDATE ON public.rhythms FROM authenticated;

COMMIT;
