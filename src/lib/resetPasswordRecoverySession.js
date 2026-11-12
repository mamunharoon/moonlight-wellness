import { wasPasswordRecoveryLatched } from './passwordRecoveryLatch';
import { shouldTreatAsValidRecovery } from './resetPasswordAccess';

// ResetPassword.jsx's own recovery-session check, extracted so the
// web mount-timing race (a PASSWORD_RECOVERY event firing before this
// subscribes - see passwordRecoveryLatch.js's own header) can be
// reproduced and tested directly against a fake Supabase client,
// without rendering the page (this repo's Vitest has no DOM - same
// convention as nativeAuthRecovery.js's own tests).
//
// `getSession()` is used only to know when Supabase has finished
// processing the URL for a recovery token — never as proof of recovery
// itself. Any pre-existing session (anonymous or normal) must not grant
// access.
//
// The one narrow exception: a native wakewise:// recovery link, which
// never becomes window.location the way a web link does, so Supabase's
// own URL-detection here never runs and PASSWORD_RECOVERY never fires
// for it. useNativeDeepLinks.js / nativeAuthRecovery.js already fully
// validated that link (genuine type=recovery tokens) and established
// the session itself via the official setSession() API *before*
// navigating here with `recoveryVerified` in router state — state only
// reachable via our own internal navigate() call, never present in a
// URL, browser history, or anything a direct/crafted visit could set.
// Still independently re-confirm a session actually exists rather than
// trusting that flag alone.
//
// Returns the unsubscribe function, matching the cleanup contract
// ResetPassword.jsx's own effect needs to return.
export const subscribeToRecoverySession = ({ supabase, setStatus, nativeRecoveryVerified }) => {
  if (!supabase) return () => {};

  let recoveryEventFired = false;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryEventFired = true;
      setStatus('valid');
    }
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (recoveryEventFired) return;
    const valid = shouldTreatAsValidRecovery({
      recoveryEventFired,
      nativeRecoveryVerified,
      hasSession: Boolean(session),
      latchedEarlier: wasPasswordRecoveryLatched(),
    });
    setStatus((current) => (current === 'valid' ? current : valid ? 'valid' : 'invalid'));
  });

  return () => subscription.unsubscribe();
};
