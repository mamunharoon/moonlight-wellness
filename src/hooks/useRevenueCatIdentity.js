// WakeWise Phase 2B — RevenueCat identity lifecycle.
//
// The one place RevenueCat's own App User ID is ever set. Always the
// authenticated Supabase user's UUID — never an email, display name,
// device identifier, or locally generated id (per this phase's explicit
// requirement). Mirrors this codebase's own established
// "AuthContext.signOut() cannot reach a descendant provider's state
// directly, so a plain window event lets each one react independently"
// pattern (see signOutCleanup.js's own header comment) — this hook reacts
// to the same broadcastSignOut() event AudioContext/SessionContext/
// AlarmContext already listen for, so RevenueCat's identity is cleared at
// the exact same moment as everything else, not on some later render.
//
// Race-safety: a ref (not state) tracks which Supabase user id RevenueCat
// was last logged in as, checked and updated synchronously inside the
// effect body — never during render — so a re-render caused by an
// unrelated state change can never trigger a duplicate logIn() call for
// the same user, and an account switch (userId changes from one real
// value to a different real value, without an intervening sign-out —
// not possible via this app's own UI today, but not assumed impossible
// here) always logs out the previous identity before logging in the new
// one, never the reverse order.
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { onSignOutBroadcast } from '../lib/signOutCleanup';
import {
  configureRevenueCat,
  logInRevenueCat,
  logOutRevenueCat,
  isRevenueCatSupported
} from '../lib/revenueCatAdapter';

export const useRevenueCatIdentity = () => {
  const { user, loading, isGuest } = useAuth();
  const loggedInUserIdRef = useRef(null);

  // Sign-out: clear the RevenueCat identity at the same synchronous
  // moment every other context resets, not whenever this hook's own next
  // render happens to notice `user` became null.
  useEffect(() => {
    return onSignOutBroadcast(() => {
      if (!isRevenueCatSupported()) return;
      loggedInUserIdRef.current = null;
      logOutRevenueCat();
    });
  }, []);

  useEffect(() => {
    if (!isRevenueCatSupported()) return;
    // Wait for AuthContext's own getSession()/onAuthStateChange to settle
    // before acting on `user` at all — acting on a transient
    // "not yet loaded" state is exactly the startup race this phase warns
    // against.
    if (loading) return;

    let cancelled = false;

    const sync = async () => {
      if (isGuest || !user) {
        // Guest/anonymous state, handled explicitly (not merely "do
        // nothing"): if a previous identity is still logged in from a
        // just-completed sign-out this hook hasn't processed yet, log it
        // out. Never configures or logs in as any kind of guest identity
        // — RevenueCat's own anonymous id (generated internally once
        // configure() has run) is exactly what should represent a guest,
        // never a WakeWise-generated substitute.
        if (loggedInUserIdRef.current) {
          loggedInUserIdRef.current = null;
          await logOutRevenueCat();
        }
        return;
      }

      if (loggedInUserIdRef.current === user.id) return; // already correct — no-op

      // Account switch: a different real user id was previously logged
      // in. Log out first so the previous identity's cached entitlement
      // can never be momentarily attributed to the new user.
      if (loggedInUserIdRef.current && loggedInUserIdRef.current !== user.id) {
        await logOutRevenueCat();
      }

      const configureResult = await configureRevenueCat(user.id);
      if (cancelled) return;

      if (configureResult.outcome === 'configured') {
        loggedInUserIdRef.current = user.id;
        return;
      }
      // configure() had already run in an earlier session/render (e.g.
      // React StrictMode double-invoke, or a resumed session) — log in
      // explicitly rather than assuming configure() alone identified us.
      const loginResult = await logInRevenueCat(user.id);
      if (cancelled) return;
      if (loginResult.outcome === 'logged-in') {
        loggedInUserIdRef.current = user.id;
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
  }, [user, loading, isGuest]);
};
