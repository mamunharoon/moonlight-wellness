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
 * Orchestrates handling one incoming native URL end to end — dedup,
 * classification, session establishment, and the resulting navigation
 * instruction — without performing the navigation itself, so the whole
 * decision is unit-testable without React. `useNativeDeepLinks.js` is a
 * thin wrapper supplying real dedup storage and calling navigate() with
 * whatever this returns.
 *
 * `processedUrls` is a mutable Set the caller owns (e.g. a useRef's
 * .current) — shared across both a cold-launch getLaunchUrl() result and
 * subsequent appUrlOpen events, and stable across a React Strict Mode
 * double-mount, so the same URL is only ever actually processed once.
 *
 * Returns null when nothing should happen (a duplicate, an unrecognized
 * scheme, or an allow-listed check that didn't match); otherwise
 * `{ path, options }` shaped for react-router's navigate(path, options).
 */
export const resolveIncomingUrl = async (
  url,
  { processedUrls, establishSession = establishRecoverySession, allowedPaths }
) => {
  if (processedUrls.has(url)) return null;
  processedUrls.add(url);

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
