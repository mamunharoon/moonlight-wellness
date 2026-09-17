-- WakeWise — Initial baseline schema (reconstructed, corrected).
--
-- *** CORRECTED 2026-09-17. The earlier reconstructed version of this
-- untracked file was structurally wrong — it guessed uuid
-- primary keys with gen_random_uuid() defaults for rhythms/
-- journal_entries/user_intentions, invented a rhythms.created_at column
-- that does not exist, omitted journal_entries.title (which does exist),
-- and guessed several defaults/nullability flags incorrectly. Every
-- table definition below was rewritten from a manual, column-by-column
-- inspection of live DEV (kvdxuhyndevrfvsalgnx) performed on 2026-09-17,
-- covering: column list, order, types, nullability, and defaults;
-- identity/generation status; primary key, foreign key, unique and check
-- constraints; indexes; RLS enabled/forced state and policies; triggers;
-- and table-level grants. There is no remaining guesswork in the four
-- CREATE TABLE statements below — every column, constraint, and default
-- matches what a human confirmed live on DEV that day. See §6 below for
-- the one place a genuine, disclosed limitation remains (IF NOT EXISTS
-- cannot verify shape, only presence). ***
--
-- Why this file exists at all: `public.profiles`, `public.rhythms`,
-- `public.journal_entries`, and `public.user_intentions` are only ever
-- ALTERed — never CREATEd — anywhere else in supabase/migrations/. The
-- first tracked migration, 20260804082844_stage2b_profiles_persistence_rls.sql,
-- already assumes all four tables exist. No other migration file in
-- this repo creates them — they were created by hand or via the
-- Supabase Dashboard before this repo's migration workflow began. This
-- file reconstructs that missing baseline so the full chain can be
-- replayed from empty (e.g. against PROD, wqpszprbuqdjcfmdqdlv) and
-- produce the same starting point the other 11 migrations already
-- assume.
--
-- Baseline vs. later migrations — every column/constraint below is
-- baseline-only. Everything the 11 tracked migrations add is
-- deliberately absent here and left entirely to them:
--   profiles:          first_name, last_name, avatar_url,
--                       created_at, is_admin, beta_access
--                       (20260804082844, 20260808120000)
--   rhythms:            timezone, rhythms_user_id_key,
--                       rhythms_timezone_not_blank
--                       (20260804082844, 20260914120000)
--   journal_entries:    client_id, journal_entries_user_id_client_id_key
--                       (20260804190000)
--   user_intentions:    user_intentions_user_id_key (20260804082844)
--   all RLS *policies* on all four tables (20260804082844 creates every
--   one of them by name — DROP POLICY IF EXISTS then CREATE — so this
--   file enables RLS only, defining zero policies, leaving their exact
--   definitions entirely to that migration).
-- Every later tracked migration (20260804082844 through 20260916120000)
-- was re-read against this corrected baseline to confirm none of them
-- duplicate or conflict with anything created here — see this task's
-- final report for the confirmation.
--
-- Idempotency, precisely stated: the CREATE EXTENSION and all four
-- CREATE TABLE statements below use IF NOT EXISTS, so re-running those
-- specific statements against a project — such as live DEV — where the
-- extension/tables already exist is a no-op, not an error. The four
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY statements do NOT use IF
-- NOT EXISTS (Postgres has no such clause for ENABLE ROW LEVEL
-- SECURITY), but enabling RLS that is already enabled is itself
-- inherently safe to repeat — it is not a guarded statement, it simply
-- has no effect the second time.
--
-- None of this — IF NOT EXISTS or the inherently-repeatable RLS
-- statements — verifies or repairs an incompatible pre-existing table.
-- IF NOT EXISTS only checks presence, not shape: running this against a
-- project whose profiles/rhythms/journal_entries/user_intentions
-- already exist in some OTHER, incompatible shape (wrong column types,
-- missing columns) will silently skip table creation and leave that
-- incompatibility in place uncorrected and unreported. This file does
-- not, and cannot, verify or repair an existing incompatible table — it
-- only creates the tables when they are genuinely absent, exactly as
-- they are defined below.
--
-- Reversible: see the paired rollback file.

BEGIN;

-- ============================================================================
-- 0. Extension. Not required by any column in THIS file — every id below
--    is either a plain `uuid` column with no default (profiles.id) or a
--    bigint identity column (rhythms/journal_entries/user_intentions),
--    never gen_random_uuid(). It is provisioned here anyway because this
--    is the earliest migration in the entire chain, and three later
--    tracked migrations (20260807210000_sprint2_subscriptions_foundation.sql,
--    20260915100000_account_deletion_requests.sql,
--    20260916100000_apple_subscription_entitlements_foundation.sql) use
--    gen_random_uuid() as a column default and none of them provisions
--    the extension themselves. Using Supabase's documented safe pattern
--    (dedicated `extensions` schema, IF NOT EXISTS, never `public`).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- 1. public.profiles — confirmed live 2026-09-17. id is a plain uuid
--    column (no default; it is populated explicitly, equal to the
--    corresponding auth.users id — this project's established
--    "profiles.id = the user's own auth id" pattern, which every later
--    migration's `WHERE p.id = auth.uid()` assumes) and is both the
--    primary key and the foreign key target. name/streak_days/
--    vibe_points/avg_sleep/updated_at are all nullable, matching live
--    DEV exactly — streak_days/vibe_points/avg_sleep are legacy,
--    unimplemented gamification fields (per 20260804082844's own header:
--    "Stage 2B does not implement streaks, vibe points, or any other
--    fake/gamified metric") that this project has never removed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  streak_days integer DEFAULT 0,
  vibe_points integer DEFAULT 0,
  avg_sleep numeric DEFAULT 0.0,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 2. public.rhythms — confirmed live 2026-09-17. id is a bigint identity
--    column (GENERATED ALWAYS AS IDENTITY), not uuid — this table does
--    not use gen_random_uuid() at all. wake_up_time/bedtime default to
--    '07:30'/'22:00' respectively (both nullable) so a freshly-created
--    row already has sane values before a user has set their own.
--    updated_at is nullable with a UTC-now() default. There is no
--    created_at column on this table — confirmed absent live; do not
--    add one.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rhythms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wake_up_time text DEFAULT '07:30'::text,
  bedtime text DEFAULT '22:00'::text,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. public.journal_entries — confirmed live 2026-09-17. id is a bigint
--    identity column, not uuid. created_at is NOT NULL with a UTC-now()
--    default (every insert path in the app either supplies its own
--    timestamp or relies on this default). title exists (nullable) even
--    though no current client code reads or writes it — a genuine, if
--    unused, live column, confirmed present rather than assumed absent.
--
--    *** FLAG FOR PRODUCT REVIEW (not a cutover blocker): title is dead
--    as far as this repo's own code is concerned — a repo-wide search
--    found no read or write of journal_entries.title anywhere in src/
--    or supabase/functions/. It is included here, unchanged, because it
--    genuinely exists on live DEV, and this baseline's job is DEV/PROD
--    schema parity, not judging which live columns look unused. This is
--    a future, post-baseline product-review item, not something to
--    resolve before or block PROD cutover on: confirm with product/eng,
--    at whatever later point suits them, whether it is truly unused (a
--    candidate to leave as harmless dead weight, or drop in a future
--    migration) or whether some other caller this repo doesn't cover —
--    an admin tool, a removed code path, a manual dashboard edit —
--    still depends on it. This baseline migration includes it either
--    way; removing a live column without that confirmation, or as a
--    side effect of an unrelated baseline-correction task, is not this
--    file's call to make. ***
--
--    body is NOT NULL, matching every insert path in the app.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  title text,
  body text NOT NULL
);

-- ============================================================================
-- 4. public.user_intentions — confirmed live 2026-09-17. id is a bigint
--    identity column, not uuid. intention is NOT NULL (no default).
--    created_at is NOT NULL with a UTC-now() default. There is no
--    updated_at column on this table — confirmed absent live; do not add
--    one.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_intentions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intention text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 5. RLS — enabled, zero policies, not forced. Confirmed live: RLS is
--    enabled and NOT forced on all four tables today, and the live
--    owner-only policies were created by the later Stage 2B migration
--    (20260804082844), not by anything predating it. That migration
--    remains the sole source of truth for every policy's exact
--    definition; this file only establishes the fail-closed starting
--    state (RLS on, no policy yet, so zero rows are visible to any role
--    until 20260804082844 runs).
-- ============================================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rhythms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_intentions  ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Indexes, triggers, grants — intentionally none beyond what the four
--    CREATE TABLE statements above already produce (each table's own
--    primary-key index; bigint identity columns need no separate
--    sequence-backed index). Confirmed live: no custom trigger exists on
--    any of the four tables, and no independent/custom index exists
--    beyond what primary-key and later-added unique constraints already
--    provide. No explicit GRANT/REVOKE is issued here, matching every
--    other from-scratch table in this repo (subscriptions,
--    account_deletion_requests, entitlements, etc.) — Supabase's own
--    platform-default privileges apply to a newly created public-schema
--    table automatically. The later hardening migration
--    (20260915160000_harden_profiles_and_anon_grants.sql), which revokes
--    `authenticated`'s table-level INSERT/UPDATE on profiles and grants
--    back only specific columns, remains the sole source of truth for
--    that narrower grant state — this file does not anticipate or
--    duplicate it.
-- ============================================================================

COMMIT;
