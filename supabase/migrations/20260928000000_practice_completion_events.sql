-- "Your Momentum" foundation, Phase 2 — canonical, append-only completion
-- event log for genuine activity/routine completions. This table is the
-- one durable record Phase 3+ ("factual completion insights", gentle
-- milestones, weekly Home momentum, Profile progress/recent activity) will
-- read from - nothing in THIS migration exposes any of that; it only
-- creates a safe place to start writing genuine completion facts as they
-- already happen today.
--
-- Phase 2 wires exactly three completion paths (SessionComplete.jsx's
-- Morning routine, EveningComplete.jsx's Evening routine, Meditate.jsx's
-- guided-video meditation) - see src/lib/practiceCompletions.js for the one
-- shared writer every one of them calls. Anytime Reset, standalone
-- breathing, self-guided meditation, stretching, Support/Grounding/Stress
-- Release/Panic, the full guided-media catalogue, and mood responses are
-- all deliberately NOT wired yet - this table's shape already has room for
-- them (journey/practice_type are both widenable CHECK constraints, exactly
-- like routine_responses' own session_id/step_id allowlists - see that
-- migration, 20260919120000), so adding them later never requires
-- redesigning this table, only widening an allowlist.
--
-- Why not routine_responses: that table stores per-prompt journal-style
-- ANSWERS (one row per user+session+step+prompt+date), never a completion
-- fact - its own migration comment is explicit that dailyCompletion.js's
-- two localStorage flags remain the app's only "did you finish today"
-- signal today. This table is the first authoritative, server-side
-- completion record for those exact events - additive, alongside those
-- flags, never replacing them (see practiceCompletions.js/the three wired
-- screens - the existing localStorage flags are left completely intact).
--
-- ============================================================================
-- session_id / idempotency_key — the core design decision this table
-- exists to get right. Explicitly NOT "user + journey + practice_type +
-- local_date" (that would silently collapse two genuine same-day sessions
-- of the same type into one row - explicitly disallowed by the approved
-- brief). Instead:
--
--   Morning/Evening full routine: session_id is the Session Engine's own
--   `state.completionEventId` (src/session/sessionReducer.js,
--   generateCompletionEventId - crypto.randomUUID()). That id is minted
--   exactly once per genuine COMPLETE_SESSION transition (playing ->
--   completed), a second COMPLETE_SESSION dispatch once already completed
--   is a documented idempotent no-op that returns the SAME state
--   reference/id, and a NEW one is only ever minted by a subsequent fresh
--   START_SESSION -> ... -> COMPLETE_SESSION cycle (a genuinely new run,
--   e.g. "Repeat Morning Routine"). It survives a refresh/backgrounding via
--   the engine's own existing write-through localStorage persistence
--   (sessionPersistence.js) - this migration adds no new client storage of
--   its own, it just also writes this already-existing, already-durable id
--   into the DB the moment it appears.
--
--   Meditate.jsx guided-video meditation: session_id is a fresh
--   crypto.randomUUID() minted client-side in Meditate.jsx the moment a
--   video is genuinely opened (Begin), and again immediately after each
--   genuine natural completion is recorded (so a deliberate "Play Again"
--   that is watched through to a second real `ended` is a distinct session,
--   never the same id twice) - see practiceCompletions.js/Meditate.jsx's own
--   doc comments for the exact rotation.
--
-- idempotency_key is session_id verbatim for every Phase 2 write (documented
-- here, not enforced by a generated column, so a deliberate future practice
-- type can compose a different key - e.g. one session legitimately
-- producing more than one persisted outcome row - without a schema change).
-- The UNIQUE(user_id, idempotency_key) constraint below is the actual
-- duplicate backstop: a repeated/duplicate callback for the same genuine
-- completion (StrictMode double-invoke, a retried failed write, a second
-- `ended` DOM event the UI layer's own ref-guard already suppresses) always
-- resolves to the exact same (user_id, idempotency_key) pair and is
-- rejected at the database, never relying on a React ref alone.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.practice_completion_events (
  event_id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id        text NOT NULL,
  journey           text NOT NULL,
  practice_type     text NOT NULL,
  -- Server time, not client-supplied - a client clock can be wrong or
  -- deliberately spoofed; the moment this row is genuinely inserted is
  -- already, at most, a network round-trip away from the real completion
  -- moment, which is accurate enough for a completion record and never
  -- trusts the caller's own Date.now().
  completed_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  duration_seconds  integer,
  local_date        date NOT NULL,
  timezone          text NOT NULL,
  outcome           text NOT NULL DEFAULT 'completed',
  idempotency_key   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- Validation
-- ============================================================================

-- The exact, already-established, app-wide guided-media completion journey
-- allowlist (src/lib/mediaCompletionPresentation.js's own
-- MEDIA_COMPLETION_JOURNEYS) - Phase 2 only ever writes 'morning' (Session
-- Complete), 'evening' (Evening Complete) and 'direct' (Meditate.jsx's own
-- completionContext.journey); 'anytime'/'library' are reserved for future
-- Anytime Reset/Library wiring, already valid without a future migration.
ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_journey_check
  CHECK (journey IN ('morning', 'anytime', 'evening', 'library', 'direct'));

-- Only the two practice types Phase 2 actually wires. Widen this list (a
-- plain DROP CONSTRAINT/ADD CONSTRAINT, never a column/shape change) the
-- day a future phase wires breathing/stretching/anytime-reset/etc.
ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_practice_type_check
  CHECK (practice_type IN ('full_routine', 'meditation'));

-- Phase 2 persists only genuine natural completions - never started/
-- previewed/skipped/ended-early/interrupted-and-abandoned. Deliberately
-- restrictive (not a speculative future enum) for the same reason as
-- practice_type above; widen this the day a future phase deliberately
-- decides to persist a non-completed outcome.
ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_outcome_check
  CHECK (outcome = 'completed');

ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_duration_non_negative_check
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0);

-- Conservative IANA-shaped format check (mirrors
-- routine_responses_prompt_id_format_check's own "can't fully validate in
-- SQL, so reject anything that obviously isn't this shape" approach) - the
-- real validator is src/lib/timezone.js's isValidTimezone
-- (Intl.DateTimeFormat), which practiceCompletions.js always runs before
-- this ever reaches the database; this is only the DB-level backstop.
ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_timezone_format_check
  CHECK (timezone ~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)*$');

ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_session_id_not_blank_check
  CHECK (length(btrim(session_id)) > 0);

ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_idempotency_key_not_blank_check
  CHECK (length(btrim(idempotency_key)) > 0);

-- ============================================================================
-- Idempotency - the actual duplicate-protection backstop described above.
-- ============================================================================

ALTER TABLE public.practice_completion_events
  ADD CONSTRAINT practice_completion_events_owner_idempotency_key
  UNIQUE (user_id, idempotency_key);

-- ============================================================================
-- Indexes for the access patterns Phase 3+ is expected to need. None of
-- these are exercised by any Phase 2 code path (Phase 2 only ever writes;
-- it deliberately renders no statistics, milestones, or Home/Profile
-- surfaces) - added now so that future read work never needs its own
-- migration just to make its own query fast.
-- ============================================================================

-- User's own completion history in time order (e.g. a future "recent
-- activity" list).
CREATE INDEX IF NOT EXISTS practice_completion_events_user_completed_at_idx
  ON public.practice_completion_events (user_id, completed_at);

-- "Did I complete anything on local day X" / one-flag-per-day style
-- summaries, computed in the user's own local calendar day (never UTC).
CREATE INDEX IF NOT EXISTS practice_completion_events_user_local_date_idx
  ON public.practice_completion_events (user_id, local_date);

-- Future per-journey/practice-type summaries (e.g. "how many Evening
-- routines this month") without a full table scan per user.
CREATE INDEX IF NOT EXISTS practice_completion_events_user_journey_practice_idx
  ON public.practice_completion_events (user_id, journey, practice_type, local_date);

-- ============================================================================
-- RLS - owner-only, TO authenticated only, matching routine_responses
-- exactly (20260919120000) except this table is an append-only event log:
-- no UPDATE/DELETE policy exists at all (a completion event is never
-- edited or retracted by the client) - "only the minimum required
-- permissions" per the approved brief. A Supabase anonymous session still
-- authenticates as the `authenticated` Postgres role (same caveat already
-- documented on routine_responses/journal_entries/user_intentions); guest
-- write-prevention is additionally enforced client-side in
-- practiceCompletions.js (never attempts a write without a real,
-- non-anonymous userId - see that module's own isEligibleUser guard).
-- ============================================================================

ALTER TABLE public.practice_completion_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_completion_events_select_own" ON public.practice_completion_events;
CREATE POLICY "practice_completion_events_select_own" ON public.practice_completion_events
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "practice_completion_events_insert_own" ON public.practice_completion_events;
CREATE POLICY "practice_completion_events_insert_own" ON public.practice_completion_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Explicit confirmation that anon/PUBLIC have no access at all, in
-- addition to RLS having zero anon-targeted policies (belt and suspenders,
-- same style already used for routine_responses/public.is_admin()'s own
-- REVOKE/GRANT pairs). Only SELECT/INSERT are granted - no UPDATE/DELETE,
-- matching the RLS policies above exactly; there is no owned sequence to
-- grant (event_id is a uuid default, not a bigint identity column).
REVOKE ALL ON public.practice_completion_events FROM PUBLIC;
REVOKE ALL ON public.practice_completion_events FROM anon;
GRANT SELECT, INSERT ON public.practice_completion_events TO authenticated;
