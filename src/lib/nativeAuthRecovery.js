import { supabase } from './supabaseClient';

// WakeWise iOS Native Password Recovery.
//
// This project's installed @supabase/supabase-js (2.112.0) uses GoTrue's
// default flowType: 'implicit' (supabaseClient.js passes no auth options
// at all, so every default applies) — recovery links carry
// `#access_token=...&refresh_token=...&type=recovery` in the URL
// *fragment*, not a `?code=...` PKCE query param. That default is what
// already makes the web /reset-password flow work today (the browser's
// own window.location naturally contains the hash on page load, which
// Supabase's client auto-detects at init). None of that applies inside
// the native app: a wakewise:// URL delivered via appUrlOpen/getLaunchUrl
// never becomes window.location in the WebView, so Supabase's own
// URL-detection and PASSWORD_RECOVERY event never fire for it — this
// module is what has to take its place, using the same tokens but the
// official supabase.auth.setSession() API instead.

const RECOVERY_PATH = 'reset-password';
const RECOVERY_TYPE = 'recovery';

const resolvePath = (parsedUrl) =>
  (parsedUrl.hostname || parsedUrl.pathname.replace(/^\/+/, '')).toLowerCase();

// Recovery tokens live in the URL fragment for this project's (implicit)
// flow; the query string is checked too only as a harmless fallback —
// nothing about this app's configuration expects tokens there.
const extractAuthParams = (parsedUrl) => {
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const searchParams = parsedUrl.searchParams;
  const get = (key) => hashParams.get(key) ?? searchParams.get(key);
  return {
    access_token: get('access_token'),
    refresh_token: get('refresh_token'),
    type: get('type'),
  };
};

/**
 * Parses and classifies a native wakewise:// URL. Pure — never navigates,
 * never touches Supabase, never throws (a malformed URL resolves to
 * `{ kind: 'invalid' }`). This is the single place that decides whether a
 * URL is an approved WakeWise recovery link; nothing else in the app
 * should independently re-derive that judgment.
 *
 * - `{ kind: 'invalid' }` — unknown scheme or unparseable URL. Reject
 *   silently (caller should not navigate anywhere).
 * - `{ kind: 'other', path, search }` — a wakewise:// URL whose path is
 *   not reset-password (e.g. the existing `auth` deep link). Caller
 *   handles via its own generic allow-list.
 * - `{ kind: 'incomplete-recovery' }` — path is reset-password but the
 *   payload is missing, malformed, or not actually type=recovery (a
 *   stale link, a manually-typed bare URL, or a non-recovery auth link
 *   presented at this path). Safe to route to /reset-password — its
 *   existing "invalid or expired" state handles this with no session
 *   ever established.
 * - `{ kind: 'recovery', access_token, refresh_token }` — a genuine,
 *   complete recovery payload. Caller must still call
 *   establishRecoverySession() and only treat it as valid on success.
 */
export const classifyNativeAuthUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Deliberately silent: a thrown URL-parse Error can embed the raw,
    // offending string in its own message on some engines, and this
    // input may contain a partially-formed token payload — never log it.
    return { kind: 'invalid' };
  }
  if (parsed.protocol !== 'wakewise:') return { kind: 'invalid' };

  const path = resolvePath(parsed);
  if (path !== RECOVERY_PATH) {
    return { kind: 'other', path, search: parsed.search };
  }

  const { access_token, refresh_token, type } = extractAuthParams(parsed);
  if (type !== RECOVERY_TYPE || !access_token || !refresh_token) {
    return { kind: 'incomplete-recovery' };
  }
  return { kind: 'recovery', access_token, refresh_token };
};

/**
 * Establishes the Supabase session from a validated recovery URL's
 * tokens via the official setSession() API. Returns true only once a
 * real session is confirmed established; never throws. Never logs the
 * tokens themselves — only a generic failure message on error.
 */
export const establishRecoverySession = async ({ access_token, refresh_token }) => {
  try {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    return Boolean(data?.session) && !error;
  } catch (error) {
    console.warn('[nativeAuthRecovery] failed to establish recovery session:', error?.message);
    return false;
  }
};

/**
 * Decides what should happen for one incoming native URL — classification,
 * session establishment, and the resulting navigation instruction —
 * without performing the navigation itself and without any dedup of its
 * own (see createRecoveryUrlDeduper below, which wraps this). Pure enough
 * to unit-test directly with a fake `establishSession`.
 *
 * Returns null when there's nothing to do (an unrecognized scheme, or an
 * allow-listed check that didn't match); otherwise `{ path, options }`
 * shaped for react-router's navigate(path, options).
 */
export const resolveIncomingUrl = async (
  url,
  { establishSession = establishRecoverySession, allowedPaths }
) => {
  const classification = classifyNativeAuthUrl(url);

  if (classification.kind === 'recovery') {
    const ok = await establishSession(classification);
    // Never carry tokens into the visible route — only an in-memory
    // router-state flag, which is not part of the URL, browser history,
    // or any persisted storage.
    return {
      path: '/reset-password',
      options: { replace: true, state: ok ? { recoveryVerified: true } : undefined },
    };
  }

  if (classification.kind === 'incomplete-recovery') {
    // Path says reset-password but the payload wasn't a genuine,
    // complete recovery link — still route there so its existing
    // "invalid or expired" state handles it; no session is established.
    return { path: '/reset-password', options: { replace: true } };
  }

  if (classification.kind === 'other' && allowedPaths.has(classification.path)) {
    return { path: `/${classification.path}${classification.search}`, options: undefined };
  }

  return null;
};

const hasSubtleCrypto = () =>
  typeof crypto !== 'undefined' && typeof crypto.subtle?.digest === 'function';

const sha256Hex = async (input) => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Non-cryptographic fallback (FNV-1a), used only if Web Crypto's
// subtle.digest is genuinely unavailable in this WebView/browser. Still
// token-free — the input string cannot be recovered from the numeric
// output — just not collision-resistant against a deliberate adversary.
// That distinction doesn't matter here: this fingerprint only ever backs
// a same-process, in-memory dedup guard, never anything compared against
// untrusted input or persisted beyond the running app session, so this
// is an "equally safe token-free identifier" for that narrow purpose.
const fnv1aHex = (input) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

/**
 * A one-way, token-free fingerprint of a URL — used for dedup storage
 * instead of ever retaining the URL (and, for a recovery link, its
 * access/refresh tokens) itself. Prefers the standard Web Crypto
 * SubtleCrypto SHA-256 digest; falls back to a non-cryptographic hash
 * only if that API is unavailable. Never throws.
 */
export const fingerprintUrl = async (url) => {
  if (hasSubtleCrypto()) {
    try {
      return await sha256Hex(url);
    } catch {
      // fall through to the sync fallback below
    }
  }
  return fnv1aHex(url);
};

/**
 * Creates a dedup guard for incoming native URLs. Never retains a raw URL
 * or its tokens longer than the brief window needed to process it:
 *
 * - Concurrent calls for the *same* URL (e.g. a cold-launch getLaunchUrl()
 *   result and an appUrlOpen event both firing for it) share one in-flight
 *   promise, keyed transiently by the raw URL string in a plain Map — the
 *   synchronous has()/set() pair around that Map is what makes this
 *   race-safe, since two "concurrent" JS calls can never interleave
 *   between them. That Map entry (the only place a raw URL/token is ever
 *   held beyond a single function call's local variables) is deleted the
 *   instant that call settles, success or failure.
 * - The only state that outlives a single call is a Set of one-way
 *   fingerprints (see fingerprintUrl) — never the URLs or tokens
 *   themselves — so a URL already handled earlier in the app session
 *   (even well after its in-flight entry above is long gone) is still
 *   correctly recognised as a duplicate and not reprocessed.
 * - A URL is marked processed (fingerprint recorded) once `work()`
 *   *resolves* — whether its resolved value represents success or a
 *   deliberate soft failure (e.g. resolveIncomingUrl() having already
 *   tried and failed to establish a session for an expired/reused/
 *   invalid token). Retrying the *identical* URL client-side cannot
 *   change that server-side outcome, and the existing "invalid or
 *   expired" screen's "request a new link" path is the correct recovery
 *   action, which produces a *new* URL (new tokens, new fingerprint)
 *   that this guard will happily process fresh. This is a deliberate
 *   choice, not an oversight. If `work()` instead *throws* (an
 *   unexpected error, not a normal recovery outcome), the fingerprint is
 *   deliberately NOT recorded, so a genuine crash/bug doesn't
 *   permanently blackhole an otherwise-valid link — a caller may retry.
 */
export const createRecoveryUrlDeduper = () => {
  const inFlight = new Map(); // raw url -> Promise, transient only
  const processedFingerprints = new Set(); // long-lived, token-free

  const runOnce = async (url, work) => {
    const fingerprint = await fingerprintUrl(url);
    if (processedFingerprints.has(fingerprint)) return null;
    const result = await work();
    processedFingerprints.add(fingerprint);
    return result;
  };

  const processOnce = (url, work) => {
    const existing = inFlight.get(url);
    if (existing) return existing;

    const promise = runOnce(url, work).finally(() => {
      inFlight.delete(url);
    });
    inFlight.set(url, promise);
    return promise;
  };

  return { processOnce, processedFingerprints };
};
