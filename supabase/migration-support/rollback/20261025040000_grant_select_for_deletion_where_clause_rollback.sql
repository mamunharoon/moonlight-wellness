-- Rollback for 20261025040000_grant_select_for_deletion_where_clause.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Removes exactly the 8 column-level grants this migration added. Purely
-- a grant change - reversing it is safe and immediate, no data
-- implications either direction.
--
-- Consequence of running this: the account-deletion flow fails again at
-- journal_entries (the first table in the fixed order), reintroducing
-- the exact 2026-10-25 2:45pm AEDT incident this migration fixes - and,
-- per DELETE's own Postgres privilege requirement, would fail there even
-- though 20261025020000's DELETE grant remains in place.

BEGIN;

REVOKE SELECT (user_id) ON public.journal_entries FROM service_role;
REVOKE SELECT (user_id) ON public.user_intentions FROM service_role;
REVOKE SELECT (user_id) ON public.rhythms FROM service_role;
REVOKE SELECT (user_id) ON public.routine_responses FROM service_role;
REVOKE SELECT (user_id) ON public.practice_completion_events FROM service_role;
REVOKE SELECT (user_id) ON public.entitlements FROM service_role;
REVOKE SELECT (user_id) ON public.checkout_attempts FROM service_role;
REVOKE SELECT (id) ON public.profiles FROM service_role;

COMMIT;
