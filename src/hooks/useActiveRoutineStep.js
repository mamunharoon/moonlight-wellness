import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';

/*
 * Back-navigation repair — shared "is a routine actively in progress"
 * source of truth.
 *
 * Extracted out of Layout.jsx's own forced-navigation effect (mobile
 * navigation repair, prior session) rather than duplicated: both Layout
 * (which restores the user into an in-progress step on load) and
 * BackButton (which shows a "Leave this routine?" confirmation before
 * navigating away from one) need the exact same dual-source answer —
 * Session Engine 'playing' status first, the legacy journeyStep map as
 * fallback — and must never be allowed to drift out of sync with each
 * other.
 */
const LEGACY_STEP_PATHS = {
  alarm: '/alarm-trigger',
  start: '/morning-start',
  affirmation: '/affirmation',
  stretch: '/morning-flow',
  breathe: '/breathe',
  intention: '/intention-setup',
  complete: '/session-complete'
};

export const useActiveRoutineStep = () => {
  const { journeyStep, setJourneyStep } = useAlarm();
  const { state, currentStep, interruptSession } = useSession();

  const sessionRoute = state.status === 'playing' ? currentStep?.route ?? null : null;
  const legacyRoute = journeyStep ? LEGACY_STEP_PATHS[journeyStep] ?? null : null;
  const activeRoute = sessionRoute ?? legacyRoute;

  // Called when the user confirms "Leave routine" from BackButton's
  // confirmation dialog. Pauses rather than discards: the Session Engine
  // side is interrupted (not abandoned/reset), same as the existing
  // snooze flow in AlarmContext.jsx, so progress is recoverable, not
  // lost. The legacy side has no "interrupted" concept — clearing
  // journeyStep is the same action Skip Routine and snooze already use.
  const leaveActiveRoutine = () => {
    if (state.status === 'playing') interruptSession('user_back_navigation');
    if (journeyStep) setJourneyStep('');
  };

  return { activeRoute, leaveActiveRoutine };
};

export { LEGACY_STEP_PATHS };
