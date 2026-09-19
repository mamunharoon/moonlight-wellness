import { useSession } from '../context/SessionContext';

/*
 * Safe backward navigation ("Review Mode") — the single source of truth
 * every Morning/Evening step page uses to know whether IT is the live
 * current step or is being reviewed from an earlier point in the
 * progress bar.
 *
 * Deliberately NOT a reducer/state-model change: `stepIndex` (the
 * Session Engine's own authoritative current/furthest position) never
 * moves backward, is never read here, and is never written to by review
 * navigation. A review visit is a PLAIN React Router navigation to an
 * earlier step's own route; this hook just compares that route's own
 * step id against the engine's real currentStep.id to tell the two
 * apart. Direct URL navigation gets the exact same treatment as a
 * progress-bar tap - both just mount this same page component, and this
 * hook reads the same live currentStep either way, so there is no
 * separate "bypass" path to close.
 *
 * isReviewMode is only ever true while a session for THIS step's own
 * routine is genuinely 'playing'/'interrupted' elsewhere - a session
 * that is 'idle'/'completed'/'skipped', or an unrelated routine, is not
 * "being reviewed", it's just an ordinary standalone visit (e.g. Home's
 * "60-Second Reset" opening /breathe with no active Morning session at
 * all) - unchanged, pre-existing behaviour for that case.
 */
export const useStepReviewMode = (stepId) => {
  const { state, currentStep } = useSession();
  const sessionIsActive = state.status === 'playing' || state.status === 'interrupted';
  const isReviewMode = sessionIsActive && Boolean(currentStep) && currentStep.id !== stepId;
  return { isReviewMode, currentStep, sessionIsActive };
};
