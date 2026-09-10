// WakeWise — Beta Video Preview — signed-URL access layer.
//
// Same pattern as stripeApi.js: calls a Supabase Edge Function via
// supabase.functions.invoke, which attaches the current session's
// access token automatically. The Edge Function
// (supabase/functions/get-beta-video-url/index.ts) is the only place
// that verifies the token and checks profiles.beta_access — this file
// enforces nothing and never touches the service role. Requested only
// when a card is opened, never eagerly for all four videos at once.
import { supabase } from './supabaseClient';

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

/**
 * Requests a short-lived signed URL for one beta exercise video.
 * @param {string} exerciseId - one of the ids in betaVideoManifest.js (e.g. 'E02')
 * @returns {Promise<{ url: string, expiresAt: number }>} expiresAt is an epoch-ms timestamp
 */
export const requestBetaVideoUrl = async (exerciseId) => {
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

export const isSignedUrlExpired = (expiresAt) => !expiresAt || Date.now() >= expiresAt;
