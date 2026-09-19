import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessionById } from './sessionRegistry';

/*
 * Safe backward navigation ("Review Mode") — shared navigation helper
 * used by every Morning/Evening step page's ProgressIndicator
 * `onReviewStep` handler and "Return to [current step]" action.
 *
 * Never touches the Session Engine. A review visit (or returning to the
 * live step from one) is always a plain React Router navigate() to that
 * step's own registry route — stepIndex is never read or written here.
 * Leaving the ACTUAL live step (not a review of an earlier one) while it
 * has real unsaved input or an active timer asks for confirmation first
 * (`hasUnsavedProgress`, computed by the calling page); confirming or
 * cancelling never touches any session/persisted state on its own —
 * cancelling simply doesn't navigate, leaving the live page exactly as
 * it was. Any music/timer belonging to the step being left is cleaned up
 * by that component's own existing unmount effect once React Router
 * actually swaps the route — nothing extra to trigger here.
 *
 * `onLeaveLiveStep` (optional): called synchronously right before the
 * navigate() in confirmLeave, only ever on the path that actually leaves
 * a live step with real unsaved progress (never on the immediate/no-
 * confirmation path, and never on cancelLeave). The three timed exercise
 * screens (Breathe/MorningFlow/EveningBreathing) use this to snapshot
 * their exact countdown/phase state (session/timedExercisePause.js)
 * before their own unmount would otherwise destroy it, so returning to
 * the live step later resumes exactly where it was paused instead of
 * restarting from the beginning.
 */
export const useReviewNavigation = ({ sessionId, isLiveStep, hasUnsavedProgress, onLeaveLiveStep }) => {
  const navigate = useNavigate();
  const [pendingStepId, setPendingStepId] = useState(null);

  const routeForStep = (stepId) => getSessionById(sessionId)?.steps.find((s) => s.id === stepId)?.route ?? '/';

  const requestReview = (stepId) => {
    if (isLiveStep && hasUnsavedProgress) {
      setPendingStepId(stepId);
      return;
    }
    navigate(routeForStep(stepId));
  };

  const confirmLeave = () => {
    const target = pendingStepId;
    setPendingStepId(null);
    if (target) {
      onLeaveLiveStep?.();
      navigate(routeForStep(target));
    }
  };

  const cancelLeave = () => setPendingStepId(null);

  return { requestReview, confirmLeave, cancelLeave, isConfirming: pendingStepId !== null, routeForStep };
};
