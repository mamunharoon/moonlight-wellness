// DEV logout / cross-user client-state audit — shared sign-out cleanup.
//
// AuthContext.signOut() cannot directly reach AudioContext's, SessionContext's,
// or AlarmContext's own React state: per App.jsx's provider tree, those three
// are all DESCENDANTS of AuthProvider, and a parent context can never consume
// a child context's hook. broadcastSignOut()/onSignOutBroadcast() is a plain
// window event so each of those providers can independently reset its own
// live in-memory state at the exact moment sign-out is invoked, without
// reordering the provider tree (its current order is deliberate — see
// App.jsx's own comments) or threading callbacks through props.
//
// Root cause this exists to fix: AuthContext.signOut() already cleared
// routine-progress/guest-entry-choice/pending-content localStorage, but
// several other things a signed-out user leaves behind were never touched
// — the live Session Engine reducer state (and its localStorage mirror),
// the legacy journeyStep tracker, active audio/video playback, and every
// other sessionStorage key this app writes. Any of these could survive
// into the very next signed-in identity on the same device (in-memory,
// same tab, no refresh required); the sessionStorage keys survive even a
// refresh, since they were never cleared from storage at all. None of
// this is server-persisted user data — clearing it removes only this
// device's local view/cache, never a row in Supabase.
//
// The two daily "did you finish today" flags (Home.jsx's own
// MORNING_DONE_KEY/EVENING_DONE_KEY) are deliberately NOT cleared here.
// An earlier version of this fix did clear them unconditionally on every
// sign-out, which stopped the cross-user leak but also erased a
// legitimately-completed registered user's own status the moment they
// signed back in later the same day. The correct fix (see
// dailyCompletion.js) is scoping each key by the current identity, not
// clearing a shared one — once every read/write is scoped, there is
// nothing left for sign-out to clear: a guest's own key was never touched
// by a registered user's completion, and a registered user's own scoped
// key must survive sign-out so it's still there when they sign back in.
const SIGN_OUT_EVENT = 'moonlight:sign-out';

export const broadcastSignOut = () => {
  try {
    window.dispatchEvent(new Event(SIGN_OUT_EVENT));
  } catch {
    // window/Event unavailable (non-browser test environment) — the
    // localStorage-level clears AuthContext.signOut() performs directly
    // are unaffected either way.
  }
};

/** Returns an unsubscribe function, matching the useEffect cleanup contract. */
export const onSignOutBroadcast = (handler) => {
  window.addEventListener(SIGN_OUT_EVENT, handler);
  return () => window.removeEventListener(SIGN_OUT_EVENT, handler);
};

// Every sessionStorage key this app itself ever writes is 'moonlight_'
// prefixed (moonlight_pending_content, moonlight_paused_exercise_*,
// moonlight_morning_intro_seen:*). This is a prefix-match sweep, never a
// blanket sessionStorage.clear(), so it can never touch an unrelated key —
// in particular devClock.js's own DEV-only __wakewise_dev_clock_offset_ms,
// which must survive a sign-out for continued manual testing.
const APP_SESSION_STORAGE_PREFIX = 'moonlight_';

export const clearAppSessionStorage = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(APP_SESSION_STORAGE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // storage unavailable — same silent-noop convention as elsewhere.
  }
};
