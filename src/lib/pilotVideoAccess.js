// WakeWise — Fast Start pilot — signed-URL access layer.
//
// DEV-only, approved for controlled DEV deployment. Sibling to
// betaVideoAccess.js, kept deliberately separate: calls the (also
// DEV-only) get-pilot-video-url function, never get-beta-video-url.
// Delete this file to remove the pilot cleanly — nothing else imports it
// except FastStartPilot.jsx.
import { supabase } from './supabaseClient';

export const PILOT_SIGNED_URL_TTL_SECONDS = 180;

export class PilotVideoAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PilotVideoAccessError';
    this.code = code; // 'unauthorized' | 'forbidden' | 'not_found' | 'network' | 'unknown'
  }
}

const toAccessError = async (error) => {
  const status = error?.context?.status;
  if (status === 401) return new PilotVideoAccessError('unauthorized', 'Please sign in.');
  if (status === 403) return new PilotVideoAccessError('forbidden', 'Admin access required for the Fast Start pilot.');
  if (status === 404) return new PilotVideoAccessError('not_found', "This pilot video isn't available right now.");
  if (status) return new PilotVideoAccessError('unknown', 'Something went wrong loading this video.');
  return new PilotVideoAccessError('network', "Couldn't reach the server. Check your connection and try again.");
};

/**
 * @param {string} pilotId - one of 'I01-original' | 'I01-faststart' | 'A01-original' |
 *   'A01-faststart' | 'SL01-original' | 'SL01-faststart'
 * @returns {Promise<{ url: string, expiresAt: number }>}
 */
export const requestPilotVideoUrl = async (pilotId) => {
  const { data, error } = await supabase.functions.invoke('get-pilot-video-url', {
    body: { pilotId }
  });

  if (error) throw await toAccessError(error);
  if (!data?.url) throw new PilotVideoAccessError('unknown', 'No video URL returned.');

  return {
    url: data.url,
    expiresAt: Date.now() + PILOT_SIGNED_URL_TTL_SECONDS * 1000
  };
};
