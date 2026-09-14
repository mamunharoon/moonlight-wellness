-- Stage 2B rollback for 20260804082844_stage2b_profiles_persistence_rls.sql
--
-- *** WARNING ***
-- The final section of this rollback drops the four columns added to
-- public.profiles (first_name, last_name, avatar_url, created_at).
-- Dropping a column permanently destroys every value stored in it.
-- At the time this migration was written, profiles has 0 rows, so running
-- this rollback immediately after the forward migration is safe. If any
-- authenticated user has since signed up and a profile row has been created
-- or updated with real first_name/last_name/avatar_url data, running the
-- column-drop section below WILL PERMANENTLY DESTROY that data with no
-- recovery path other than a database backup restore.
--
-- Re-run the row-count query from the validation file first
-- (SELECT count(*) FROM public.profiles) and confirm with the product owner
-- before running the final ALTER TABLE ... DROP COLUMN section.
--
-- The policy and constraint sections above the column-drop section are safe
-- to run at any time -- they only remove access rules and a uniqueness
-- guarantee, not data.

BEGIN;

-- ============================================================================
-- 1. Drop the named Stage 2B policies (safe -- removes access rules, not data)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "rhythms_select_own" ON public.rhythms;
DROP POLICY IF EXISTS "rhythms_insert_own" ON public.rhythms;
DROP POLICY IF EXISTS "rhythms_update_own" ON public.rhythms;
DROP POLICY IF EXISTS "rhythms_delete_own" ON public.rhythms;

DROP POLICY IF EXISTS "journal_entries_select_own" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert_own" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_update_own" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_delete_own" ON public.journal_entries;

DROP POLICY IF EXISTS "user_intentions_select_own" ON public.user_intentions;
DROP POLICY IF EXISTS "user_intentions_insert_own" ON public.user_intentions;
DROP POLICY IF EXISTS "user_intentions_update_own" ON public.user_intentions;
DROP POLICY IF EXISTS "user_intentions_delete_own" ON public.user_intentions;

-- Note: this intentionally does NOT disable RLS on any table. RLS was
-- already enabled with zero policies before this migration existed (i.e.
-- the Data API was already fully locked out); dropping only the policies
-- above returns each table to that same pre-migration locked-out state,
-- which is the correct, safe rollback target -- not open access.

-- ============================================================================
-- 2. Drop the uniqueness constraints (safe -- removes a guarantee, not data)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rhythms_user_id_key'
      AND conrelid = 'public.rhythms'::regclass
  ) THEN
    ALTER TABLE public.rhythms DROP CONSTRAINT rhythms_user_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_intentions_user_id_key'
      AND conrelid = 'public.user_intentions'::regclass
  ) THEN
    ALTER TABLE public.user_intentions DROP CONSTRAINT user_intentions_user_id_key;
  END IF;
END $$;

-- ============================================================================
-- 3. *** DESTRUCTIVE *** -- drop the added profiles columns.
--    Confirm row count and product-owner approval before running this section.
--    Comment out or delete this section entirely if you only want to roll
--    back the policies/constraints above and keep the profiles columns.
-- ============================================================================

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS created_at;

COMMIT;
