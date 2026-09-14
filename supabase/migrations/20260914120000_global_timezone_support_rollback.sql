-- Rollback for 20260914120000_global_timezone_support.sql
--
-- *** WARNING ***
-- The final section of this rollback drops public.rhythms.timezone.
-- Dropping a column permanently destroys every value stored in it - every
-- user's confirmed/selected IANA timezone would be lost, and every
-- existing user would fall back to first-use confirmation again (not
-- silently wrong, but a real, avoidable regression to their experience).
-- Re-run the row-count / non-null-count query from the validation file
-- first and confirm with the product owner before running the final
-- ALTER TABLE ... DROP COLUMN section.
--
-- The constraint-drop section above the column-drop section is safe to
-- run at any time - it only removes a data-shape guarantee, not data.

BEGIN;

-- ============================================================================
-- 1. Drop the sanity-check constraint (safe - removes a guarantee, not data)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rhythms_timezone_not_blank'
      AND conrelid = 'public.rhythms'::regclass
  ) THEN
    ALTER TABLE public.rhythms DROP CONSTRAINT rhythms_timezone_not_blank;
  END IF;
END $$;

-- ============================================================================
-- 2. *** DESTRUCTIVE *** - drop the timezone column.
--    Confirm the non-null count from the validation file and product-owner
--    approval before running this section. Comment out or delete this
--    section entirely if you only want to roll back the constraint above
--    and keep the timezone column and its data.
-- ============================================================================

ALTER TABLE public.rhythms
  DROP COLUMN IF EXISTS timezone;

COMMIT;
