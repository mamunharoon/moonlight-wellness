-- Rollback for
-- 20261023050000_restore_authenticated_select_profiles_rhythms_journal_intentions.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Removes exactly the four grants this migration added. Reintroduces the
-- exact 2026-10-23 incident this migration exists to fix (every signed-in
-- user's own Profile/Onboarding/Alarm/Journal/Intentions screens fail
-- with "permission denied for table ..." the moment they try to read
-- their own row) - never run this expecting it to be a safe default, only
-- if the grant itself is somehow confirmed to be the wrong fix. No data
-- implications either direction - grants don't affect existing rows.
--
-- Re-running this rollback after it's already been applied is a no-op in
-- effect (re-revoking an already-absent privilege succeeds harmlessly).

BEGIN;

REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.rhythms FROM authenticated;
REVOKE SELECT ON public.journal_entries FROM authenticated;
REVOKE SELECT ON public.user_intentions FROM authenticated;

COMMIT;
