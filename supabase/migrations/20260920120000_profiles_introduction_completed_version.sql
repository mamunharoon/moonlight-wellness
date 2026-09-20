-- First-use WakeWise Introduction — per-user completion tracking.
--
-- Root problem: no server-side field exists to distinguish a user who has
-- completed or skipped the first-use Introduction screen (Introduction.jsx)
-- from one who hasn't, across devices/reinstalls. A version integer
-- (rather than a completed_at timestamp, an earlier draft of this
-- migration) is used so a FUTURE revised introduction can be re-shown to
-- everyone by bumping CURRENT_INTRODUCTION_VERSION
-- (src/lib/introductionVersion.js) alone, without a second column or a
-- second migration.
--
-- Purely additive:
--   - Every other column on public.profiles is untouched.
--   - RLS is row-level, not column-level — the existing owner-only
--     policies (profiles_select_own/insert_own/update_own, 20260804082844)
--     apply to this column automatically; no policy changes needed.
--   - DEFAULT 0 applies to every existing row as part of this single
--     ALTER TABLE (a scalar constant default needs no per-row backfill
--     UPDATE, unlike 20260919130000's jsonb column). Existing users —
--     including current beta testers — therefore start at 0, the exact
--     same starting point as a brand-new signup. With
--     CURRENT_INTRODUCTION_VERSION = 1 in the application, every existing
--     user sees this Introduction once, exactly like a new user — this is
--     the deliberate product decision for this rollout, not an oversight.
--
-- Application wiring (see the accompanying implementation report for the
-- full design — not yet connected pending this migration's approval):
--   - src/lib/introductionVersion.js defines CURRENT_INTRODUCTION_VERSION
--     as the single canonical source of truth.
--   - Introduction.jsx is shown automatically only when
--     profile.introduction_completed_version < CURRENT_INTRODUCTION_VERSION,
--     checked once at the moment of a successful sign-in/sign-up — never
--     as a persistent per-route gate, so it can never trap a user in a
--     redirect loop by construction.
--   - Start with WakeWise / Skip for now both persist
--     introduction_completed_version = CURRENT_INTRODUCTION_VERSION before
--     navigating Home. Opening Introduction from Profile's "About
--     WakeWise" (replay) never reads or writes this column.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS introduction_completed_version integer NOT NULL DEFAULT 0;

-- Idempotent constraint add, matching this repo's existing
-- rhythms_timezone_not_blank / user_intentions_intentions_shape
-- pg_constraint-guard idiom (ALTER TABLE ... ADD CONSTRAINT has no IF NOT
-- EXISTS clause in Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_introduction_completed_version_nonnegative'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_introduction_completed_version_nonnegative
      CHECK (introduction_completed_version >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.introduction_completed_version IS
  'Highest first-use Introduction version (see src/lib/introductionVersion.js CURRENT_INTRODUCTION_VERSION) this user has completed or explicitly skipped. 0 for every user who has never completed/skipped it, including every pre-existing account at the time this column was added. The Introduction is shown automatically whenever this value is less than the current version, and is only ever updated to the current version by an explicit Start/Skip action on that screen — never merely by opening it, and never by replaying it from Profile.';

COMMIT;
