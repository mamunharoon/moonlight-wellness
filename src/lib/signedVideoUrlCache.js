// WakeWise — Video Startup Performance — in-memory signed-URL cache.
//
// Phase 1/2 of the owner-approved startup-delay investigation (see
// reports/video-startup-performance-design-2026-11-01.md and
// reports/wakewise-media-performance-audit-2026-11-01.md). Scope: DEV
// only, read path only. This module never calls the network itself and
// never weakens the server-side check in get-beta-video-url/index.ts —
// it only avoids asking that function a question it already answered
// moments ago, for the same user and the same id, within the signed
// URL's own 5-minute Supabase-imposed lifetime. A cache hit returns
// exactly the URL the server already issued; a cache miss always falls
// through to the real network call in betaVideoAccess.js.
//
// Security/correctness properties, by construction:
//   - In-memory only (a plain Map, module-scope). Never localStorage,
//     never sessionStorage, never IndexedDB — gone on refresh/app
//     restart, matching the "no persistent storage" restriction.
//   - Keyed by (userKey, exerciseId). userKey is the signed-in user's
//     real id, or the literal string 'guest' for the three
//     GUEST_ALLOWED_IDS requested with no session at all — two different
//     users (or a user and a guest) can never read each other's entry,
//     because their keys are never equal.
//   - A cached entry can only ever be something the server already
//     agreed to sign for that exact user/id pair — this module has no
//     way to fabricate one. It is strictly a time-bounded replay of an
//     already-authorized answer, never a new authorization decision.
//   - Entitlement note: once Supabase signs a Storage URL, that URL is a
//     bearer capability valid for its own TTL (5 minutes) regardless of
//     what happens to the user's session or plan afterward — this is
//     already true with zero client-side caching at all, since the
//     Edge Function doesn't re-check on every byte range request either.
//     This cache does not create or extend that window; the longest a
//     cached entry can ever be served is exactly until `expiresAt`, the
//     same instant an uncached request's own signed URL would also stop
//     working. See the design report for the full analysis.
//   - Cleared unconditionally on sign-out (self-registered against the
//     app's existing moonlight:sign-out broadcast — see
//     signOutCleanup.js — so no other file needs to know this cache
//     exists to keep it correct) and on any observed subscription/plan
//     change (see SubscriptionContext.jsx's own small hook into
//     clearSignedVideoUrlCache, added as defense-in-depth; DEV's
//     get-beta-video-url does not currently gate on entitlement at all,
//     so this isn't fixing a live gap, just not leaving a stale-plan
//     shaped cache entry sitting around either).
import { onSignOutBroadcast } from './signOutCleanup';

const urlCache = new Map(); // `${userKey}:${exerciseId}` -> { url, expiresAt }
const inFlight = new Map(); // same key -> Promise, for request de-duplication

const cacheKey = (userKey, exerciseId) => `${userKey}:${exerciseId}`;

const isExpired = (expiresAt) => !expiresAt || Date.now() >= expiresAt;

/** Returns the cached { url, expiresAt } for this user+id, or null if absent/expired. Lazily evicts an expired entry it encounters. */
export const getCachedSignedUrl = (userKey, exerciseId) => {
  const key = cacheKey(userKey, exerciseId);
  const entry = urlCache.get(key);
  if (!entry) return null;
  if (isExpired(entry.expiresAt)) {
    urlCache.delete(key);
    return null;
  }
  return entry;
};

export const setCachedSignedUrl = (userKey, exerciseId, entry) => {
  urlCache.set(cacheKey(userKey, exerciseId), entry);
};

/** Removes exactly one entry — used after a hard failure, so a retry never trusts the same bad answer twice. */
export const invalidateCachedSignedUrl = (userKey, exerciseId) => {
  urlCache.delete(cacheKey(userKey, exerciseId));
};

/** Returns an existing in-flight promise for this user+id, if a request is already underway. */
export const getInFlightRequest = (userKey, exerciseId) => inFlight.get(cacheKey(userKey, exerciseId)) ?? null;

export const setInFlightRequest = (userKey, exerciseId, promise) => {
  const key = cacheKey(userKey, exerciseId);
  inFlight.set(key, promise);
  // Always clears itself once settled, success or failure, so a later
  // request for the same key never awaits a long-finished promise. The
  // trailing .catch(() => {}) is load-bearing, not decorative: .finally()
  // returns a new promise that adopts the original's rejection, and
  // nothing else ever holds onto that derived promise — without this it
  // surfaces as a Node "unhandled rejection" for every failed request,
  // even though the real error is already correctly propagated to (and
  // handled by) whoever called requestBetaVideoUrl in the first place.
  promise
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    })
    .catch(() => {});
};

/** Wipes every cached URL and abandons tracking of in-flight requests (a request already underway still resolves/rejects normally for whoever's awaiting it — this just stops treating it as reusable). Safe to call any number of times. */
export const clearSignedVideoUrlCache = () => {
  urlCache.clear();
  inFlight.clear();
};

// Self-registering: importing this module is enough to guarantee the
// cache is cleared on sign-out, with zero wiring required in
// AuthContext.jsx or anywhere else. Matches this codebase's own
// established pattern (AudioContext/SessionContext/AlarmContext all
// listen to this exact broadcast the same way — see
// signOutCleanup.js's header comment). Guarded for `window` the same way
// broadcastSignOut() itself is: this module (via betaVideoAccess.js) is
// imported by plain Node-environment unit tests that have no `window` at
// all, and onSignOutBroadcast() has no built-in guard of its own.
if (typeof window !== 'undefined') {
  onSignOutBroadcast(() => clearSignedVideoUrlCache());
}
