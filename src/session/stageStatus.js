import { SESSION_STATUS, STEP_OUTCOME } from './sessionReducer';

/*
 * Phase 9 — Truthful Journey Outcomes: pure derivation of each displayed
 * pathway stage's real status from the Session Engine's own stepOutcomes
 * map (sessionReducer.js) plus the currently-active step/session status.
 * No React, no localStorage, no navigation - a plain function shared by
 * MorningJourneyPathway.jsx, EveningJourneyPathway.jsx, and the truthful
 * completion logic on the two final screens (SessionComplete.jsx/
 * EveningComplete.jsx need "are all displayed stages genuinely
 * completed", exposed here as isFullyCompleted).
 *
 * NEVER infers a stage's status from route position, step index, or
 * elapsed time - only from an explicit stepOutcomes entry, or (as the
 * sole fallback, only for the stage the session is genuinely, presently
 * on while still 'playing') the 'current' status. A stage the session
 * has not yet reached, and that has no recorded outcome, is always
 * 'not_started' - it is never assumed completed merely because a later
 * stage or the final screen was reached.
 */

export const STAGE_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  CURRENT: 'current',
  COMPLETED: STEP_OUTCOME.COMPLETED,
  SKIPPED: STEP_OUTCOME.SKIPPED,
  ENDED_EARLY: STEP_OUTCOME.ENDED_EARLY,
});

const VALID_OUTCOMES = new Set(Object.values(STEP_OUTCOME));

/**
 * @param {Array<{id: string, label: string, icon: string, stepIds: string[]}>} stages
 *   Ordered display stages. `stepIds` names the real session step id(s)
 *   (session/sessionConstants.js) this display stage represents - usually
 *   one, occasionally more than one (e.g. Evening's 'rest' display stage
 *   covers both the real 'sleepPreparation' and 'completion' steps).
 * @param {Object<string,string>|null|undefined} stepOutcomes - a live
 *   session's state.stepOutcomes, or a persisted routineProgress.js
 *   snapshot's stepOutcomes. Defaults to {} (every stage not_started,
 *   unless currently active) when absent - the safe legacy fallback.
 * @param {string|null} currentStepId - the real step id the session is
 *   presently on, or null if no session for this routine is live today.
 * @param {string|null} sessionStatus - a SESSION_STATUS value for the
 *   session this belongs to, or null. 'playing' or 'interrupted' (paused)
 *   can produce 'current' - pausing to confirm a Back/leave dialog, or
 *   backgrounding the app, must not lose the "this is where you are"
 *   indication (Part 2's pause != abandon rule). A completed/skipped/idle
 *   session never shows a stage as "current".
 * @returns {Array<{id: string, label: string, icon: string, status: string}>}
 */
export const computeStageStatus = ({ stages, stepOutcomes, currentStepId = null, sessionStatus = null }) => {
  const outcomes = stepOutcomes && typeof stepOutcomes === 'object' ? stepOutcomes : {};
  return stages.map(({ id, label, icon, stepIds }) => {
    const outcome = stepIds.map((stepId) => outcomes[stepId]).find((value) => VALID_OUTCOMES.has(value));
    if (outcome) {
      return { id, label, icon, status: outcome };
    }
    const isActiveSession = sessionStatus === SESSION_STATUS.PLAYING || sessionStatus === SESSION_STATUS.INTERRUPTED;
    if (isActiveSession && currentStepId != null && stepIds.includes(currentStepId)) {
      return { id, label, icon, status: STAGE_STATUS.CURRENT };
    }
    return { id, label, icon, status: STAGE_STATUS.NOT_STARTED };
  });
};

// Exact sr-only suffixes named by the Phase 9 spec (e.g. "Stretch,
// completed", "Breathe, skipped", "Meditate, ended early", "Affirm,
// current", "Rest, not started") - every pathway caller renders
// `, {STAGE_STATUS_SR_TEXT[stage.status]}` as a sr-only suffix on every
// stage, regardless of status, so screen reader users get an explicit
// outcome for every stage, not only the non-default ones. Lives here
// (not in components/journey/StageOutcomeBadge.jsx) so that file exports
// only a component - react-refresh/only-export-components (this repo's
// established Fast Refresh guard) rejects a component file that also
// exports a non-primitive constant.
export const STAGE_STATUS_SR_TEXT = Object.freeze({
  completed: 'completed',
  current: 'current',
  skipped: 'skipped',
  ended_early: 'ended early',
  not_started: 'not started',
});

// True only when every displayed stage is genuinely 'completed' - the
// exact "are all displayed stages completed" question Part 8's
// full-routine/Momentum-integrity gating needs. An empty list is never
// "fully completed" (nothing to be complete about).
export const isFullyCompleted = (stageStatusList) =>
  Array.isArray(stageStatusList) &&
  stageStatusList.length > 0 &&
  stageStatusList.every((stage) => stage.status === STAGE_STATUS.COMPLETED);
