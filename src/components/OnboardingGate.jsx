/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasChosenGuestEntry, markGuestEntryChosen } from '../lib/guestEntry';
import { onSignOutBroadcast } from '../lib/signOutCleanup';
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
  const { user, loading } = useAuth();
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

  return children;
};
