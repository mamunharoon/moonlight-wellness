/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasChosenGuestEntry, markGuestEntryChosen } from '../lib/guestEntry';
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
  const [guestEntryChosen, setGuestEntryChosen] = useState(hasChosenGuestEntry);

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
        }}
      />
    );
  }

  return children;
};
