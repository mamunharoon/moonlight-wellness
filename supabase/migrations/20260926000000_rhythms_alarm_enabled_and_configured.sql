-- Welcome alarm-status card — real enable/disable and "ever configured"
-- signals for the foreground wake-up alarm.
--
-- Root problem: AlarmContext.jsx's `isAlarmSet` (enable/disable) has
-- never had any persistence at all - pure in-memory React state,
-- defaulting to true, with no UI anywhere in the app that ever changes
-- it. And there has never been any way to tell "this user genuinely
-- configured their wake time" apart from "this user has simply never
-- touched it yet" - rhythms.wake_up_time has always defaulted to
-- '07:30'::text (20260801000000_initial_baseline_schema.sql), so every
-- row already looks "configured" the instant it exists, whether or not
-- its owner ever actually saved anything.
--
-- Two new columns, purely additive:
--   - alarm_enabled boolean DEFAULT true - the real, persisted form of
--     isAlarmSet. Every existing AND every future row defaults to true,
--     matching this app's current actual behaviour exactly (nothing
--     anywhere has ever set it false) - no behaviour changes for anyone
--     until a real enable/disable control is used.
--   - alarm_configured boolean DEFAULT false - true once a user has
--     genuinely saved their alarm at least once through
--     AlarmContext.jsx's own updateRhythm() (the single real save entry
--     point Onboarding.jsx/TimezoneSettings.jsx already use). A brand
--     new row inserted after this migration starts at false, exactly
--     representing "never configured".
--
-- Backfill: public.rhythms has no signup trigger that pre-creates a row
-- (confirmed in 20260801000000_initial_baseline_schema.sql's own "no
-- custom trigger exists on auth.users" note) - every existing row was
-- therefore created exclusively by a genuine saveRhythm() upsert, so a
-- row's mere existence already proves its owner completed a real save at
-- least once. This is the exact same "row existence is proof of a
-- genuine past save" reasoning AlarmContext.jsx's own fetchIntention
-- already relies on for intentionsConfirmed (user_intentions). Every
-- pre-existing row is therefore backfilled to alarm_configured = true in
-- this same transaction, before the column's own DEFAULT (false) can
-- ever apply to a genuinely new signup.
--
-- RLS is row-level, not column-level - the existing owner-only policies
-- on public.rhythms apply to both new columns automatically; no policy
-- changes needed.

BEGIN;

ALTER TABLE public.rhythms
  ADD COLUMN IF NOT EXISTS alarm_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alarm_configured boolean NOT NULL DEFAULT false;

UPDATE public.rhythms
  SET alarm_configured = true
  WHERE alarm_configured = false;

COMMENT ON COLUMN public.rhythms.alarm_enabled IS
  'The real, persisted form of AlarmContext.jsx isAlarmSet - whether the foreground wake-up alarm is currently active. Defaults true for every row (matches this app''s behaviour before this column existed, when the flag was in-memory-only and never toggled). Written only by updateRhythm()''s own upsert.';

COMMENT ON COLUMN public.rhythms.alarm_configured IS
  'True once this user has genuinely saved their wake-up alarm at least once through AlarmContext.jsx updateRhythm() (Onboarding.jsx/the Welcome alarm-status card''s own setup flow). False only for a row inserted after this migration whose owner has never yet saved - drives the Welcome screen''s "Wake-up alarm not set" / "Set a wake-up alarm" state. Every row that already existed when this column was added is backfilled to true (see this migration''s own header comment for why row existence alone already proves a genuine past save).';

COMMIT;
