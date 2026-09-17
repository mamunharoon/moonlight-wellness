-- Full Security Review — harden public.profiles grants + remove
-- unnecessary anon grants on service-role-only tables.
--
-- APPLIED. Confirmed present in the live migration ledger for project
-- kvdxuhyndevrfvsalgnx (`supabase migration list --linked`, re-checked
-- 2026-09-17), and live-behaviourally-verified per commit c0b89ac
-- ("docs: correct register — profiles privilege-escalation migration
-- confirmed live and enforced", 2026-09-16) — this comment originally
-- read "PROPOSED — NOT YET APPLIED. Awaiting explicit owner approval,"
-- which is stale. Note: that same commit's message records that an
-- earlier task deliberately left this exact header untouched, per that
-- task's own explicit instruction not to modify it — this correction
-- reflects this later task's own explicit instruction to fix it instead.
-- Only this comment was corrected; no executable SQL in this file was
-- changed.
--
-- ============================================================================
-- PART 1 — public.profiles: close a confirmed privilege-escalation path
-- ============================================================================
--
-- CONFIRMED LIVE (2026-09, tested inside a transaction that was
-- unconditionally rolled back — nothing persisted):
--   - `authenticated` currently holds unrestricted table-level INSERT and
--     UPDATE on public.profiles (Supabase's platform default grant).
--   - profiles_update_own's RLS policy is correctly row-scoped
--     (`auth.uid() = id`), but RLS is row-level, not column-level — it
--     does not stop a user from writing to columns on their OWN row that
--     the application itself never intends them to set.
--   - A live test as an ordinary authenticated user successfully set
--     their own is_admin = true and beta_access = true via a direct
--     `UPDATE public.profiles ... WHERE id = auth.uid()`.
--   - A second live test successfully INSERTed a brand-new profile row
--     with is_admin = true and beta_access = true from a fresh id with
--     no existing row (i.e. reachable at the very first client-side
--     write, before AuthContext.jsx's own upsert would ever fire) — the
--     INSERT path is an equally real, arguably easier escalation route,
--     not merely a UPDATE-only issue.
--   - is_admin = true is not cosmetic: it makes public.is_admin()
--     (SECURITY DEFINER, owned by `postgres`) return true for that user,
--     which is the sole gate on admin_list_users(), admin_list_
--     subscriptions(), admin_set_beta_access(), and admin_set_
--     subscription_status() — i.e. this bug lets any registered user
--     forge the server-side admin check itself, not just a client flag.
--
-- Verified application usage this fix is scoped against: the ONLY place
-- any client code writes to public.profiles is AuthContext.jsx's own
-- upsert — `{ id, first_name, last_name }`, with `ignoreDuplicates:
-- true` (so it is INSERT-only in practice; no code path currently
-- performs an UPDATE on profiles at all). No UI anywhere sets
-- avatar_url, but it is included in the UPDATE grant below as a
-- reasonable "user-editable identity field" per the same standard the
-- INSERT columns were verified against, since allowing it costs nothing
-- security-wise and avoids a second grant change if a future avatar
-- feature is built. `name`, `streak_days`, `vibe_points`, `avg_sleep`
-- are legacy/unimplemented columns per this project's own Stage 2B
-- migration comment ("Stage 2B does not implement streaks, vibe points,
-- or any other fake/gamified metric") — deliberately excluded.
--
-- Fix: REVOKE the unrestricted table-level INSERT/UPDATE, then GRANT
-- back only on the exact columns the application legitimately writes.
-- This is a column-level ACL, not an RLS policy change — every existing
-- RLS policy on profiles (profiles_select_own, profiles_insert_own,
-- profiles_update_own) is left completely untouched by this migration.
--
-- Columns authenticated may still write, and why:
--   INSERT: id, first_name, last_name   — exactly AuthContext.jsx's own upsert
--   UPDATE: first_name, last_name, avatar_url — user-identity fields only
--
-- Columns authenticated may never write directly (must go through the
-- SECURITY DEFINER RPCs, or are system-managed):
--   id            — never update your own primary key
--   is_admin      — the actual vulnerability this migration closes
--   beta_access   — same class of flag, same fix
--   created_at, updated_at — system-managed timestamps
--   name, streak_days, vibe_points, avg_sleep — legacy/unimplemented
--
-- Why the existing admin RPCs are unaffected: admin_set_beta_access()
-- and admin_set_subscription_status() are SECURITY DEFINER functions
-- OWNED BY `postgres` (confirmed live via pg_proc.proowner) — they
-- execute with the function owner's privileges, not the calling
-- `authenticated` role's privileges. Table/column grants to
-- `authenticated` are irrelevant to what a SECURITY DEFINER function's
-- own body can do; this migration does not touch those functions or
-- their ownership at all.
--
-- ============================================================================
-- PART 2 — remove anon's unnecessary grants on three service-role-only
-- tables (subscriptions, account_deletion_requests, stripe_webhook_events)
-- ============================================================================
--
-- `anon` (unauthenticated) currently holds full table-level SELECT/
-- INSERT/UPDATE/DELETE on these three tables — the same Supabase
-- platform default. Confirmed live that this is fully inert today: zero
-- RLS policies grant `anon` anything on any of the three (subscriptions
-- and account_deletion_requests each have exactly one policy, owner-
-- SELECT for `authenticated` only; stripe_webhook_events has zero
-- policies for any non-service-role caller). This is a defense-in-depth
-- fix, not a fix for an active exploit: it removes a silent single-
-- point-of-failure where a future migration that forgot to enable RLS
-- (or dropped a policy) on one of these three specific tables would
-- otherwise fall back to this broad anon grant and expose the table to
-- every unauthenticated visitor with no login at all. `authenticated`'s
-- own grants on these three tables are NOT touched by this migration —
-- only `anon`'s.
--
-- Confirmed unaffected by this part:
--   - service-role Edge Functions (create-checkout-session,
--     create-portal-session, stripe-webhook, request-account-deletion,
--     cancel-account-deletion) all use createSupabaseAdminClient(),
--     which authenticates as `service_role` and bypasses RLS and grants
--     entirely, by Supabase's own service-role design — not affected by
--     any REVOKE targeting `anon`.
--   - `authenticated` users' own SELECT-own access to their
--     subscriptions / account_deletion_requests rows is untouched
--     (their grant and policy are both left exactly as they are).
--
-- This migration is additive-safe and fully reversible — see the paired
-- rollback file. No RLS policy, no table structure, no existing data is
-- changed by any part of this migration.

BEGIN;

-- ---- Part 1: profiles ----

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;

GRANT INSERT (id, first_name, last_name) ON public.profiles TO authenticated;
GRANT UPDATE (first_name, last_name, avatar_url) ON public.profiles TO authenticated;

-- ---- Part 2: anon grants on service-role-only tables ----

REVOKE ALL ON public.subscriptions FROM anon;
REVOKE ALL ON public.account_deletion_requests FROM anon;
REVOKE ALL ON public.stripe_webhook_events FROM anon;

COMMIT;
