import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useActiveRoutineStep } from '../hooks/useActiveRoutineStep';

/*
 * Mobile navigation repair, extracted from Layout.jsx's own forced-
 * redirect effect. Rendered once, directly inside <Router> alongside
 * NativeDeepLinkHandler/MorningReminderTapHandler (App.jsx) — NOT inside
 * <Layout> — specifically so it survives for the whole app session
 * regardless of which route is active.
 *
 * Safe backward navigation ("Review Mode") fix: only breathe/morning-flow
 * (of the nine Morning/Evening step routes) are actually nested UNDER
 * <Layout> in App.jsx's route tree — affirmation/intention-setup/every
 * evening step render as sibling top-level routes instead — so while this
 * effect lived inside Layout, Layout itself fully unmounted on those
 * pages and REMOUNTED the moment navigation crossed back into breathe/
 * morning-flow. Its lastForcedPathRef (a useRef) reset to null on every
 * such remount, making the effect think it had never yet forced a
 * redirect for the live step. Reproduced live: reviewing Stretch/Breathe
 * from Affirm (or Intend) silently bounced straight back to Affirm,
 * because Layout's fresh mount saw lastForcedPath still null and forced
 * the URL back to the actual live step before the reviewed page ever got
 * to render. Moving this effect up to a component that mounts once for
 * the whole app (never unmounting on a route change) fixes this at the
 * root — lastForcedPath now only ever resets on a genuine full page
 * reload, matching the "restore into the in-progress step on load/
 * refresh" behaviour this exists for.
 */
let lastForcedPath = null;

export const RoutineRestoreGuard = () => {
  const { isRinging } = useAlarm();
  // Back-navigation repair: activeRoute comes from the shared
  // useActiveRoutineStep hook so this effect and BackButton's "leave this
  // routine?" guard can never drift out of sync about what counts as an
  // active session step.
  const { activeRoute } = useActiveRoutineStep();
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile navigation repair, Phase 1: this effect used to re-run on every
  // location.pathname change and unconditionally shove the user back to
  // currentStep.route whenever a session was 'playing' — including right
  // after a deliberate bottom-nav tap to Home/Routines/Library/Profile,
  // since that tap itself changes location.pathname and re-triggered the
  // effect. A morning-routine or evening-wind-down session can stay
  // 'playing' in localStorage for up to 12 hours after the user last
  // touched it (see session/sessionPersistence.js's SESSION_STALE_AFTER_MS)
  // and both sessions start automatically (AlarmContext.jsx on alarm ring,
  // EveningWindDown.jsx on Begin) — so this was not a rare edge case, it
  // fired for any user who started a routine and stepped away before
  // finishing it. That is the root cause behind "navigation feels
  // unresponsive"/"the journey feels circular": the tap DID navigate: this
  // effect silently reverted it on the very next render.
  //
  // Fix: only force a redirect once per distinct target path (tracked in
  // the module-level lastForcedPath above), not once per pathname change.
  // This still restores the user into their in-progress step on first
  // load / refresh / right when a session starts or advances (activePath
  // actually changes), but it no longer fights a deliberate navigation
  // away from that step — it simply won't re-trigger for the same
  // activePath twice in a row. Home now offers an explicit "Continue"
  // card instead (see Home.jsx) — resuming an interrupted routine is the
  // user's choice, not something forced on every render.
  useEffect(() => {
    if (isRinging) {
      navigate('/alarm-trigger');
      return;
    }

    if (activeRoute && lastForcedPath !== activeRoute) {
      lastForcedPath = activeRoute;
      if (location.pathname !== activeRoute) {
        navigate(activeRoute);
      }
    }
  }, [isRinging, activeRoute, navigate]);

  return null;
};
