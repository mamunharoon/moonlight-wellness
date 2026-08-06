import { SESSION_CATEGORIES, MORNING_STEP_IDS } from './sessionConstants';

/*
 * Stage 3C — Session Engine, session/step definitions (Ticket Group 1)
 *
 * Pure data only — see IMPORTANT RULES in the Group 1 task brief and the
 * approved Stage 3C execution plan §10/§11. Nothing in this file
 * navigates, reads/writes localStorage, calls Supabase, touches React
 * context, or owns a timer. It describes the *existing* morning
 * experience exactly as implemented today (src/pages/AlarmActive.jsx
 * through SessionComplete.jsx, currently orchestrated by
 * AlarmContext.jsx's `journeyStep` plus Layout.jsx's forced-navigation
 * effect) — it does not change, replace, or wire into that flow yet.
 *
 * SHAPE
 *   Session: { id, category, title, steps, entryStates, completionEffect }
 *   Step:    { id, route, skippable, durationSeconds, atmosphereRequest, audioCue }
 *
 * WHY ONE SESSION, NOT FOUR
 *   docs/stage-3-implementation-blueprint.md §3.2 eventually envisions
 *   the morning experience as four separate session modules (Awakening,
 *   Stretching, Grounding, Intention). Today's actual implementation is
 *   one continuous, linearly-navigated flow driven by a single
 *   `journeyStep` value — there is no code path where, say, the
 *   Stretching step exists independently of the rest. The Group 1 task
 *   brief's own instruction to "describe the existing flow only" is
 *   modeled here as it genuinely exists today: one session, seven steps.
 *   Whether/how to decompose this into the blueprint's four-module split
 *   is a decision for a later group, not invented here.
 *
 * entryStates / completionEffect
 *   Reserved for the Emotional Engine (Stage 3D, not built) and
 *   deliberately left `null` here rather than half-implemented — see
 *   execution plan §10 ("overly generic abstraction" risk).
 *
 * atmosphereRequest
 *   Uses AtmosphereManager.jsx's own existing prop names exactly
 *   (mistActive/rainActive/particleEventType/particleTriggerKey/
 *   auroraActive — see execution plan §14). Every step below is `null`
 *   because the morning flow requests no atmospheric layer today —
 *   verified: none of the 8 morning pages import any Stage 3 visual
 *   component. Wiring real requests is explicitly Group 6 scope.
 *
 * audioCue
 *   A placeholder string or `null` (see sessionConstants.js's
 *   AUDIO_CUE_EXAMPLES and execution plan §15). No step below has a real
 *   per-step audio cue today — the alarm's ringtone is existing Stage 2
 *   AlarmContext/AudioContext behaviour (a fixed playTrack call on the
 *   clock-match event), not a session-step concept — so every step here
 *   is `null` too.
 *
 * durationSeconds
 *   The step's own approximate, single fixed duration, where the current
 *   implementation genuinely has one. `null` where a step is
 *   self-paced/manually-advanced (alarm, start, affirmation, intention,
 *   and complete all only advance via a button today) or where the real
 *   duration varies by user preference rather than being one fixed
 *   number (`stretch`: MorningFlow.jsx runs 4 exercises at 20s or 40s
 *   each depending on AlarmContext's `routineDuration`). `breathe` is the
 *   one step with a genuine single fixed duration today — Breathe.jsx's
 *   own `secondsLeft` starts at 56 (its own comment: "1-minute
 *   production timer").
 *
 * skippable
 *   Reflects whether the step's existing screen has a Skip affordance in
 *   the UI today — not whether skipping is currently meaningful.
 *   Affirmation.jsx's Skip button, for example, currently produces
 *   identical behaviour to Continue (a pre-existing quirk noted in the
 *   execution plan §7) — it is still marked skippable here because the
 *   on-screen affordance exists.
 */

export const MORNING_ROUTINE_SESSION = {
  id: 'morning-routine',
  category: SESSION_CATEGORIES.MORNING,
  title: 'Morning Awakening',
  entryStates: null, // reserved for Stage 3D
  completionEffect: null, // reserved for Stage 3D
  steps: [
    {
      id: MORNING_STEP_IDS.ALARM,
      route: '/alarm-trigger',
      skippable: false, // slide-to-unlock + snooze only; no Skip affordance
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      id: MORNING_STEP_IDS.START,
      route: '/morning-start',
      skippable: true, // "Skip Routine" button
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      id: MORNING_STEP_IDS.AFFIRMATION,
      route: '/affirmation',
      skippable: true, // "Skip" button (currently identical to Continue)
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      id: MORNING_STEP_IDS.STRETCH,
      route: '/morning-flow',
      skippable: true, // "Skip Stretching" button
      durationSeconds: null, // varies with routineDuration (20s/40s x4 exercises) — see file doc comment
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      id: MORNING_STEP_IDS.BREATHE,
      route: '/breathe',
      skippable: true, // "Skip Breathing" button
      durationSeconds: 56, // Breathe.jsx's own fixed secondsLeft starting value
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      id: MORNING_STEP_IDS.INTENTION,
      route: '/intention-setup',
      skippable: false, // only "Start Your Journey" submit; no Skip affordance
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      id: MORNING_STEP_IDS.COMPLETE,
      route: '/session-complete',
      skippable: false, // terminal step; single "Continue to Today" CTA
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
  ],
};

// The full registry content. A single entry today — see "WHY ONE
// SESSION, NOT FOUR" above. Evening and support sessions, and Panic
// Mode, are explicitly out of scope for Group 1 (task brief: "Do not
// implement evening sessions. Do not implement support sessions. Do not
// implement panic mode.").
export const SESSION_DEFINITIONS = [MORNING_ROUTINE_SESSION];
