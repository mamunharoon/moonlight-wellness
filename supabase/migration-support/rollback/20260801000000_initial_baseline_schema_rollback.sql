-- Rollback for 20260801000000_initial_baseline_schema.sql
--
-- *** WARNING — DESTRUCTIVE. DO NOT RUN. ***
-- The explicit DROP targets below are only these four tables:
-- public.profiles, public.rhythms, public.journal_entries,
-- public.user_intentions. Nothing else is named as a target.
--
-- However, CASCADE is not scoped to "just these four tables" — it
-- follows every catalog dependency it finds. CASCADE can also remove
-- any dependent constraints, views, policies, functions, or other
-- objects that turn out to depend on one of these four tables (for
-- example: every RLS policy defined on them, per this project's own
-- established convention of naming policies after the table they
-- protect; any function, view, or constraint that turns out to have a
-- catalog-level dependency on one of them, whether or not this comment
-- enumerates it by name). This is genuinely destructive and its full
-- blast radius cannot be fully enumerated in advance from this comment
-- alone — that is exactly why this file must not be run.
--
-- subscriptions, stripe_webhook_events, account_deletion_requests,
-- entitlements, provider_subscriptions, and provider_events are not
-- explicit DROP targets of this file and are not expected to depend on
-- these four tables (each of the other tables' own foreign keys point
-- at auth.users, not at profiles/rhythms/journal_entries/
-- user_intentions) — but "not an explicit target" is not the same
-- guarantee as "cannot be affected"; CASCADE, not this comment, is what
-- actually determines what gets removed at execution time.
--
-- This is catastrophic on any project holding real data, remains
-- destructive regardless of how narrow or broad its actual blast radius
-- turns out to be, and must not be run on DEV or PROD, or as part of
-- this or any other local-only review task.
--
-- Only ever run this:
--   1. On a project where every one of the 11 tracked migrations that
--      build on this baseline (20260804082844 through 20260916120000)
--      has ALREADY been rolled back individually, in reverse order, via
--      their own paired rollback files in this same directory — so this
--      file only ever needs to undo what 20260801000000 itself added.
--   2. On a project confirmed to hold zero real rows in all four tables
--      (re-run this baseline's own validate script, its row-count query,
--      first).
--   3. Never against live DEV (kvdxuhyndevrfvsalgnx) or any project with
--      real users — this baseline was reconstructed for PROD
--      (wqpszprbuqdjcfmdqdlv), which is currently empty; DEV's own
--      version of these four tables predates this repo's migration
--      history entirely and this file was never derived from a live
--      "before" snapshot of it (see the forward migration's own header).
--
-- The pgcrypto extension is deliberately NOT dropped here even though
-- the forward migration provisions it: none of these four tables' own
-- columns actually use gen_random_uuid() (rhythms/journal_entries/
-- user_intentions use a bigint identity column instead, and profiles.id
-- has no default at all), but three OTHER tables elsewhere in this
-- schema (subscriptions, account_deletion_requests, entitlements/
-- provider_subscriptions/provider_events) do depend on it. Dropping the
-- extension here would reach outside this file's own blast radius and
-- could break those unrelated tables. Leaving a CREATE EXTENSION IF NOT
-- EXISTS in place in the forward migration is inert and safe either way.

BEGIN;

DROP TABLE IF EXISTS public.user_intentions CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.rhythms CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

COMMIT;
