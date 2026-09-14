-- Stage 2B Group 5.1 rollback for 20260804190000_stage2b_journal_client_id_dedup.sql
--
-- *** WARNING ***
-- The final section of this rollback drops the client_id column added to
-- public.journal_entries. Dropping a column permanently destroys every
-- value stored in it. At the time this migration was written, no row in
-- journal_entries has a populated client_id (the column has just been
-- added and no migration code has run yet), so running this rollback
-- immediately after the forward migration is safe. If a guest-to-account
-- journal migration has since run and populated client_id values, running
-- the column-drop section below WILL PERMANENTLY DESTROY that idempotency
-- data (the journal entries' body/created_at/user_id themselves are NOT
-- affected -- only the client_id linkage used to prevent duplicate
-- migration is lost) with no recovery path other than a database backup
-- restore or re-deriving client_id from the original guest device's
-- localStorage, if still available.
--
-- Re-run query 4 from the validation file first
-- (SELECT id, user_id, client_id FROM public.journal_entries WHERE
-- client_id IS NOT NULL;) and confirm with the product owner before running
-- the final ALTER TABLE ... DROP COLUMN section.
--
-- The constraint-drop section above the column-drop section is safe to run
-- at any time -- it only removes a uniqueness guarantee, not data.

BEGIN;

-- ============================================================================
-- 1. Drop the unique constraint (safe -- removes a guarantee, not data)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_user_id_client_id_key'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      DROP CONSTRAINT journal_entries_user_id_client_id_key;
  END IF;
END $$;

-- ============================================================================
-- 2. *** DESTRUCTIVE *** -- drop the client_id column.
--    Confirm no populated client_id values exist (or accept their loss) and
--    get product-owner approval before running this section. Comment out or
--    delete this section entirely if you only want to roll back the
--    constraint above and keep the client_id column.
-- ============================================================================

ALTER TABLE public.journal_entries
  DROP COLUMN IF EXISTS client_id;

COMMIT;
