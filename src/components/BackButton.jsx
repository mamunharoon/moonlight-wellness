/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
 *
 * `guardActiveRoute` (Build 15 Evening UX correction — additive, default
 * true so every existing caller keeps this exact behaviour): set to
 * false by EveningSceneShell's own BackButton usage, since Evening now
 * has a dedicated Exit/X control for "interrupt the active journey and
 * go Home" - Back on an Evening screen must always mean "previous
 * question/stage," a plain confirmation-free navigate(), never this
 * guard's dialog. Without this, Reflection/Gratitude/Evening Breathing/
 * Prepare for Rest each share ONE route across multiple internal
 * questions/stages, so `activeRoute === location.pathname` was true for
 * the entire time any of them was the live step - meaning Back on, say,
 * Reflection Q2 showed "Leave this routine?" instead of simply returning
 * to Reflection Q1.
 *
 * confirmTitle/confirmMessage let a caller override that confirmation's
 * exact wording (e.g. EveningSceneShell's "Leave evening routine? Your
 * unsaved progress may be lost.") — optional, defaulting to the original
 * generic copy so every existing caller is unaffected.
 *
 * `onBeforeLeave` (Edit Tonight's Responses, Build 15 — additive, every
 * existing caller omits it and is completely unaffected): an optional
 * `() => boolean` checked only on the ORDINARY (non-active-routine-step)
 * path, right before this button would otherwise call goBack(fallback).
 * Returning `false` cancels this tap's navigation entirely, leaving the
 * caller free to show its own confirmation (e.g. "Discard your
 * changes?") and navigate itself once the user actually confirms.
 * Returning anything else (including undefined, or the prop being
 * omitted) proceeds exactly as before. This exists because the
 * active-routine-step confirmation above only ever fires for a route
 * that is the Session Engine's own current live step
 * (useActiveRoutineStep) — Edit Tonight's Responses is deliberately
 * never coupled to the Session Engine at all, so that mechanism can
 * never protect its own unsaved draft; a second, narrower hook was
 * needed rather than widening the active-routine-step concept to
 * something it was never meant to describe.
 *
 * `alwaysFallback` (Back-navigation repair, Morning canonical map —
 * additive, every existing caller omits it and is unaffected): when
 * true, a successful ordinary-path tap always navigates straight to
 * `fallback` (replacing, never pushing) instead of goBack's normal
 * "prefer the real previous in-app screen" behaviour. Used only by
 * SessionComplete.jsx — that screen's real in-app history always has
 * the just-finished routine's last step behind it, and goBack's usual
 * navigate(-1) would silently re-enter that completed step, which the
 * canonical Morning navigation map explicitly forbids ("do not re-enter
 * a completed journey using browser Back").
 *
 * WakeWise Phase 2 (B7, dialog severity audit) — this confirmation's own
 * severity was `destructive` (full red), the same visual weight as
 * genuinely erasing saved data (Redo Tonight's Wind-Down, Discard
 * Changes). What it actually does - leaveActiveRoutine() -> a plain
 * interruptSession(), never resetRoutine/completeSession - only PAUSES
 * progress ("Your current progress may be paused", the confirmMessage
 * default itself already says so); nothing is erased, and the paused
 * routine remains resumable from Home. That is exactly this app's
 * "exit an active session" tier, not its "erases meaningful progress"
 * tier, so this is now `mildDestructive` - corrected once, here, for
 * every one of this shared component's own callers at once (Breathe.jsx,
 * Affirmation.jsx, IntentionSetup.jsx, MorningFlow.jsx, and any other
 * screen using the default guardActiveRoute confirmation).
 */
export const BackButton = ({
  fallback = '/',
  label = 'Go back',
  className = '',
  confirmTitle = 'Leave this routine?',
  confirmMessage = 'Your current progress may be paused.',
  onBeforeLeave,
  guardActiveRoute = true,
  alwaysFallback = false
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { goBack } = useNavigationHistory();
  const { activeRoute, leaveActiveRoutine } = useActiveRoutineStep();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isActiveRoutineStep = guardActiveRoute && activeRoute === location.pathname;

  const handleClick = () => {
    if (isActiveRoutineStep) {
      setConfirmOpen(true);
      return;
    }
    if (onBeforeLeave && onBeforeLeave() === false) return;
    if (alwaysFallback) {
      navigate(fallback, { replace: true });
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
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Leave routine"
        cancelLabel="Stay"
        mildDestructive
        onConfirm={handleLeave}
        onDismiss={() => setConfirmOpen(false)}
      />
    </>
  );
};
