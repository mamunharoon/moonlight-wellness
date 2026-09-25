/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasChosenGuestEntry, markGuestEntryChosen } from '../lib/guestEntry';
import { onSignOutBroadcast } from '../lib/signOutCleanup';
import { shouldRedirectToIntroduction, buildIntroductionRedirectPath } from '../lib/introductionVersion';
import { hasPostAuthRedirectBeenHandled, markPostAuthRedirectHandled } from '../lib/postAuthRedirectGuard';
import { consumePendingJourneyIntent, resolveJourneyResumeTarget } from '../lib/pendingJourneyIntent';
import { Welcome } from '../pages/Welcome';

/*
 * Guest Onboarding — OnboardingGate
 *
 * Wraps the app's whole <Routes> tree in App.jsx. Shows the Welcome
 * screen instead of any route when there is no authenticated session AND
 * the user has never chosen "Continue as Guest" on this device — and
 * never otherwise. Deliberately does NOT redirect to /auth on its own;
 * Welcome is what's shown, and Welcome itself is the only thing that
 * ever navigates to /auth, on an explicit tap.
 *
 * `loading` (AuthContext's own getSession()-in-flight flag) is checked
 * first and unconditionally short-circuits to a bare loading screen —
 * same "Checking access…" pattern AdminRoute.jsx already uses — so an
 * already-signed-in user restoring their session on a fresh page load
 * never flashes the Welcome screen while Supabase is still resolving.
 *
 * ALLOWED_PRE_ENTRY_PATHS exists only so Welcome's own "Sign In"/"Create
 * Free Account" buttons (and the sign-up form's Terms/Privacy links) can
 * still navigate somewhere real — those specific routes render normally
 * even before a guest choice is made; nothing else does. A native deep
 * link or notification tap landing on any other unauthenticated route
 * still resolves to Welcome first, exactly like a fresh cold launch.
 */
const ALLOWED_PRE_ENTRY_PATHS = new Set([
  '/auth',
  '/reset-password',
  '/settings/terms-of-service',
  '/settings/privacy-policy'
]);

export const OnboardingGate = ({ children }) => {
  const { user, loading, isGuest, profile, profileLoading, profileError } = useAuth();
  const location = useLocation();
  // First-use welcome screen (Build 16) — a brand-new guest (never chosen
  // guest entry on this device before) is sent straight to /introduction
  // (rewritten for this purpose, see its own doc comment) the moment
  // "Continue as Guest" is tapped below, mirroring how a brand-new
  // registered user already sees it once via Auth.jsx's own
  // redirectAfterAuth. A plain imperative navigate() call inside that
  // same click handler - not a ref/state flag consumed on a later render
  // (React's react-hooks/refs rule forbids reading/writing a ref during
  // render, and a state flag would need its own reset-after-use effect
  // with real ordering risk) - so there is nothing to persist, expire, or
  // accidentally re-trigger on a later render; the location itself is
  // simply already correct by the time `children` (the real <Routes>
  // tree) renders on the very next render this same click causes.
  const navigate = useNavigate();
  const [guestEntryChosen, setGuestEntryChosen] = useState(hasChosenGuestEntry);

  // Logout / cross-user client-state audit — root cause of "sign out
  // doesn't return to Welcome": this state was only ever read from
  // localStorage once, at this component's own initial mount. Since
  // OnboardingGate wraps the whole app and never unmounts across a
  // sign-out (App.jsx renders it once, above <Routes>), a device that had
  // EVER chosen "Continue as Guest" during this page load kept
  // guestEntryChosen stuck at true — so AuthContext.signOut()'s own
  // clearGuestEntryChoice() correctly wiped the localStorage flag, but
  // this already-mounted instance never found out, needsWelcome stayed
  // false, and the signed-out user landed back on Home as an implicit
  // guest instead of Welcome, complete with whatever stale local state
  // was still sitting there. Explicitly re-synced to false at the exact
  // moment sign-out is invoked, matching guestEntry.js's own documented
  // intent ("the next person on this device... sees the welcome screen
  // fresh").
  useEffect(() => {
    return onSignOutBroadcast(() => setGuestEntryChosen(false));
  }, []);

  // Pending journey intent survives authentication (item 8) — same
  // redirect-order gap as the Introduction check below: a guest who taps
  // "Start my morning"/"Wind down for sleep", signs up, and confirms their
  // email never passes through Auth.jsx's own synchronous redirectAfterAuth
  // (which is the ONLY other place resolveJourneyResumeTarget/
  // consumePendingJourneyIntent are read) - without this, the intent would
  // silently expire (pendingJourneyIntent.js's own 10-minute TTL) or simply
  // never be read at all. hasCheckedJourneyIntentRef guards this to run
  // AT MOST ONCE per app lifetime (OnboardingGate mounts once for the
  // whole app - see this file's own top comment) - consumePendingJourneyIntent
  // reads-and-clears in one step, so this must never run twice regardless
  // of render timing; a ref (checked/set inside the effect body, never
  // during render) is what guarantees that, matching Introduction.jsx's
  // own hasResumedRef for the identical one-shot-resume shape. Ordinary
  // sign-in via the Auth form already consumed the intent synchronously
  // (and called markPostAuthRedirectHandled) before this effect ever gets
  // a chance to run - consumePendingJourneyIntent() here then correctly
  // finds nothing and this is a harmless no-op.
  const hasCheckedJourneyIntentRef = useRef(false);
  useEffect(() => {
    if (loading || hasCheckedJourneyIntentRef.current) return;
    if (!user || isGuest) return;
    hasCheckedJourneyIntentRef.current = true;
    const journeyTarget = resolveJourneyResumeTarget(consumePendingJourneyIntent());
    if (journeyTarget) {
      markPostAuthRedirectHandled();
      navigate(journeyTarget, { replace: true });
    }
  }, [loading, user, isGuest, navigate]);

  // Redirect-order defect fix — Auth.jsx's own redirectAfterAuth only ever
  // runs from a synchronous handleSignIn/handleSignUp success path (an
  // immediate session). It never runs for a session established any other
  // way: a normal sign-up with email confirmation (Supabase's default,
  // where the initial signUp() call returns no session at all) whose
  // confirmation link is opened later, or an existing account below
  // CURRENT_INTRODUCTION_VERSION simply reopening the app with an already-
  // valid stored session - neither ever touches the Auth form in this
  // session, so nothing else in the app would ever show them Introduction.
  // This passive check catches both, purely from AuthContext's own
  // already-loaded profile - the exact same shouldShowIntroduction
  // decision, just evaluated here instead of only inside a click handler.
  //
  // hasPostAuthRedirectBeenHandled() defers to Auth.jsx's own redirect
  // whenever it already ran (it knows the correct pendingJourneyIntent/
  // pendingContent/existing=1/resume= destination, which this passive
  // check does not) - see postAuthRedirectGuard.js's own doc comment.
  // location.pathname !== '/introduction' stops this from ever re-firing
  // once the user is already there. No further guard is needed beyond
  // that: completing/skipping/choosing a destination writes
  // introduction_completed_version and refreshes `profile`, which makes
  // shouldShowIntroduction false and this check permanently inert for
  // that account until the version is next bumped.
  const needsIntroductionRedirect = shouldRedirectToIntroduction({
    user,
    isGuest,
    profile,
    profileLoading,
    profileError,
    pathname: location.pathname,
    alreadyHandled: hasPostAuthRedirectBeenHandled()
  });

  // The flag write is a side effect (mutates module state outside React) -
  // it belongs in an effect, never directly during render, so a render
  // that never commits can never mark this handled without actually
  // having redirected.
  useEffect(() => {
    if (needsIntroductionRedirect) markPostAuthRedirectHandled();
  }, [needsIntroductionRedirect]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant text-sm">
        Loading…
      </div>
    );
  }

  const isAllowedPreEntryPath = ALLOWED_PRE_ENTRY_PATHS.has(location.pathname);
  const needsWelcome = !user && !guestEntryChosen && !isAllowedPreEntryPath;

  if (needsWelcome) {
    return (
      <Welcome
        onContinueAsGuest={() => {
          markGuestEntryChosen();
          setGuestEntryChosen(true);
          // `?auto=1` marks this as an automatic first-use visit, same
          // marker/rationale as Auth.jsx's own redirectAfterAuth - see
          // Introduction.jsx's own doc comment.
          navigate('/introduction?auto=1', { replace: true });
        }}
      />
    );
  }

  if (needsIntroductionRedirect) {
    return <Navigate to={buildIntroductionRedirectPath(profile)} replace />;
  }

  return children;
};
