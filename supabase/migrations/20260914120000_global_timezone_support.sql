-- Global timezone correctness: store an IANA timezone identifier alongside
-- each user's wake/bed times.
--
-- Scope:
--   1. Additively add public.rhythms.timezone (nullable text).
--
-- Why nullable, no default, no backfill value:
--   wake_up_time/bedtime are already stored as local wall-clock HH:MM
--   strings (never UTC-shifted) - the only missing piece is which IANA
--   zone those wall-clock values are relative to. Existing rows predate
--   this column and have no reliable way to know their owner's real
--   timezone from server-side data alone (Vercel/Supabase server time is
--   explicitly NOT a proxy for user location - that is the exact mistake
--   this feature exists to avoid). Backfilling with a guessed default
--   (e.g. 'Australia/Melbourne') would silently mis-schedule every
--   existing non-Melbourne user's reminders. Leaving existing rows NULL
--   and requiring one-time client-side confirmation (device-detected
--   timezone, shown for explicit accept/change) is the safe path - see
--   src/lib/timezone.js and AlarmContext.jsx's timezone-confirmation
--   banner, which is what actually "backfills" this column, per-user,
--   with an affirmative choice rather than a guess.
--
-- A NULL timezone does not break existing functionality: the client
-- transparently falls back to the device-detected timezone for any
-- calculation while a row is unset, exactly as if the user had already
-- confirmed that value - the NULL only gates whether the one-time
-- confirmation banner shows, never day/reminder math itself.
--
-- No RLS changes needed: rhythms' existing owner-only SELECT/INSERT/
-- UPDATE/DELETE policies (see 20260804082844_stage2b_profiles_persistence_rls.sql)
-- are row-level, not column-level, so this new column is automatically
-- covered by the same "(select auth.uid()) = user_id" policies already in
-- place - this migration adds no new policies.
--
-- This migration is additive and reversible. See the paired rollback file:
--   supabase/migrations/20260914120000_global_timezone_support_rollback.sql

BEGIN;

ALTER TABLE public.rhythms
  ADD COLUMN IF NOT EXISTS timezone text;

-- Loose sanity check only (Postgres has no built-in IANA validator) - the
-- real validation is Intl.DateTimeFormat(undefined, { timeZone }) on the
-- client (src/lib/timezone.js's isValidTimezone) before any write. This
-- constraint just rejects the empty-string and pure-whitespace cases that
-- would otherwise slip past the app and silently break every downstream
-- Intl.DateTimeFormat({ timeZone }) call for that row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rhythms_timezone_not_blank'
      AND conrelid = 'public.rhythms'::regclass
  ) THEN
    ALTER TABLE public.rhythms
      ADD CONSTRAINT rhythms_timezone_not_blank
      CHECK (timezone IS NULL OR length(btrim(timezone)) > 0);
  END IF;
END $$;

COMMIT;
