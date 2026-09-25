// WakeWise — Alarm occurrence identity and handled-occurrence persistence.
//
// Same-minute re-trigger defect fix. Root cause: the alarm's own
// re-fire guard (AlarmContext.jsx's lastFiredKeyRef) and its ringing
// flag (isRinging) are both held only in ephemeral React memory. A hard
// reload or manual URL navigation fully remounts AlarmProvider, wiping
// that memory - if the real (or dev-clock) time is still within the
// exact same HH:MM the alarm was due, the Background Clock Observer
// sees no record of ever having fired it and genuinely re-fires:
// new isRinging, new journeyStep, new playTrack(). Reproduced live for
// "Skip This Morning" specifically (it clears only in-memory state,
// never starts a session and never changes alarmTime, so nothing else
// in the existing guard chain protects it across a reload); "Begin Your
// Morning" happened to be incidentally protected by its own session
// start (sessionState.status === 'playing' already blocks re-fire), and
// "Remind Me Shortly" is incidentally protected because it shifts
// alarmTime itself. Both of those are side effects of unrelated logic,
// not a real protection for the occurrence itself.
//
// Fix: persist an explicit "this exact occurrence was resolved" marker,
// independent of both isRinging and the Session Engine, checked BEFORE
// ever firing (in AlarmContext.jsx's own checkTime()) and written ONLY
// by the three real resolution actions (dismissAlarm - Begin/Skip share
// it; snooze - Remind). Firing itself never marks an occurrence
// handled - only an explicit choice does (required contract: "do not
// permanently mark an occurrence handled merely because it started
// ringing"), so reloading a still-ringing, never-resolved alarm within
// the same due-minute is still expected to re-show it - that is the
// established, unchanged product decision, not something this fix
// touches (see AlarmContext.jsx's own doc comment at the call site for
// the explicit trade-off this leaves in place).
//
// Occurrence identity: `${identity}:${dateKey}T${alarmTime}` -
// `identity` is the signed-in user's id, or the literal string 'guest'
// (no separate per-guest id exists anywhere else in this app either -
// mirrors AlarmContext.jsx's own existing guest/registered split).
// `dateKey`/`alarmTime` come from the SAME getZonedParts(effectiveTimezone,
// ...) primitive every other alarm/date calculation in this app already
// uses (timezone.js) - already DST-correct, already scoped to the user's
// own local calendar day, never a fixed UTC offset. No separate alarm
// id/version exists in the data model (one alarmTime per user) and none
// is invented here - the (identity, date, alarmTime) tuple is already
// unique per user per day.
//
// Persistence: a single localStorage value (never an array/set - only
// one alarm can ever be due at a time, so each new resolution simply
// overwrites the previous marker; this alone satisfies "must not grow
// without limit"). Deliberately localStorage for BOTH guests and
// registered users, not a new Supabase column/table: this marker only
// ever needs to survive a reload/remount on the SAME device/browser
// within the SAME due-minute - it has no cross-device purpose (each
// device runs its own independent Background Clock Observer), so a
// migration is not required for it to do its job. Even without the
// sign-out sweep below, a stale entry from a previous identity can never
// incorrectly suppress a different identity's alarm: the identity itself
// is part of the stored key, so a mismatched identity simply never
// equals the newly-computed key - see AlarmContext.jsx's own
// onSignOutBroadcast wiring for the additional (belt-and-suspenders,
// not load-bearing for correctness) hygiene sweep.
//
// Superseding: editing the alarm time or letting a new calendar day
// arrive both naturally produce a different occurrence key on their own
// (the key is built fresh from the CURRENT alarmTime/date every time
// checkTime() runs) - no separate "clear on edit"/"clear at midnight"
// logic is needed for correctness. Snoozing marks the OLD occurrence
// handled, then shifts alarmTime forward - the NEW alarmTime produces a
// genuinely new, never-yet-marked occurrence key, so the snoozed
// occurrence remains fully eligible to fire at its new time.
const HANDLED_OCCURRENCE_KEY = 'moonlight_alarm_handled_occurrence';

export const buildAlarmOccurrenceKey = ({ identity, dateKey, alarmTime }) =>
  `${identity || 'guest'}:${dateKey}T${alarmTime}`;

export const getHandledAlarmOccurrence = () => {
  try {
    return localStorage.getItem(HANDLED_OCCURRENCE_KEY);
  } catch {
    return null;
  }
};

export const markAlarmOccurrenceHandled = (occurrenceKey) => {
  try {
    localStorage.setItem(HANDLED_OCCURRENCE_KEY, occurrenceKey);
  } catch {
    // Storage unavailable - the in-memory lastFiredKeyRef guard in
    // AlarmContext.jsx still protects the current live session; only a
    // reload/remount within the same due-minute would be unprotected.
  }
};

export const clearHandledAlarmOccurrence = () => {
  try {
    localStorage.removeItem(HANDLED_OCCURRENCE_KEY);
  } catch {
    // Storage unavailable - nothing to clear.
  }
};
