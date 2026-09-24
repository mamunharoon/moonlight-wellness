// Preserving a non-media journey intent through authentication.
//
// The existing pendingContent.js mechanism (setPendingContent/
// consumePendingContent) is built around REOPENING a specific piece of
// media by id, at an arbitrary-but-validated returnPath - correct for
// "a guest tapped a locked video/exercise", wrong for "a guest tapped
// Welcome's Start my morning / Wind down for sleep", where there is no
// media id to reopen and the actual destination is a real, stateful
// ACTION (Session Engine initialization), not a navigable URL. Reusing
// pendingContent's id-less shape (returnPath: '/') for that case, as
// this app initially did, loses the user's selected journey: they land
// back on Home having to tap Morning/Evening again themselves.
//
// This module is the fix: a SEPARATE, narrower mechanism carrying only a
// fixed, allowlisted action id ('morning' | 'sleep') - never a
// caller-supplied URL, never an arbitrary string. Auth.jsx's
// redirectAfterAuth consumes it (see resolveJourneyResumeTarget) and
// sends the user to a route that performs the REAL action itself
// (Introduction.jsx's own resume-effect, calling the exact same
// beginRiseAndReset/CARD_DESTINATIONS functions a real tap would) -
// never a route baked directly into this module, and never something
// this module executes on its own.
//
// Same sessionStorage/TTL/read-once-and-clear shape as pendingContent.js
// (one-shot handoff for the current tab's auth round-trip, not
// persistent state) - a DIFFERENT key, so the two mechanisms can never
// collide or be confused for one another, and so a stale entry from one
// can never be misread as the other. The 'moonlight_' prefix means
// clearAppSessionStorage() (called on every sign-out, see
// signOutCleanup.js) already sweeps this key automatically - no separate
// sign-out wiring needed here.
const KEY = 'moonlight_pending_journey_intent';
const MAX_AGE_MS = 10 * 60 * 1000;

// The one, fixed allowlist. Both the write side and the read side
// validate against this exact Set - an unrecognised action is never
// stored, and a tampered/unexpected value already in storage is never
// trusted back out.
//
// 'sleep', not 'evening' - deliberately matching WELCOME_CARDS' own real
// `id: 'sleep'` in Introduction.jsx exactly (the Evening/Wind-Down card),
// so the same string flows unchanged through the whole pipe: handleCardTap
// reads card.id -> setPendingJourneyIntent(card.id) -> (round-trip) ->
// resolveJourneyResumeTarget(action) -> resumeAction state ->
// CARD_DESTINATIONS[resumeAction]. A second, translated name here
// ('evening') was tried first and caught live: it round-tripped through
// storage correctly but silently failed to look anything up in
// CARD_DESTINATIONS (whose own key is 'sleep'), so a guest's Wind Down
// intent was dropped without error. One id space, not two.
const ALLOWED_ACTIONS = new Set(['morning', 'sleep']);

export const isAllowedJourneyAction = (action) => ALLOWED_ACTIONS.has(action);

export const setPendingJourneyIntent = (action) => {
  if (!isAllowedJourneyAction(action)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ action, setAt: Date.now() }));
  } catch {
    // Storage unavailable — the sign-in flow still works, it just
    // returns to Home instead of resuming the selected journey.
  }
};

// Sign-out safety net, matching clearPendingContent's own purpose:
// exposed directly (not only via the sessionStorage-prefix sweep) so a
// caller can clear it deterministically without depending on sweep
// timing/ordering.
export const clearPendingJourneyIntent = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable - nothing to clear.
  }
};

// Reads and clears in one step - a pending journey intent is only ever
// consumed once, immediately after a successful auth. Returns the real
// action string ('morning' | 'sleep') or null - never the raw stored
// value unchecked.
export const consumePendingJourneyIntent = () => {
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

  if (!parsed || !isAllowedJourneyAction(parsed.action)) return null;
  if (typeof parsed.setAt !== 'number' || Date.now() - parsed.setAt > MAX_AGE_MS) return null;

  return parsed.action;
};

// The one real navigation decision this whole mechanism produces: a
// fixed-shape route Introduction.jsx already knows how to interpret
// (?auto=1, matching every other automatic-first-use landing, plus
// &resume=<action>, read once via a lazy initializer and stripped
// immediately - see Introduction.jsx's own doc comment). Called with
// anything outside the allowlist (including the null a missing/expired/
// tampered pending intent already resolves to), this returns null -
// there is no code path that can ever hand a caller-supplied action
// straight to navigate().
export const resolveJourneyResumeTarget = (action) => {
  if (!isAllowedJourneyAction(action)) return null;
  return `/introduction?auto=1&resume=${action}`;
};
