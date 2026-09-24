/*
 * Stage 3C — Session Engine, shared constants (Ticket Group 1)
 *
 * Pure constants only — no React, no side effects, no imports from any
 * context or page. See docs/stage-3-implementation-blueprint.md §3/§8
 * and the approved Stage 3C execution plan (§9-§11) for the authoritative
 * model this implements.
 */

export const SESSION_CATEGORIES = Object.freeze({
  MORNING: 'morning',
  EVENING: 'evening',
  SUPPORT: 'support',
});

// The exact step-id vocabulary already used in production today by
// AlarmContext.jsx's `journeyStep` state, Layout.jsx's `stepPaths` map,
// and ProgressIndicator.jsx's `steps` array — three independently
// hand-synced copies of this same list (Stage 3C execution plan §7/§24).
// Group 1 introduces this as the intended single source of truth for
// that vocabulary, but does not migrate any of those three existing
// consumers onto it yet — that migration is Group 3 scope, not this
// group's. Nothing outside src/session/ reads this constant yet.
// Morning-flow redesign: START ('start', formerly /morning-start's
// video-selection screen) is removed — it no longer corresponds to any
// step in MORNING_ROUTINE_SESSION (sessionDefinitions.js). Approved order
// is now Intend -> Stretch -> Breathe -> Affirm -> Complete. See
// morningFlowMigration.js for the one-time storage migration this
// removal requires.
// Journey Embedding (Self-Guided Meditation) — MEDITATE inserted
// immediately after BREATHE, per the approved order Intend -> Stretch ->
// Breathe -> Meditate (optional) -> Affirm -> Complete. See
// sessionDefinitions.js for the registry entry this id feeds.
export const MORNING_STEP_IDS = Object.freeze({
  ALARM: 'alarm',
  INTENTION: 'intention',
  STRETCH: 'stretch',
  BREATHE: 'breathe',
  MEDITATE: 'meditate',
  AFFIRMATION: 'affirmation',
  COMPLETE: 'complete',
});

// Daily Journey & Content Architecture: the user-facing "Step X of Y"
// numbering for Rise & Reset (Home.jsx's own "Continue" card is the one
// consumer — see resolveRoutineCardState usage there) — deliberately
// excludes 'alarm' (the ringing-alarm screen, not a routine step the user
// experiences as "Step 0") and 'complete' (its own terminal screen, not
// counted) - Morning's own established counting convention is "activities
// only, before completion," unlike Evening's (below), which counts
// completion as its own final numbered step. Exported here, the same
// registry-adjacent module every step page and Home.jsx already imports
// from, so "Step X of Y" can never silently drift between the two.
//
// Journey Embedding (correction) — 'meditate' IS counted here: it is a
// real activity step in the approved order (Intend -> Stretch -> Breathe
// -> Meditate -> Affirm -> Complete), same treatment as every other
// activity (stretch/breathe/affirmation are all skippable too, and all
// counted) - being OPTIONAL/skippable was never the actual exclusion
// criterion for this map (only 'alarm'/'complete' were ever excluded, for
// being pre-entry/terminal, not for being skippable). An earlier revision
// of this file excluded 'meditate' on mistaken "optional therefore
// uncounted" reasoning; corrected here. affirmation is now display number
// 5 (was 4); the count is now 5 (was 4).
export const MORNING_DISPLAY_STEP_NUMBERS = Object.freeze({
  intention: 1,
  stretch: 2,
  breathe: 3,
  meditate: 4,
  affirmation: 5,
});
export const MORNING_DISPLAY_STEP_COUNT = 5;

// Same role as MORNING_DISPLAY_STEP_NUMBERS above, for the evening-wind-
// down session — includes 'completion' (unlike morning's 'complete',
// which is excluded) since the required evening sequence explicitly
// numbers it as its own step ("7. Evening Complete" is evening's own
// terminal screen in that same numbered list; evening's own sequence
// numbers Wind-Down through Evening Complete as one continuous 1-7). This
// is Evening's own established counting convention (count everything,
// including the terminal screen) - deliberately different from Morning's
// own convention above (activities only, terminal screen excluded); each
// session keeps its own pre-existing convention rather than being
// unified into one shared rule.
//
// Journey Embedding (correction) — 'meditation' IS counted here, same
// reasoning as MORNING_DISPLAY_STEP_NUMBERS above: it is a real activity
// step (Wind Down -> Reflect -> Gratitude -> Breathe -> Meditate ->
// Rest -> Done), and being optional/skippable was never the exclusion
// criterion for this map (reflection/gratitude/breathing are all
// skippable too, and all counted). sleepPreparation is now display number
// 6 (was 5), completion is now 7 (was 6); the count is now 7 (was 6).
export const EVENING_DISPLAY_STEP_NUMBERS = Object.freeze({
  windDown: 1,
  reflection: 2,
  gratitude: 3,
  breathing: 4,
  meditation: 5,
  sleepPreparation: 6,
  completion: 7,
});
export const EVENING_DISPLAY_STEP_COUNT = 7;

// Stage 4 Batch F1 — same role as MORNING_STEP_IDS above, for the
// approved single-continuous-session evening flow (Home -> Evening
// Wind-down -> Reflection -> Gratitude -> Evening Breathing -> Prepare
// For Rest -> Completion -> Home). No page, route, or component reads
// this yet - this batch is registry/definitions only.
//
// Journey Embedding — MEDITATION inserted immediately after BREATHING,
// per the approved order ... Breathe -> Meditate (optional) -> Prepare
// For Rest. See sessionDefinitions.js for the registry entry.
export const EVENING_STEP_IDS = Object.freeze({
  WIND_DOWN: 'windDown',
  REFLECTION: 'reflection',
  GRATITUDE: 'gratitude',
  BREATHING: 'breathing',
  MEDITATION: 'meditation',
  SLEEP_PREPARATION: 'sleepPreparation',
  COMPLETION: 'completion',
});

// Illustrative placeholder vocabulary only (see the Group 1 task brief's
// AUDIO CONTRACT section and execution plan §15). No audio file,
// dependency, or playback code exists anywhere in the Session Engine —
// every step in the current registry deliberately uses `audioCue: null`
// because no step plays a per-step cue today (see sessionDefinitions.js
// doc comment for why). This constant exists only so a later group
// reuses the same string vocabulary instead of inventing its own.
export const AUDIO_CUE_EXAMPLES = Object.freeze([
  'breath-in',
  'breath-out',
  'session-complete',
]);
