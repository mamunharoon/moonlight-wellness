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
export const MORNING_STEP_IDS = Object.freeze({
  ALARM: 'alarm',
  START: 'start',
  AFFIRMATION: 'affirmation',
  STRETCH: 'stretch',
  BREATHE: 'breathe',
  INTENTION: 'intention',
  COMPLETE: 'complete',
});

// Stage 4 Batch F1 — same role as MORNING_STEP_IDS above, for the
// approved single-continuous-session evening flow (Home -> Evening
// Wind-down -> Reflection -> Gratitude -> Evening Breathing -> Prepare
// For Rest -> Completion -> Home). No page, route, or component reads
// this yet - this batch is registry/definitions only.
export const EVENING_STEP_IDS = Object.freeze({
  WIND_DOWN: 'windDown',
  REFLECTION: 'reflection',
  GRATITUDE: 'gratitude',
  BREATHING: 'breathing',
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
