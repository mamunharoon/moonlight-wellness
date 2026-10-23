import { isNativePlatform } from './platform';

// WakeWise password-recovery redirect targets.
//
// Fixed, approved constants only — never derived from
// window.location.origin for anything other than the explicit localhost
// developer carve-out below. window.location.origin reflects whatever
// domain is currently serving the page, which is not something a
// security-relevant redirect baked into an email link should trust:
// this repo's `dev` branch is always served from the DEV preview URL
// below, never Production, and the native app is never served over
// HTTP(S) at all (see capacitor.config.ts — no server.url).
const WEB_RESET_PASSWORD_URL_DEV_FALLBACK = 'https://wakewise-git-dev-mamun65.vercel.app/reset-password';

// Production web redirect target — read from VITE_WEB_RESET_PASSWORD_URL,
// a build-time env var set per Vercel environment, the same pattern
// VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY already use (Production
// and Preview now have their own separate values for those; this var
// follows the same split). Never a hardcoded literal here — this file has
// no way to know what Production's real domain is, and guessing one would
// risk baking in a wrong value permanently. Until Production's own value
// is actually set in Vercel, this falls back to the exact DEV preview
// constant below, preserving today's behavior rather than breaking or
// guessing — Preview/DEV builds need no new config at all for this to
// keep working exactly as before.
const WEB_RESET_PASSWORD_URL = import.meta.env.VITE_WEB_RESET_PASSWORD_URL || WEB_RESET_PASSWORD_URL_DEV_FALLBACK;
const NATIVE_RESET_PASSWORD_URL = 'wakewise://reset-password';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

// Explicit, narrow local-development rule: only an exact localhost/
// 127.0.0.1 hostname (i.e. `npm run dev`) is trusted to build its own
// redirect from the current origin, so a reset email sent while testing
// locally still comes back to the right port. Every other web hostname —
// Production, any other Preview URL, anything else — falls through to
// the one fixed WEB_RESET_PASSWORD_URL constant above instead of
// trusting whatever origin happens to be serving the page.
const isLocalhostDev = (hostname) => LOCALHOST_HOSTNAMES.has(hostname);

/**
 * The password-recovery redirect URL to pass as Supabase's `redirectTo`.
 * Accepts an optional `{ hostname, origin, native }` override purely for
 * unit testing; real callers should call it with no arguments.
 */
export const getPasswordResetRedirectUrl = ({
  hostname = typeof window !== 'undefined' ? window.location.hostname : undefined,
  origin = typeof window !== 'undefined' ? window.location.origin : undefined,
  native = isNativePlatform(),
} = {}) => {
  if (native) return NATIVE_RESET_PASSWORD_URL;
  if (hostname && isLocalhostDev(hostname) && origin) return `${origin}/reset-password`;
  return WEB_RESET_PASSWORD_URL;
};
