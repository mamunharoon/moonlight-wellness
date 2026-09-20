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
 * Cross-routine isolation fix, found live: this hook used to accept only
 * `stepId`, never `sessionId` - so it never checked WHICH routine the
 * Session Engine's one global live slot actually belonged to. The
 * Session Engine only ever tracks one live session at a time
 * (state.sessionId); if Evening was genuinely live at 'sleepPreparation'
 * (Rest) and the user opened ANY Morning page (a direct URL, or simply
 * because Morning was already the selected routine), `sessionIsActive`
 * was true (Evening WAS playing) and `currentStep.id !== stepId` was
 * also true ('sleepPreparation' !== 'breathe') - so isReviewMode
 * resolved to true and the banner showed "Reviewing — your place is
 * still Rest" on a MORNING screen, reading Evening's own live step as if
 * it belonged to Morning. Reproduced live exactly this way. Fixed by
 * requiring the CALLING PAGE'S OWN sessionId to match the live session's
 * sessionId before ever treating it as "this routine is live" at all -
 * Morning Review Mode may only ever read Morning's own live state and
 * Evening Review Mode may only ever read Evening's own, never derived
 * from whichever routine happens to occupy the global live slot. When
 * the live session belongs to a DIFFERENT routine (or there is none),
 * this page behaves as an ordinary standalone visit - the exact same,
 * already-established treatment as "no active session at all" (e.g.
 * Support's mood picker opening /quiet-breathing directly, with nothing
 * live).
 *
 * `isLiveStep` (new): distinct from `!isReviewMode`. A page's own step
 * is only genuinely "live" when THIS ROUTINE is the one actually running
 * AND the engine's current step is THIS EXACT step - not merely "not
 * reviewing", which would also (wrongly) be true while a different
 * routine's session is live. Callers pass this into
 * useReviewNavigation's `isLiveStep` so the "your current exercise will
 * be paused" confirmation only ever fires for a step that is truly, live,
 * mid-run - never for a standalone visit while the other routine plays.
 */
export const useStepReviewMode = (stepId, sessionId) => {
  const { state, currentStep } = useSession();
  const isThisRoutineLive = (state.status === 'playing' || state.status === 'interrupted') && state.sessionId === sessionId;
  const isReviewMode = isThisRoutineLive && Boolean(currentStep) && currentStep.id !== stepId;
  const isLiveStep = isThisRoutineLive && Boolean(currentStep) && currentStep.id === stepId;
  return {
    isReviewMode,
    isLiveStep,
    // Never surfaced when it doesn't genuinely belong to this routine -
    // a caller that (incorrectly) rendered a banner off this value
    // regardless of isReviewMode still could never display the other
    // routine's step name.
    currentStep: isThisRoutineLive ? currentStep : null,
    sessionIsActive: isThisRoutineLive
  };
};
