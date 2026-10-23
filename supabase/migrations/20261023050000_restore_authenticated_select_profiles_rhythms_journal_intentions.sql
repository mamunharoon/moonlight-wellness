-- Restore authenticated's SELECT on profiles, rhythms, journal_entries,
-- and user_intentions on production.
--
-- ROOT CAUSE (2026-10-23 production incident, traced and reproduced
-- directly against wqpszprbuqdjcfmdqdlv, not assumed): these four tables
-- were created on production by replaying
-- 20260801000000_initial_baseline_schema.sql, whose own header reasons
-- "Supabase's own platform-default privileges apply to a newly created
-- public-schema table automatically" and deliberately issues no GRANT at
-- all. That assumption only holds for a table created through Supabase's
-- Dashboard UI (which is how DEV's own four tables came to exist, before
-- this repo's migration workflow began) - a table created by a raw SQL
-- migration gets no such default. The result: service_role/postgres
-- aside, `authenticated` has never held SELECT on any of these four
-- tables on production - confirmed live via information_schema.
-- role_table_grants/column_privileges (zero rows), and reproduced
-- directly: `SET LOCAL ROLE authenticated; SELECT ... FROM
-- public.profiles ...` returns `42501: permission denied for table
-- profiles`, with Postgres's own hint naming the exact fix below.
--
-- User-visible effect confirmed for profiles specifically: a real
-- production account (signed up 2026-10-23 05:56 UTC) could never load
-- its profile ("We couldn't load your profile") or save Introduction
-- completion ("We couldn't save that") - both code paths' very first
-- step is a SELECT against profiles, which always failed before ever
-- reaching any fallback/write logic. The identical gap on rhythms/
-- journal_entries/user_intentions has not yet produced a reported
-- symptom only because no production traffic has exercised those
-- features yet - fixed together here since it is the same root cause.
--
-- SAFETY, confirmed live before writing this migration, not assumed:
--   - RLS is enabled on all four tables (relrowsecurity = true).
--   - Each table already has an owner-only SELECT policy, scoped to
--     `authenticated` only, with qual `(( SELECT auth.uid()) = <owner
--     column>)` (id for profiles, user_id for the other three) - no
--     permissive/USING(true) policy exists on any of them. This grant
--     only unlocks what RLS already correctly restricts to each row's
--     own owner; it adds no new visibility beyond that.
--   - PUBLIC/anon are untouched - this migration grants to
--     `authenticated` only, matching DEV's own grant shape exactly (not
--     copying DEV's separate, broader anon-targeted grants on some of
--     these tables, which are a pre-existing DEV-only looseness this
--     migration does not import to production).
--   - Every existing column-level INSERT/UPDATE restriction (profiles'
--     own first_name/last_name/avatar_url/introduction_completed_version
--     column grants from 20260915160000/20260920130000) is completely
--     untouched - this migration adds SELECT only, at the table level,
--     and touches no other privilege type on any table.
--
-- Reversible: see the paired rollback file.

BEGIN;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.rhythms TO authenticated;
GRANT SELECT ON public.journal_entries TO authenticated;
GRANT SELECT ON public.user_intentions TO authenticated;

COMMIT;
