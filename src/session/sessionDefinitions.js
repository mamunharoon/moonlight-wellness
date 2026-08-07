import { SESSION_CATEGORIES, MORNING_STEP_IDS, EVENING_STEP_IDS } from './sessionConstants';

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

/*
 * Stage 4 Batch F1 — evening-wind-down
 *
 * Registry/definitions only, per the approved Stage 4 architecture: one
 * continuous session (same "one session, not four" philosophy as
 * MORNING_ROUTINE_SESSION above, applied consistently rather than
 * reintroducing the blueprint's original separate-modules split for
 * evening either). Approved flow: Home -> Evening Wind-down ->
 * Reflection -> Gratitude -> Evening Breathing -> Prepare For Rest ->
 * Completion -> Home.
 *
 * route: null for every step. Unlike the morning session (whose pages
 * already existed before Group 1 ever described them), no evening page,
 * route, or component exists yet — this batch is explicitly scoped to
 * registry/definitions only ("No screens. No routes. No components.").
 * Populating a route string that doesn't correspond to a real
 * react-router route would be inaccurate data, not a harmless
 * placeholder. Each step's route is filled in by the batch that
 * implements that step's page (planned batches F3/F4/F6).
 *
 * skippable: false for every step, for the same reason — this field's
 * own documented meaning (above) is "whether the step's *existing
 * screen* has a Skip affordance today." No screen exists today, so
 * there is no affordance to reflect yet, regardless of what the Stage 4
 * design proposal envisions for the eventual UI. Revisited per-step as
 * each page is actually built.
 *
 * durationSeconds: null for every step, for the same reason as
 * `skippable` — this field reflects a *current implementation's*
 * genuine fixed duration (see the shared doc comment above); there is
 * no implementation yet to measure.
 *
 * atmosphereRequest / audioCue: null for every step, matching the
 * morning session exactly — no page consumes either yet. Wiring
 * AtmosphereManager is explicitly out of scope for this batch.
 */
export const EVENING_ROUTINE_SESSION = {
  id: 'evening-wind-down',
  category: SESSION_CATEGORIES.EVENING,
  title: 'Evening Wind-down',
  entryStates: null, // reserved for Stage 3D
  completionEffect: null, // reserved for Stage 3D
  steps: [
    {
      // Stage 4 Batch F3: route filled in now that EveningWindDown.jsx
      // exists — see the file-level doc comment above ("Each step's
      // route is filled in by the batch that implements that step's
      // page"). skippable/durationSeconds/atmosphereRequest/audioCue
      // stay null for the same reason they started null: this step's
      // real screen has no Skip affordance, no fixed duration, and
      // doesn't feed AtmosphereManager through the registry (F3 wires
      // the atmosphere directly on the page instead — see that reasoning
      // in EveningWindDown.jsx).
      id: EVENING_STEP_IDS.WIND_DOWN,
      route: '/evening-wind-down',
      skippable: false,
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      // Stage 4 Batch F4: route filled in now that Reflection.jsx exists
      // — see WIND_DOWN's own comment above for the established reasoning.
      // skippable: true — PromptStepper's own Skip control is a real
      // per-prompt affordance on this screen today (see PromptStepper.jsx).
      id: EVENING_STEP_IDS.REFLECTION,
      route: '/reflection',
      skippable: true,
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      // Stage 4 Batch F4: route filled in now that Gratitude.jsx exists
      // — same reasoning as REFLECTION above.
      id: EVENING_STEP_IDS.GRATITUDE,
      route: '/gratitude',
      skippable: true,
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      // Stage 4 Batch F6: route filled in now that EveningBreathing.jsx
      // exists — see WIND_DOWN's own comment above for the established
      // reasoning. skippable: true — a real Skip control exists on this
      // screen. durationSeconds: 76 — EveningBreathing.jsx's own fixed
      // secondsLeft starting value (a slower 4-7-8 cycle, 4 full cycles,
      // deliberately calmer/longer than Breathe.jsx's 56s/4-4-6 cycle).
      id: EVENING_STEP_IDS.BREATHING,
      route: '/evening-breathing',
      skippable: true,
      durationSeconds: 76,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      // Stage 4 Batch F6: route filled in now that PrepareForRest.jsx
      // exists. skippable: false — this screen has a single "Continue"
      // action only, no separate Skip affordance (ticket did not request
      // one for this step, unlike Evening Breathing).
      id: EVENING_STEP_IDS.SLEEP_PREPARATION,
      route: '/prepare-for-rest',
      skippable: false,
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
    {
      // Stage 4 Batch F3: route filled in now that EveningComplete.jsx
      // exists — same reasoning as the WIND_DOWN step above.
      id: EVENING_STEP_IDS.COMPLETION,
      route: '/evening-complete',
      skippable: false,
      durationSeconds: null,
      atmosphereRequest: null,
      audioCue: null,
    },
  ],
};

// The full registry content. Two entries as of Stage 4 Batch F1 — see
// "WHY ONE SESSION, NOT FOUR" above (morning) and the evening-wind-down
// doc comment above (evening). Support sessions and Panic Mode remain
// explicitly out of scope (Stage 4 architecture proposal §5/§7 — Panic
// Mode conflicts with the reducer's single-active-session model and
// needs its own decision before implementation).
export const SESSION_DEFINITIONS = [MORNING_ROUTINE_SESSION, EVENING_ROUTINE_SESSION];
