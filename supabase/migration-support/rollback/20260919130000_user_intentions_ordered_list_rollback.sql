-- Rollback for 20260919130000_user_intentions_ordered_list.sql
--
-- *** Run by hand only, deliberately, never via `db push`. See
-- supabase/migration-support/README.md. ***
--
-- Drops exactly the one column (and its CHECK constraint, dropped
-- automatically with the column) this migration added. The pre-existing
-- `intention text NOT NULL` column, its data, and UNIQUE(user_id) are
-- completely untouched - rolling this back only loses the Supporting
-- (second) intention for any user who had selected one after this
-- migration applied; every user's Primary intention remains exactly as
-- it was in the `intention` column.

BEGIN;

ALTER TABLE public.user_intentions
  DROP CONSTRAINT IF EXISTS user_intentions_intentions_shape;

ALTER TABLE public.user_intentions
  DROP COLUMN IF EXISTS intentions;

COMMIT;
