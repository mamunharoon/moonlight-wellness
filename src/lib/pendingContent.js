// Guest access repair — pending-content handoff across the sign-in flow.
//
// When a guest taps a locked exercise, the requested content id and the
// exact page they were on are stashed here right before navigating to
// /auth. On successful sign-in/sign-up, Auth.jsx reads this once,
// clears it, and redirects back to that same page with the id attached
// as a query param — so the user lands back on the exact item they
// picked, with nothing auto-played (opening the player still requires
// their own Begin Exercise tap, exactly as it always has).
//
// sessionStorage, not localStorage: this is a one-shot handoff for the
// current tab's auth round-trip, not state that should persist or leak
// across tabs/devices. A 10-minute expiry guards against a stale entry
// silently redirecting a much later, unrelated sign-in.
const KEY = 'moonlight_pending_content';
const MAX_AGE_MS = 10 * 60 * 1000;

// Guest Onboarding — open-redirect guard. `returnPath` normally only ever
// comes from this same origin's own useLocation() (see every current
// caller), but it round-trips through sessionStorage as a plain string,
// so it's validated again here rather than trusted implicitly - a
// malformed or externally-influenced value must never be handed to
// navigate() as-is. A safe in-app path: starts with exactly one "/"
// (never "//", which a browser can resolve as protocol-relative to
// another host) and never contains "://" (rules out an absolute URL
// smuggled in as a "path").
export const isSafeReturnPath = (path) =>
  typeof path === 'string' &&
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.includes('://');

// `id` is optional — a routine-start prompt (e.g. Rise & Reset's Start
// Routine while signed out) has nothing to reopen, it only needs to
// return the user to `returnPath` itself; Auth.jsx only appends
// `?openId=` when an id was actually given.
export const setPendingContent = ({ id = null, returnPath }) => {
  if (!isSafeReturnPath(returnPath)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ id, returnPath, setAt: Date.now() }));
  } catch {
    // Storage unavailable — the sign-in flow still works, it just won't
    // return the user to the specific item afterward.
  }
};

// Sign-out routing fix: a pending destination (or a protected-action's
// mid-flight continuation) must never survive a sign-out and silently
// redirect whoever signs in next on this device/tab. Idempotent and
// safe to call even when nothing is pending.
export const clearPendingContent = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable - nothing to clear.
  }
};

// Reads and clears in one step — a pending redirect is only ever
// consumed once, immediately after a successful auth.
export const consumePendingContent = () => {
  let raw;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || !isSafeReturnPath(parsed.returnPath)) return null;
  if (parsed.id !== null && typeof parsed.id !== 'string') return null;
  if (typeof parsed.setAt !== 'number' || Date.now() - parsed.setAt > MAX_AGE_MS) return null;

  return { id: parsed.id ?? null, returnPath: parsed.returnPath };
};
