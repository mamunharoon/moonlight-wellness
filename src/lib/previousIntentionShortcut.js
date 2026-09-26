// WakeWise Phase 3B (3B.2) — a small, additive, local-only record of the
// most recently CONFIRMED intention and which local calendar day it was
// confirmed on. Purely a client-side UX hint, never synced to Supabase and
// never a database migration - the worst case on a new device or cleared
// storage is simply "Stage 1 is asked fresh," which is already the safe,
// correct fallback, not a data-integrity concern. Mirrors
// eveningPrepareSelection.js's own established scoped-key/local-date-
// validated convention (guest continues on the unscoped base key; a
// signed-in user's key is suffixed by their own id, so User A's record is
// never read back for User B).
const RECORD_KEY = 'moonlight_intentions_confirmed_record';

const scopedKey = (userId) => (userId ? `${RECORD_KEY}:${userId}` : RECORD_KEY);

export const getPreviousIntentionRecordKey = (userId) => scopedKey(userId);

// Called on every genuine confirmation (IntentionSetup.jsx's own Continue/
// Set My Intention, and its review-mode commit) - never on Skip, matching
// "only a genuine confirm ever counts."
export const recordIntentionConfirmation = (userId, intentions, dateKey) => {
  if (!Array.isArray(intentions) || intentions.length === 0 || !dateKey) return;
  try {
    localStorage.setItem(scopedKey(userId), JSON.stringify({ intentions, dateKey }));
  } catch {
    // Best-effort only - a write failure just means the shortcut won't
    // offer next time, never a functional break.
  }
};

const readRecord = (userId) => {
  try {
    const raw = localStorage.getItem(scopedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (!Array.isArray(parsed.intentions) || parsed.intentions.length === 0) return null;
    if (typeof parsed.dateKey !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

// The confirmed intention from a genuinely PRIOR local day, or null when
// none exists, it was already confirmed today, or the stored record is
// missing/corrupt. Never returns a same-day value - that case is already
// handled by the ordinary "already confirmed today" summary-stage path.
export const getPreviousDayIntention = (userId, todayDateKey) => {
  const record = readRecord(userId);
  if (!record || record.dateKey === todayDateKey) return null;
  return record.intentions;
};

export const wasConfirmedToday = (userId, todayDateKey) => readRecord(userId)?.dateKey === todayDateKey;
