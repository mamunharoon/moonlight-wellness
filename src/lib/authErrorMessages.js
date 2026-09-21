// Structured Supabase Auth error mapping (Signup UX Remediation).
//
// Why structured codes first: @supabase/auth-js's AuthApiError carries a
// stable machine-readable `.code` (GoTrue's `error_code`, e.g.
// "weak_password") and `.status` (HTTP status) - confirmed directly against
// this project's installed 2.112.0 (node_modules/@supabase/auth-js/dist/
// main/lib/errors.js: `class AuthApiError extends AuthError { constructor
// (message, status, code) ... this.status = status; this.code = code; }`).
// Matching on `.code` survives a GoTrue wording change; the previous
// implementation matched substrings of `.message` only, which is exactly
// what silently broke down for the real "weak_password" rejection this
// task's live investigation reproduced (its message - "Password is known to
// be weak and easy to guess, please choose a different one." - matched none
// of the five hardcoded substrings and fell through to a generic message
// that gave the user no idea what was actually wrong).
//
// Message-text matching is kept only as a fallback, for any older cached
// error shape that predates a `.code` field ever being populated.

// Deliberately identical for every "no distinguishing signal available"
// outcome - a genuinely new unconfirmed signup, Supabase's own obfuscated
// duplicate-signup response (real signup with an already-registered,
// confirmed email returns HTTP 200 with a fake user object and empty
// `identities`, by GoTrue's own design, specifically to prevent account
// enumeration - confirmed live this session), and the rarer case where
// GoTrue instead returns an explicit `user_already_exists` error (only
// possible if this project's "Confirm email" setting were ever turned off).
// Never branch this copy on identities.length, the returned user id, or any
// other signal - that would silently reopen the exact enumeration hole
// GoTrue's own obfuscation exists to close.
export const NEUTRAL_NO_SESSION_MESSAGE =
  "If this email can be registered, we'll send a confirmation link. Check your inbox and spam folder. If you already have an account, sign in or reset your password.";

export const WEAK_PASSWORD_MESSAGE =
  'That password is too common or has been exposed before. Please choose a different, unique password.';

// Shown for over_email_send_rate_limit - deliberately reassuring rather
// than punitive ("we already sent it, go check" rather than "you did
// something wrong, wait"), since this fires on a perfectly legitimate
// repeated attempt just as often as on a genuine retry-too-soon.
export const EMAIL_RATE_LIMIT_MESSAGE =
  'A confirmation email may already be on its way. Check your inbox and spam folder, then wait a few minutes before trying again.';

const EMAIL_ADDRESS_INVALID_MESSAGE = 'Please enter a valid email address.';

// GoTrue's canonical error_code values (node_modules/@supabase/auth-js/src/
// lib/error-codes.ts) that this app has a specific, actionable response
// for. Anything not listed here - including real codes this SDK version
// simply doesn't enumerate yet, per that file's own header comment - falls
// through to the generic fallback below, safely.
const CODE_MESSAGES = {
  weak_password: WEAK_PASSWORD_MESSAGE,
  // validation_failed is, in this app's own signup/reset forms, only ever
  // actually reachable via the email field (password length/mismatch are
  // already fully caught client-side before any network call) - so it
  // gets the same plain, actionable copy as email_address_invalid rather
  // than a vaguer "check your details" message.
  validation_failed: EMAIL_ADDRESS_INVALID_MESSAGE,
  email_address_invalid: EMAIL_ADDRESS_INVALID_MESSAGE,
  // Deliberately reuses the exact same neutral copy as the no-session
  // success path - see NEUTRAL_NO_SESSION_MESSAGE's own comment above.
  user_already_exists: NEUTRAL_NO_SESSION_MESSAGE,
  invalid_credentials: 'The email or password you entered is incorrect.',
  email_not_confirmed: 'Please verify your email before signing in. Check your inbox for the verification link.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  over_email_send_rate_limit: EMAIL_RATE_LIMIT_MESSAGE,
  // Not one of GoTrue's own enumerated error_code values (there is no
  // dedicated "email provider failed" code as of auth-js 2.112.0) - kept
  // as a named entry anyway in case a future/self-hosted GoTrue version
  // does return it literally; the `unexpected_failure` + "email" message
  // heuristic below is what actually catches today's real SMTP-failure
  // shape.
  email_provider_error: "We couldn't send your confirmation email. Please wait a moment and try again.",
};

// Backward-compatible fallback only - matched exclusively when `.code` is
// missing or unrecognized. Order matters: first match wins.
const MESSAGE_SUBSTRING_FALLBACKS = [
  [/Invalid login credentials/, CODE_MESSAGES.invalid_credentials],
  [/User already registered/, NEUTRAL_NO_SESSION_MESSAGE],
  [/Email not confirmed/, CODE_MESSAGES.email_not_confirmed],
  [/Password should be at least/i, WEAK_PASSWORD_MESSAGE],
  [/Unable to validate email address|invalid format|Invalid email/, EMAIL_ADDRESS_INVALID_MESSAGE],
];

const OFFLINE_MESSAGE = 'You appear to be offline. Check your internet connection and try again.';
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

// The signup-specific unknown/unmapped fallback (final spec, section 3) -
// distinct from the generic FALLBACK_MESSAGE above, which stays the
// default for every other operation (sign in, forgot password, reset)
// where "create your account" would be the wrong verb entirely. Passed by
// the caller via resolveAuthError's second argument, never hardcoded here
// as the one-size-fits-all default.
export const SIGNUP_FALLBACK_MESSAGE = "We couldn't create your account right now. Please try again shortly.";

const NETWORK_ERROR_PATTERN = /Failed to fetch|NetworkError|network request failed|load failed/i;

// supabase-js wraps a genuinely offline/unreachable fetch in
// AuthRetryableFetchError (see node_modules/@supabase/auth-js/dist/main/
// lib/errors.js) rather than an AuthApiError with a GoTrue `.code` - there
// was never a server response to carry one. navigator.onLine is checked as
// a second, independent signal (undefined in non-browser test contexts,
// intentionally not asserted false there).
const isNetworkFailure = (error) => {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return NETWORK_ERROR_PATTERN.test(error.message || '');
};

// Real, observed shape for an SMTP/email-provider failure on signup: GoTrue
// returns `unexpected_failure` (its generic 500 code - no dedicated code
// exists for this) with a message mentioning email delivery. Narrow and
// heuristic on purpose - only applied when the specific `email_provider_
// error` code isn't the one actually returned.
const isEmailProviderFailure = (error) =>
  error?.code === 'unexpected_failure' && /email/i.test(error.message || '');

/**
 * Resolves a Supabase Auth error (from signUp/signInWithPassword/
 * resetPasswordForEmail/updateUser) into a safe, user-facing message plus
 * the structured code/status a caller can act on (e.g. to decide which
 * form field to attach the error to) - never HaveIBeenPwned/breach-corpus
 * internals, never the raw server response, never the password itself.
 *
 * Reads `error.code`/`error.status` defensively (`?? null`) rather than
 * assuming either is always present - confirmed against the installed
 * @supabase/auth-js 2.112.0 that every real AuthApiError does carry both
 * (see the module comment above), but a non-Auth-js error (or a future
 * SDK version) is never assumed to.
 *
 * `fallbackMessage` lets a caller supply an operation-appropriate generic
 * message (e.g. signup's own SIGNUP_FALLBACK_MESSAGE) instead of the
 * default FALLBACK_MESSAGE - only used when nothing else matched.
 *
 * `isUnknown` is true only when neither a recognized `.code` nor a
 * recognized message substring matched - i.e. exactly the case
 * `logAuthDiagnostic` below should record for follow-up.
 */
export const resolveAuthError = (error, { fallbackMessage = FALLBACK_MESSAGE } = {}) => {
  if (!error) return { message: '', code: null, status: null, isUnknown: false };

  const code = error.code ?? null;
  const status = error.status ?? null;

  if (isNetworkFailure(error)) {
    return { message: OFFLINE_MESSAGE, code, status, isUnknown: false };
  }

  if (code && CODE_MESSAGES[code]) {
    return { message: CODE_MESSAGES[code], code, status, isUnknown: false };
  }

  if (isEmailProviderFailure(error)) {
    return { message: CODE_MESSAGES.email_provider_error, code, status, isUnknown: false };
  }

  const msg = error.message || '';
  for (const [pattern, text] of MESSAGE_SUBSTRING_FALLBACKS) {
    if (pattern.test(msg)) return { message: text, code, status, isUnknown: false };
  }

  return { message: fallbackMessage, code, status, isUnknown: true };
};

// True for GoTrue's real `user_already_exists` code, and for the legacy
// "User already registered" message text some older/self-hosted GoTrue
// deployments still return - both route to the same enumeration-safe
// neutral outcome as a genuine no-session success, never a distinct
// "this email is taken" message.
export const isAccountAlreadyExistsError = (error) =>
  Boolean(error) && (error.code === 'user_already_exists' || /User already registered/.test(error.message || ''));

export const isWeakPasswordError = (error) =>
  Boolean(error) && (error.code === 'weak_password' || /Password should be at least|weak and easy to guess/i.test(error.message || ''));

export const isEmailRateLimitError = (error) =>
  Boolean(error) && (error.code === 'over_email_send_rate_limit' || /email.*rate.?limit|rate.?limit.*email/i.test(error.message || ''));

/**
 * Diagnostic logging for the one case actually worth a developer's
 * attention: an error this app has no specific copy for. Logs exactly
 * three fields - the calling operation's name, the structured code, and
 * the HTTP status - and nothing else. Never called with, and never reads,
 * an email address, password, token, raw Auth response body, or any other
 * personal/user metadata.
 */
export const logAuthDiagnostic = (operation, resolved) => {
  if (!resolved?.isUnknown) return;
  console.warn('[auth]', operation, { code: resolved.code ?? 'unknown', status: resolved.status ?? null });
};
