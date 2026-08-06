import { getSessionById } from './sessionRegistry';
import { SESSION_STATUS } from './sessionReducer';

/*
 * Stage 3C — Session Engine core, persistence (Ticket Group 2)
 *
 * Pure localStorage read/write functions only — no React, no reducer
 * dispatch, no navigation, no Supabase. The only side effects in this
 * file are localStorage.getItem/setItem, both wrapped defensively, same
 * try/catch pattern already established by AlarmContext.jsx elsewhere in
 * this codebase. src/context/SessionContext.jsx is the only caller.
 *
 * KEY
 *   'moonlight_session_progress' — a new key, additive only. Does not
 *   read, write, rename, or clear any existing `moonlight_*` key — in
 *   particular, `moonlight_journey_step` (owned exclusively by
 *   AlarmContext.jsx) is never touched here.
 *
 * STORED SHAPE
 *   { version: 1, state: <runtime session state> }
 *
 * STALE SESSION POLICY — provisional Stage 3C policy (see Group 2
 * report; the authoritative docs do not specify an exact value, so this
 * constant is a deliberate, documented placeholder pending product
 * confirmation, not a value derived from any source document)
 *   SESSION_STALE_AFTER_MS = 12 hours. Applies only to 'playing' and
 *   'interrupted' states — an in-progress or paused session older than
 *   this is discarded back to idle on load. 'completed' and 'skipped'
 *   states are restored regardless of age: Group 2 does not implement
 *   "event consumption" (the future mechanism that would know it's safe
 *   to clear a completed record), so inventing an expiry for them now
 *   would be a guess, not a decision grounded in anything built yet.
 *
 * VALIDATION — explicit choices worth flagging for review
 *   Out-of-range step indexes are REJECTED, not clamped: the whole
 *   persisted record is discarded back to idle rather than resuming at
 *   a clamped-but-possibly-wrong step. In practice this only occurs if
 *   storage was corrupted/tampered, or a future deploy changes a
 *   session's step count while a user still has old persisted state —
 *   restarting fresh seemed less confusing than silently resuming
 *   somewhere the user didn't leave off.
 */

export const SESSION_STORAGE_KEY = 'moonlight_session_progress';
export const SESSION_STORAGE_VERSION = 1;
export const SESSION_STALE_AFTER_MS = 12 * 60 * 60 * 1000; // 12 hours — provisional, see doc comment above

const VALID_STATUSES = Object.values(SESSION_STATUS);

const isValidTimestamp = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

// Defensive shape + referential validation. Returns a validated state
// object, or null if anything about the candidate can't be trusted.
// Never throws.
const validateRuntimeState = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;

  const { sessionId, stepIndex, status, startedAt, updatedAt, interruptionReason, completionEventId } = candidate;

  if (!VALID_STATUSES.includes(status)) return null;
  if (!Number.isInteger(stepIndex) || stepIndex < 0) return null;
  if (updatedAt !== null && !isValidTimestamp(updatedAt)) return null;

  if (status === SESSION_STATUS.IDLE) {
    // Canonical idle carries no session identity.
    if (sessionId !== null || startedAt !== null || interruptionReason !== null || completionEventId !== null) {
      return null;
    }
    return { sessionId: null, stepIndex: 0, status, startedAt: null, updatedAt, interruptionReason: null, completionEventId: null };
  }

  // Every non-idle status must reference a real, currently-registered
  // session — an unknown/removed session id is rejected outright.
  const session = typeof sessionId === 'string' ? getSessionById(sessionId) : null;
  if (!session) return null;
  if (stepIndex >= session.steps.length) return null; // out-of-range — rejected, not clamped (see file doc comment)
  if (!isValidTimestamp(startedAt)) return null;

  if (status === SESSION_STATUS.INTERRUPTED) {
    if (interruptionReason !== null && typeof interruptionReason !== 'string') return null;
  } else if (interruptionReason !== null) {
    return null; // interruptionReason is only ever set while interrupted
  }

  if (status === SESSION_STATUS.COMPLETED) {
    if (typeof completionEventId !== 'string' || completionEventId.length === 0) return null;
  } else if (completionEventId !== null) {
    return null; // completionEventId is only ever set once completed
  }

  return { sessionId, stepIndex, status, startedAt, updatedAt, interruptionReason, completionEventId };
};

const isStale = (state) => {
  if (state.status !== SESSION_STATUS.PLAYING && state.status !== SESSION_STATUS.INTERRUPTED) return false;
  const reference = state.updatedAt ?? state.startedAt;
  if (!reference) return true; // no timestamp to trust — treat as stale
  return Date.now() - new Date(reference).getTime() > SESSION_STALE_AFTER_MS;
};

// Returns a validated, non-stale runtime state to restore, or null if
// there's nothing safe/worth restoring — no key present, corrupt JSON,
// wrong version, failed shape validation, or stale. Never throws; every
// failure path returns null.
export const loadSessionState = () => {
  let raw;
  try {
    raw = localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null; // storage unavailable this session
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt JSON
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version !== SESSION_STORAGE_VERSION) return null;

  const validated = validateRuntimeState(parsed.state);
  if (!validated) return null;

  if (isStale(validated)) return null;

  return validated;
};

// Persists the given runtime state. Silently no-ops on any storage
// exception (private browsing, quota exceeded, disabled storage) —
// matching AlarmContext.jsx's own established pattern. Never touches any
// other localStorage key.
export const saveSessionState = (state) => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: SESSION_STORAGE_VERSION, state }));
  } catch {
    // Storage unavailable/exceeded — the engine keeps working in-memory
    // for this session; nothing else is affected.
  }
};
