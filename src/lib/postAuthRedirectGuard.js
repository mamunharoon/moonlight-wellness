// First-Use Welcome fix — redirect-order defect.
//
// Root cause: Auth.jsx's own redirectAfterAuth (the original Introduction
// gate) only ever runs from handleSignIn/handleSignUp's own synchronous
// success path - i.e. only when the user submitted THIS tab's Auth form
// and Supabase returned an immediate session. A normal sign-up with email
// confirmation enabled (Supabase's default) returns no session at signup
// time; when the user later opens the confirmation link, Supabase's own
// client detects the session from the URL and fires a real 'SIGNED_IN'
// event - but that event ALSO fires for perfectly ordinary session
// restoration on every page load for an already-signed-in user (confirmed
// directly in the installed @supabase/auth-js: _recoverAndRefresh's own
// default branch calls _notifyAllSubscribers('SIGNED_IN', currentSession)
// for a plain, already-valid stored session, not only for a genuinely new
// authentication) - so the raw event type alone can never safely
// distinguish "just confirmed email" from "just reloaded the page".
//
// Fix: OnboardingGate.jsx now ALSO evaluates the exact same
// shouldShowIntroduction/existing-param decision passively, from
// AuthContext's own profile once it has genuinely finished loading -
// this correctly catches BOTH the email-confirmation gap above AND
// "existing users below CURRENT_INTRODUCTION_VERSION reopening the app
// without touching the Auth form" (requirement #5), entirely for free,
// since both are just "an authenticated user whose own profile says they
// haven't seen the current Introduction yet".
//
// This flag exists only to keep OnboardingGate's passive check from ever
// double-acting on top of Auth.jsx's own synchronous redirect (which also
// knows the correct pendingJourneyIntent/pendingContent destination and
// the exact right existing=1/resume= query - information OnboardingGate's
// passive check does not have). It is a plain module-level variable,
// scoped to this one page load/tab session, matching the same established
// shape RoutineRestoreGuard.jsx's own `lastForcedPath` already uses for
// an identical "don't fight a decision another part of the app just
// made" purpose - nothing here is persisted to storage, and it resets for
// free on every genuine reload (exactly the scope this needs: "for THIS
// page load, has some component already decided what a fresh
// authentication here should do").
let handledThisPageLoad = false;

export const markPostAuthRedirectHandled = () => {
  handledThisPageLoad = true;
};

export const hasPostAuthRedirectBeenHandled = () => handledThisPageLoad;
