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

// `id` is optional — a routine-start prompt (e.g. Rise & Reset's Start
// Routine while signed out) has nothing to reopen, it only needs to
// return the user to `returnPath` itself; Auth.jsx only appends
// `?openId=` when an id was actually given.
export const setPendingContent = ({ id = null, returnPath }) => {
  if (!returnPath) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ id, returnPath, setAt: Date.now() }));
  } catch {
    // Storage unavailable — the sign-in flow still works, it just won't
    // return the user to the specific item afterward.
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

  if (!parsed || typeof parsed.returnPath !== 'string') return null;
  if (parsed.id !== null && typeof parsed.id !== 'string') return null;
  if (typeof parsed.setAt !== 'number' || Date.now() - parsed.setAt > MAX_AGE_MS) return null;

  return { id: parsed.id ?? null, returnPath: parsed.returnPath };
};
