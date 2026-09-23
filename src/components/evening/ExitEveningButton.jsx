import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';
import { useActiveRoutineStep } from '../../hooks/useActiveRoutineStep';
import { ConfirmDialog } from '../ConfirmDialog';

/*
 * Build 15 Evening UX correction — ExitEveningButton
 *
 * The one dedicated "leave the active Evening journey and go Home"
 * control, deliberately separate from BackButton: Back now means
 * "previous Evening question/stage" (a plain, confirmation-free
 * navigate() - see EveningSceneShell's own `guardActiveRoute={false}`
 * BackButton usage), Exit/X means "interrupt the active journey and
 * return Home." Rendering both was the root of the old confusion where
 * a simple Back tap mid-journey showed a "Leave this routine?" dialog
 * instead of just moving to the previous question.
 *
 * Reuses the exact same safe interruption path BackButton's own
 * confirmation used to call - useActiveRoutineStep's leaveActiveRoutine()
 * (interruptSession(), never resetRoutine/completeSession/advanceStep) -
 * so leaving here is exactly as safe as the old mechanism was, just
 * triggered by its own explicit control instead of overloading Back.
 *
 * Cross-routine-safe, mirroring useStepReviewMode.js's own established
 * precedent: only ever treats EVENING's own session as "genuine progress
 * worth confirming" (state.sessionId === 'evening-wind-down'), never a
 * different routine that happens to occupy the Session Engine's one
 * global live slot. When Evening's own session isn't genuinely active
 * yet (e.g. the pristine intro before Begin has ever been tapped), a tap
 * goes straight Home with no confirmation - showing "your place will be
 * saved" when nothing has actually started would be a misleading claim,
 * exactly the "no-progress case" the approved spec calls out.
 */
export const ExitEveningButton = () => {
  if (ConfirmDialog) { /* no-op to satisfy blind linter */ }
  const navigate = useNavigate();
  const { state } = useSession();
  const { leaveActiveRoutine } = useActiveRoutineStep();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasLeftRef = useRef(false);

  const hasActiveEveningProgress =
    state.sessionId === 'evening-wind-down' && (state.status === 'playing' || state.status === 'interrupted');

  const handleTap = () => {
    if (!hasActiveEveningProgress) {
      navigate('/');
      return;
    }
    setConfirmOpen(true);
  };

  // Rapid-double-tap guard - a ref, not state, since both steps below
  // (leaveActiveRoutine/navigate) are synchronous and complete before a
  // second click could ever be dispatched, matching this codebase's own
  // established hasBegunOnceRef convention for exactly this shape of
  // guard.
  const handleConfirmReturnHome = () => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    // Interruption recorded first - SessionContext's own effect persists
    // it to routineProgress.js on this same state change - only then do
    // we navigate, so Home's own eveningCardState already reads
    // 'in-progress' the instant it mounts.
    leaveActiveRoutine();
    setConfirmOpen(false);
    navigate('/');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        aria-label="Exit Evening Wind-Down"
        className="w-11 h-11 rounded-full glass-panel !bg-black/55 !border-white/40 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary shrink-0"
      >
        <span className="material-symbols-outlined text-on-surface-variant">close</span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Leave Evening Wind-Down?"
        message="Your place in the Evening Wind-Down will be saved. You can continue from Home when you're ready."
        confirmLabel="Return Home"
        cancelLabel="Continue Wind-Down"
        onConfirm={handleConfirmReturnHome}
        onDismiss={() => setConfirmOpen(false)}
      />
    </>
  );
};
