-- Phase 2B DEV activation — Apple RPC overload cleanup.
--
-- ROOT CAUSE: 20260929120000_revenuecat_google_entitlement_support.sql
-- re-defines public.apply_verified_apple_subscription_event with one
-- additional parameter (p_verification_source, with a DEFAULT). Postgres
-- resolves `CREATE OR REPLACE FUNCTION` by exact signature (argument
-- types/count) — changing the parameter list does NOT replace the
-- existing 12-argument function, it creates a SECOND, separate 13-argument
-- OVERLOAD alongside it. This was not caught during that migration's own
-- review (which correctly reasoned about the function's SQL body but not
-- about Postgres's own CREATE OR REPLACE resolution rules) and was only
-- discovered by inspecting pg_proc directly after applying it to DEV.
--
-- WHY THIS MATTERED: the already-deployed apple-server-notifications Edge
-- Function calls this RPC via supabase-js's .rpc(), passing exactly the
-- original 12 named parameters (see
-- supabase/functions/apple-server-notifications/index.ts) — it never
-- passes p_verification_source. With BOTH overloads present, Postgres/
-- PostgREST resolve an exact 12-argument match to the OLD, unfixed
-- 12-argument function in preference to the 13-argument one (which would
-- only be reached via the DEFAULT), silently defeating
-- 20260929120000's own actual fix (the entitlements recompute CTE that
-- also unions a user's 'google' provider_subscriptions row) for every
-- real Apple notification, without any error ever surfacing.
--
-- FIX: drop the stale 12-argument overload so only the 13-argument
-- (fixed) function remains. Existing callers that never pass
-- p_verification_source are unaffected in every observable way — the
-- parameter's DEFAULT NULL applies exactly as if they were still calling
-- the old function — but now the same call also gets the Google-row-aware
-- recompute.
--
-- APPLIED AND VERIFIED (2026-09-30, Phase 2B DEV activation): this exact
-- DROP FUNCTION statement was already run directly against the linked DEV
-- project (kvdxuhyndevrfvsalgnx) ahead of this file's creation (an ad hoc
-- `supabase db query` statement, ordering constrained by when the bug was
-- found relative to this task's own write-access windows). This
-- migration file exists so a FRESH database (which creates the 12-arg
-- function via 20260916120000, then the 13-arg overload via
-- 20260929120000) reaches the exact same single-13-arg-function state
-- DEV was independently verified to have — never a "trust me, DEV already
-- has it" gap in the tracked schema history. Re-running this file against
-- DEV is a safe no-op (`IF EXISTS`) — confirmed by re-applying it there
-- as part of this same verification pass. After applying, DEV was
-- re-verified end-to-end: a synthetic, disposable test account (never a
-- real subscriber) was used to call the RPC with the EXACT 12 named
-- arguments apple-server-notifications sends, confirmed it resolves and
-- returns (applied: true, reason: 'applied'), confirmed the resulting
-- entitlements row computed correctly, then fully deleted (zero residual
-- rows, real Stripe/Apple data on DEV confirmed unchanged throughout).
--
-- Does not touch the 13-argument function, its grants, or any other
-- object — additive removal of the stale overload only.
--
-- Reversible: see the paired rollback file (re-creates the original
-- 12-argument function body verbatim from 20260916120000 — note that
-- rolling back deliberately REINTRODUCES the overload-shadowing bug this
-- migration fixes; it exists for schema-history symmetry, not because
-- reverting is ever expected to be desirable).

BEGIN;

DROP FUNCTION IF EXISTS public.apply_verified_apple_subscription_event(
  uuid, text, text, text, timestamptz, boolean, text, uuid, timestamptz, jsonb, text, text
);

COMMIT;
