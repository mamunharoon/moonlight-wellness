/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationHistory } from '../context/NavigationHistoryContext';
import { useActiveRoutineStep } from '../hooks/useActiveRoutineStep';
import { ConfirmDialog } from './ConfirmDialog';

/*
 * Back-navigation repair — BackButton
 *
 * Standard back-arrow control for every secondary screen. 44x44px touch
 * target (w-11 h-11 = 44px in this app's Tailwind scale, matching the
 * circular icon-button pattern already used throughout the app —
 * RoutineDetail.jsx, Support.jsx, Profile.jsx's settings gear), a real
 * accessible name (default "Go back"), and immediate visual feedback via
 * active:scale-95 (a CSS pseudo-class, not gated behind any JS/async
 * work, so it fires on first touch).
 *
 * Navigation: goBack (NavigationHistoryContext) returns to the actual
 * previous in-app screen when one genuinely exists in this app
 * instance's own history, otherwise replaces to `fallback` — never
 * relies on raw browser history alone, so a direct URL open or a fresh
 * reload can never land the user outside WakeWise or on an auth/login
 * page that isn't actually the fallback route itself.
 *
 * Active-routine guard: if this exact route is the currently in-progress
 * step of a 'playing' Session Engine session or the legacy journeyStep
 * flow (useActiveRoutineStep — the same source Layout.jsx's own restore
 * effect reads), pressing back shows a confirmation first rather than
 * silently leaving progress behind. Ordinary browsing screens (anything
 * that isn't itself the active step) never see this dialog.
 */
export const BackButton = ({ fallback = '/', label = 'Go back', className = '' }) => {
  const location = useLocation();
  const { goBack } = useNavigationHistory();
  const { activeRoute, leaveActiveRoutine } = useActiveRoutineStep();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isActiveRoutineStep = activeRoute === location.pathname;

  const handleClick = () => {
    if (isActiveRoutineStep) {
      setConfirmOpen(true);
      return;
    }
    goBack(fallback);
  };

  const handleLeave = () => {
    leaveActiveRoutine();
    setConfirmOpen(false);
    goBack(fallback);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={`w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary shrink-0 ${className}`}
      >
        <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Leave this routine?"
        message="Your current progress may be paused."
        confirmLabel="Leave routine"
        cancelLabel="Stay"
        destructive
        onConfirm={handleLeave}
        onDismiss={() => setConfirmOpen(false)}
      />
    </>
  );
};
