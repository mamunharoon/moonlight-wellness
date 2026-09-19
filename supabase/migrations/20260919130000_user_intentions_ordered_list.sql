-- Morning intentions: support one OR two selected intentions per day.
--
-- Root problem: public.user_intentions has exactly one value column
-- (`intention text NOT NULL`) and a UNIQUE(user_id) constraint (one row
-- per user, always upserted). It cannot hold an ordered pair without
-- either a second row per user (breaks the one-row upsert convention
-- every save path relies on) or a comma-joined string (explicitly not
-- wanted - a display string is not a data structure).
--
-- Fix: add `intentions jsonb` - an ordered JSON array of 1-2 distinct,
-- non-blank strings, first element Primary, second (if present)
-- Supporting. jsonb arrays preserve insertion order, so this is a real
-- ordered collection, not a set. Purely additive:
--   - `intention text NOT NULL` and UNIQUE(user_id) are completely
--     untouched. The app keeps writing intention = intentions[0] (the
--     Primary) on every save, so anything still reading the old column
--     alone keeps working exactly as before.
--   - RLS is row-level, not column-level - the existing owner-only
--     policies (user_intentions_select_own/insert_own/update_own/
--     delete_own, 20260804082844) apply to this column automatically,
--     no policy changes needed.
--   - Every existing row is backfilled to a one-item array in the same
--     transaction, before NOT NULL/CHECK are added, so no existing row
--     can ever fail the new constraint.

BEGIN;

ALTER TABLE public.user_intentions
  ADD COLUMN IF NOT EXISTS intentions jsonb;

-- Backfill: every existing single intention becomes a one-item ordered
-- array. jsonb_build_array preserves the exact existing text verbatim -
-- no trimming, casing, or wording change to a single existing value.
UPDATE public.user_intentions
  SET intentions = jsonb_build_array(intention)
  WHERE intentions IS NULL;

ALTER TABLE public.user_intentions
  ALTER COLUMN intentions SET NOT NULL,
  ALTER COLUMN intentions SET DEFAULT '[]'::jsonb;

-- Idempotent constraint add, matching this repo's existing
-- rhythms_timezone_not_blank pg_constraint-guard idiom (20260914120000) -
-- ADD CONSTRAINT has no IF NOT EXISTS clause in Postgres. Only the array
-- shape/length is enforced here (Postgres CHECK constraints cannot
-- contain a subquery, which ruling out a blank-element scan) - exactly
-- matching this table's own existing rigor level: the original
-- `intention text NOT NULL` column has never had a blank-text CHECK
-- either. Blank/duplicate rejection stays an app-level rule (see
-- src/lib/intentionSelection.js), same as it always has been for the
-- single-value column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_intentions_intentions_shape'
      AND conrelid = 'public.user_intentions'::regclass
  ) THEN
    ALTER TABLE public.user_intentions
      ADD CONSTRAINT user_intentions_intentions_shape
      CHECK (
        jsonb_typeof(intentions) = 'array'
        AND jsonb_array_length(intentions) BETWEEN 1 AND 2
      );
  END IF;
END $$;

COMMENT ON COLUMN public.user_intentions.intentions IS
  'Ordered JSON array of 1-2 distinct, non-blank intention strings for the day. First element is Primary, second (if present) is Supporting. The sibling intention column is kept in sync as intentions[0] (the Primary) for backward compatibility with anything still reading it alone - see this migration''s header comment.';

COMMIT;
