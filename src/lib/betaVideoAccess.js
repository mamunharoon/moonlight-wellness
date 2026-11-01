// WakeWise — Beta Video Preview — signed-URL access layer.
//
// Same pattern as stripeApi.js: calls a Supabase Edge Function via
// supabase.functions.invoke, which attaches the current session's
// access token automatically. The Edge Function
// (supabase/functions/get-beta-video-url/index.ts) is the only place
// that verifies the token and checks profiles.beta_access — this file
// enforces nothing and never touches the service role. Requested only
// when a card is opened, never eagerly for all four videos at once.
//
// Video startup performance (2026-11-01, DEV only) — a short-lived,
// in-memory cache (signedVideoUrlCache.js) now sits in front of the
// network call: re-opening the same video, for the same user, within
// the signed URL's own 5-minute window, returns the already-issued URL
// with zero network round trip, instead of re-asking a question the
// server already answered. This changes nothing about WHO can get a
// URL — every cache hit is strictly a replay of an answer the server
// itself already gave for this exact user+id — see
// signedVideoUrlCache.js's own header comment for the full security
// analysis, and reports/video-startup-performance-design-2026-11-01.md
// for the design writeup.
import { supabase } from './supabaseClient';
import {
  getCachedSignedUrl,
  setCachedSignedUrl,
  invalidateCachedSignedUrl,
  getInFlightRequest,
  setInFlightRequest
} from './signedVideoUrlCache';

// Mirrors the Edge Function's own expiry (5 minutes) so the UI can
// proactively refresh before playback would 403 mid-stream, without
// guessing at a different number.
export const SIGNED_URL_TTL_SECONDS = 300;

export class BetaVideoAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BetaVideoAccessError';
    this.code = code; // 'unauthorized' | 'forbidden' | 'not_found' | 'network' | 'unknown'
  }
}

// Maps whatever supabase-js hands back (a FunctionsHttpError with a
// response, a FunctionsFetchError for a network failure, or something
// else) to one of the codes BetaVideoModal.jsx renders a distinct state
// for. Falls back to 'unknown' rather than assuming a shape that isn't
// there.
const toAccessError = async (error) => {
  const status = error?.context?.status;
  if (status === 401) return new BetaVideoAccessError('unauthorized', 'Please sign in to watch this preview.');
  if (status === 403) return new BetaVideoAccessError('forbidden', "You don't have access to this beta preview.");
  if (status === 404) return new BetaVideoAccessError('not_found', "This video isn't available right now.");
  if (status) return new BetaVideoAccessError('unknown', 'Something went wrong loading this video.');
  return new BetaVideoAccessError('network', "Couldn't reach the server. Check your connection and try again.");
};

// The cache is scoped per signed-in user (never shared across accounts
// or with a guest) using the id supabase-js already holds in memory —
// getSession() here is a local read of the current client state, not a
// network call, so this adds no latency of its own. 'guest' is a
// literal, deliberately non-UUID string so it can never collide with a
// real user id.
const resolveUserKey = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? 'guest';
};

const invokeSignedUrlRequest = async (exerciseId) => {
  const { data, error } = await supabase.functions.invoke('get-beta-video-url', {
    body: { exerciseId }
  });
  if (error) throw await toAccessError(error);
  if (!data?.url) throw new BetaVideoAccessError('unknown', 'No video URL returned.');
  return {
    url: data.url,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000
  };
};

/**
 * Requests a short-lived signed URL for one beta exercise video. Served
 * from the in-memory cache when a still-valid entry exists for the
 * current user and this exact id; otherwise requests a fresh one from
 * the Edge Function (and caches the result). Concurrent calls for the
 * same user+id share a single in-flight request rather than firing two.
 * A single transient 401 (e.g. a token refresh landing a moment too
 * late) is retried exactly once with a fresh, uncached request before
 * giving up.
 * @param {string} exerciseId - one of the ids in betaVideoManifest.js (e.g. 'E02')
 * @returns {Promise<{ url: string, expiresAt: number }>} expiresAt is an epoch-ms timestamp
 */
export const requestBetaVideoUrl = async (exerciseId) => {
  const userKey = await resolveUserKey();

  const cached = getCachedSignedUrl(userKey, exerciseId);
  if (cached) return cached;

  const existing = getInFlightRequest(userKey, exerciseId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const result = await invokeSignedUrlRequest(exerciseId);
      setCachedSignedUrl(userKey, exerciseId, result);
      return result;
    } catch (e) {
      if (e instanceof BetaVideoAccessError && e.code === 'unauthorized') {
        invalidateCachedSignedUrl(userKey, exerciseId);
        // One retry only — a fresh request, not a second cache check
        // (there was never a cache hit on this path to begin with).
        const retried = await invokeSignedUrlRequest(exerciseId);
        setCachedSignedUrl(userKey, exerciseId, retried);
        return retried;
      }
      throw e;
    }
  })();

  setInFlightRequest(userKey, exerciseId, promise);
  return promise;
};

export const isSignedUrlExpired = (expiresAt) => !expiresAt || Date.now() >= expiresAt;
