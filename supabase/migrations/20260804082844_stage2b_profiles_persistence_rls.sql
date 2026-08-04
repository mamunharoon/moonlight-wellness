-- Stage 2B: profiles persistence + RLS for profiles, rhythms, journal_entries, user_intentions
--
-- Scope:
--   1. Additively extend public.profiles with auth-derived identity columns.
--   2. Add owner-uniqueness constraints to rhythms and user_intentions (idempotent,
--      via pg_constraint inspection rather than ADD CONSTRAINT IF NOT EXISTS).
--   3. Confirm RLS is enabled on all four tables.
--   4. Drop and recreate exactly the named Stage 2B owner-only policies below.
--
-- Anonymous-session note (see also rollback file and validation file):
--   - Every policy below targets TO authenticated only; this excludes the anon
--     database role entirely.
--   - A Supabase anonymous session (auth.signInAnonymously) still authenticates
--     as the `authenticated` Postgres role, so `(select auth.uid()) = user_id`
--     alone cannot distinguish an anonymous session from a permanent account.
--     The ownership check still prevents any cross-user access -- an anonymous
--     session can only ever touch a row matching its own auth.uid() -- but it
--     could in principle write a throwaway row for itself.
--   - This migration deliberately does NOT add an auth.jwt()->>'is_anonymous'
--     condition, because that claim has not been verified against this
--     project's current GoTrue/JWT configuration. Do not add it until it has
--     been confirmed (e.g. `select auth.jwt();` while signed in anonymously).
--   - Until then, application logic (AlarmContext's `userId = user && !user.is_anonymous
--     ? user.id : null` pattern) remains the actual control preventing anonymous
--     sessions from reaching these tables at all, per Stage 2A/2B architecture.
--
-- This migration is additive and reversible. See the paired rollback file:
--   supabase/migrations/20260804082844_stage2b_profiles_persistence_rls_rollback.sql

BEGIN;

-- ============================================================================
-- 1. Extend public.profiles additively
--    Existing columns (name, streak_days, vibe_points, avg_sleep, updated_at)
--    are left untouched, unrenamed, and unpopulated -- Stage 2B does not
--    implement streaks, vibe points, or any other fake/gamified metric.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ============================================================================
-- 2. Owner-uniqueness constraints (idempotent via pg_constraint inspection)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rhythms_user_id_key'
      AND conrelid = 'public.rhythms'::regclass
  ) THEN
    ALTER TABLE public.rhythms
      ADD CONSTRAINT rhythms_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_intentions_user_id_key'
      AND conrelid = 'public.user_intentions'::regclass
  ) THEN
    ALTER TABLE public.user_intentions
      ADD CONSTRAINT user_intentions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ============================================================================
-- 3. Confirm RLS remains enabled on all four tables
--    (idempotent -- no-op if already enabled, which it currently is for all four)
-- ============================================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rhythms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_intentions  ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Drop and recreate ONLY the named Stage 2B policies below.
--    No USING (true). No `public` or `anon` role. No service-role key here.
--    profiles ownership:    (select auth.uid()) = id
--    other tables ownership: (select auth.uid()) = user_id
-- ============================================================================

-- ---------- profiles: SELECT, INSERT, UPDATE only (no DELETE policy) --------

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ---------- rhythms: SELECT, INSERT, UPDATE, DELETE --------------------------

DROP POLICY IF EXISTS "rhythms_select_own" ON public.rhythms;
CREATE POLICY "rhythms_select_own" ON public.rhythms
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "rhythms_insert_own" ON public.rhythms;
CREATE POLICY "rhythms_insert_own" ON public.rhythms
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "rhythms_update_own" ON public.rhythms;
CREATE POLICY "rhythms_update_own" ON public.rhythms
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "rhythms_delete_own" ON public.rhythms;
CREATE POLICY "rhythms_delete_own" ON public.rhythms
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---------- journal_entries: SELECT, INSERT, UPDATE, DELETE ------------------

DROP POLICY IF EXISTS "journal_entries_select_own" ON public.journal_entries;
CREATE POLICY "journal_entries_select_own" ON public.journal_entries
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "journal_entries_insert_own" ON public.journal_entries;
CREATE POLICY "journal_entries_insert_own" ON public.journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "journal_entries_update_own" ON public.journal_entries;
CREATE POLICY "journal_entries_update_own" ON public.journal_entries
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "journal_entries_delete_own" ON public.journal_entries;
CREATE POLICY "journal_entries_delete_own" ON public.journal_entries
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---------- user_intentions: SELECT, INSERT, UPDATE, DELETE ------------------

DROP POLICY IF EXISTS "user_intentions_select_own" ON public.user_intentions;
CREATE POLICY "user_intentions_select_own" ON public.user_intentions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_intentions_insert_own" ON public.user_intentions;
CREATE POLICY "user_intentions_insert_own" ON public.user_intentions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_intentions_update_own" ON public.user_intentions;
CREATE POLICY "user_intentions_update_own" ON public.user_intentions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_intentions_delete_own" ON public.user_intentions;
CREATE POLICY "user_intentions_delete_own" ON public.user_intentions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 5. Realtime: intentionally untouched.
--    This migration does not add any of these tables to any Realtime
--    publication. No action is the correct action here.
-- ============================================================================

COMMIT;
