-- Manual rollback for 20260919120000_routine_responses.sql.
--
-- NEVER auto-applied - the Supabase CLI only tracks files inside
-- supabase/migrations/ as pending migrations (see
-- supabase/migration-support/README.md). Run this by hand only, e.g.
-- `supabase db query --linked -f <this file>`, and only against the
-- linked DEV project (kvdxuhyndevrfvsalgnx / "Moonlight Wellness").
--
-- *** DESTRUCTIVE ***
-- DROP TABLE removes every stored Reflection/Gratitude response for
-- every user, permanently. This is real user journal-style content, not
-- disposable scaffolding - do not run this against DEV without deliberate
-- intent to discard that data, and never against PROD
-- (wqpszprbuqdjcfmdqdlv) under any circumstance; this table does not
-- exist there and this script must never be pointed at it.

DROP TRIGGER IF EXISTS routine_responses_set_updated_at ON public.routine_responses;
DROP FUNCTION IF EXISTS public.set_routine_responses_updated_at();
DROP TABLE IF EXISTS public.routine_responses;
