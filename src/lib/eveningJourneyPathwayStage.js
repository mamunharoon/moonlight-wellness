// Evening Visual Uplift (Phase 7) — pure derivation of which of the 5
// high-level EveningJourneyPathway stages (reflect/gratitude/breathe/
// meditate/rest) corresponds to the REAL Evening Session Engine's current
// step id. Extracted as its own small, pure, exported function (rather
// than inlined in Home.jsx) so the mapping itself is genuinely unit-
// testable with real execution, not only a source-string assertion.
//
// The real Evening session has 7 steps (windDown, reflection, gratitude,
// breathing, meditation, sleepPreparation, completion - see
// session/sessionConstants.js). This pathway only ever shows the 5
// high-level stages the user actually experiences as "the journey":
//   - windDown (the introduction screen, before any of the 5 stages has
//     genuinely begun) maps to `null` - no stage reads as current yet,
//     the pathway renders in its plain/neutral look, exactly as if no
//     stage id were supplied at all.
//   - sleepPreparation AND completion both map to 'rest' - Prepare for
//     Rest is the real screen for the Rest stage, and reaching the
//     terminal 'completion' step (only possible via a genuine
//     COMPLETE_SESSION dispatch at the terminal step) still means Rest is
//     the last meaningful stage the pathway can point to.
// Never infers anything about completed/skipped status - this only ever
// answers "which stage is CURRENT", the one thing session/stepIndex
// position is genuinely reliable for (see EveningJourneyPathway.jsx's own
// doc comment for why completed/skipped are a completely separate,
// explicitly-supplied concern this function never touches).
const EVENING_STAGE_BY_STEP_ID = Object.freeze({
  windDown: null,
  reflection: 'reflect',
  gratitude: 'gratitude',
  breathing: 'breathe',
  meditation: 'meditate',
  sleepPreparation: 'rest',
  completion: 'rest'
});

/**
 * @param {string|null|undefined} stepId - a real Evening session step id
 *   (session/sessionDefinitions.js), or null/undefined if no session step
 *   is currently resolvable.
 * @returns {'reflect'|'gratitude'|'breathe'|'meditate'|'rest'|null}
 */
export const resolveEveningPathwayStage = (stepId) => EVENING_STAGE_BY_STEP_ID[stepId] ?? null;
