import { supabase } from './supabaseClient';

// Web password-recovery mount-timing race, fix 2 of 2 (see App.jsx's own
// doc comment on ResetPassword no longer being lazy-loaded for fix 1).
// Traced via PROD Supabase Auth logs: a real recovery-link click
// produced a successful /verify + session, yet the page still showed
// "invalid or expired" - Supabase's one-time PASSWORD_RECOVERY event had
// already fired, and nothing was listening yet. Making ResetPassword a
// static import closes the most common cause (an extra lazy-chunk fetch
// delaying when its own effect subscribes) but the underlying race is
// about EVENT-vs-SUBSCRIPTION ordering, not bundling strategy - nothing
// guarantees React's effect-commit phase always wins against Supabase's
// own async hash-processing on every device/network condition.
//
// This module closes the race itself rather than just narrowing it: it
// subscribes at its own top level, so it is evaluated the moment
// anything first imports it - main.jsx does so before rendering
// anything at all (see its own comment) - which is earlier than any
// component's effect can possibly run, lazy-loaded or not. A missed
// live event is latched here instead of being lost.
//
// Security invariant, unchanged: this latches ONLY a genuine
// PASSWORD_RECOVERY event, never a plain session - an ordinary signed-in
// visitor can never set it, exactly as resetPasswordAccess.js's own
// header already requires of the live-event check this augments.
//
// Carry-over fix — this is a plain module-level flag that otherwise
// lives for the entire tab's JS runtime, not just one page load. Left
// as a simple set-and-read boolean, a single successful recovery would
// stay readable as `true` forever afterward in that same tab: a
// completed reset, a sign-out, or signing in as a different account
// (this app's own switch-accounts path always signs out first - see
// AuthContext.jsx's signOut()) could all silently inherit someone
// else's already-used recovery grant with no new link ever clicked.
// Closed two ways: wasPasswordRecoveryLatched() below consumes the flag
// on read (mirrors the underlying Supabase recovery token's own
// single-use design - once ResetPassword has read a `true` latch to
// show the form, that latch has done its one job), and a SIGNED_OUT
// event clears it outright, for the narrower case where it latched but
// was never actually read (e.g. ResetPassword never mounted to consume
// it) before the tab moved on to a different session.
let recoveryEventLatched = false;

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryEventLatched = true;
    } else if (event === 'SIGNED_OUT') {
      recoveryEventLatched = false;
    }
  });
}

export const wasPasswordRecoveryLatched = () => {
  const latched = recoveryEventLatched;
  recoveryEventLatched = false;
  return latched;
};

// Test-only reset - lets tests that re-import this module via
// vi.resetModules() start from a clean latch instead of leaking state
// across cases. Never called from application code.
export const _resetPasswordRecoveryLatchForTests = () => {
  recoveryEventLatched = false;
};
