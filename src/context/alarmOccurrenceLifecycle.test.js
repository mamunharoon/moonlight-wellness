// Same-minute re-trigger defect fix — source-level regression guard for
// AlarmContext.jsx's wiring to alarmOccurrence.js. The pure logic itself
// (key construction, identity/date scoping, persistence) is unit-tested
// with real execution in alarmOccurrence.test.js; AlarmContext.jsx's own
// checkTime()/dismissAlarm()/snooze() are not practically renderable in
// this repo's Node-environment Vitest (matches this codebase's
// established pattern - see signOutIsolation.test.js's own note), so this
// file checks the exact source wiring instead: the handled-occurrence
// check runs BEFORE every fire, and each of the three real resolution
// actions marks its own occurrence handled.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const alarmContextSource = read('./AlarmContext.jsx');

describe('AlarmContext.jsx imports the handled-occurrence persistence helpers', () => {
  it('imports buildAlarmOccurrenceKey, getHandledAlarmOccurrence, markAlarmOccurrenceHandled and clearHandledAlarmOccurrence from alarmOccurrence.js', () => {
    expect(alarmContextSource).toMatch(
      /import \{ buildAlarmOccurrenceKey, getHandledAlarmOccurrence, markAlarmOccurrenceHandled, clearHandledAlarmOccurrence \} from '\.\.\/lib\/alarmOccurrence';/
    );
  });
});

describe('checkTime() checks the persisted handled-occurrence marker before ever firing', () => {
  const checkTimeBody = alarmContextSource.match(/const checkTime = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';

  it('exists and contains the same-minute fire branch', () => {
    expect(checkTimeBody).toMatch(/if \(currentTimeString === alarmTime\) \{/);
  });

  it('builds the current occurrence key from identity, dateKey and alarmTime before firing', () => {
    expect(checkTimeBody).toMatch(
      /buildAlarmOccurrenceKey\(\{ identity: userId \|\| 'guest', dateKey: zoned\.dateKey, alarmTime \}\)/
    );
  });

  it('returns early without ringing/playing when the occurrence was already handled', () => {
    const guardMatch = checkTimeBody.match(/if \(getHandledAlarmOccurrence\(\) === occurrenceKey\) \{[\s\S]*?\n {8}\}/)?.[0] ?? '';
    expect(guardMatch).not.toBe('');
    expect(guardMatch).not.toMatch(/setIsRinging\(true\)/);
    expect(guardMatch).not.toMatch(/playTrack\(/);
    // The early-return branch still records lastFiredKeyRef so the
    // ephemeral same-session guard also treats this minute as seen -
    // otherwise checkTime() would re-evaluate the (already-negative)
    // handled-occurrence check on every remaining tick of the same minute.
    expect(guardMatch).toMatch(/lastFiredKeyRef\.current = firedKey;/);
  });

  it('only sets isRinging/plays the track AFTER the handled-occurrence guard, not before it', () => {
    const guardIndex = checkTimeBody.indexOf('getHandledAlarmOccurrence()');
    const ringingIndex = checkTimeBody.indexOf('setIsRinging(true)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(ringingIndex).toBeGreaterThan(guardIndex);
  });
});

describe('dismissAlarm() marks its own occurrence handled (shared by Begin and Skip)', () => {
  const dismissBody = alarmContextSource.match(/const dismissAlarm = \([\s\S]*?\n {2}\};/)?.[0] ?? '';

  it('exists and calls markAlarmOccurrenceHandled before releasing isRinging', () => {
    expect(dismissBody).not.toBe('');
    expect(dismissBody).toMatch(/markAlarmOccurrenceHandled\(/);
    const markIndex = dismissBody.indexOf('markAlarmOccurrenceHandled(');
    const releaseIndex = dismissBody.indexOf('setIsRinging(false)');
    expect(releaseIndex).toBeGreaterThan(markIndex);
  });
});

describe('snooze() marks the OLD occurrence handled before shifting alarmTime to the new snooze target', () => {
  const snoozeBody = alarmContextSource.match(/const snooze = \([\s\S]*?\n {2}\};/)?.[0] ?? '';

  it('exists and calls markAlarmOccurrenceHandled before setAlarmTime', () => {
    expect(snoozeBody).not.toBe('');
    expect(snoozeBody).toMatch(/markAlarmOccurrenceHandled\(/);
    const markIndex = snoozeBody.indexOf('markAlarmOccurrenceHandled(');
    const setAlarmTimeIndex = snoozeBody.indexOf('setAlarmTime(');
    expect(setAlarmTimeIndex).toBeGreaterThan(markIndex);
  });
});

describe('sign-out sweep clears the handled-occurrence marker (cross-identity hygiene)', () => {
  it('onSignOutBroadcast calls clearHandledAlarmOccurrence()', () => {
    const signOutBlock = alarmContextSource.match(/onSignOutBroadcast\(\(\) => \{[\s\S]*?\n {4}\}\);/)?.[0] ?? '';
    expect(signOutBlock).toMatch(/clearHandledAlarmOccurrence\(\);/);
  });
});

describe('the Background Clock Observer effect depends on userId (identity-correct occurrence keys after sign-in/sign-out)', () => {
  // WakeWise DEV — alarm wake-up sound picker: alarmSoundId was added to
  // this same dependency array (the ringing effect now also reads it, to
  // play whichever sound the user selected) - userId's own presence,
  // which this test protects, is unaffected.
  it('includes userId in checkTime()\'s useEffect dependency array', () => {
    expect(alarmContextSource).toMatch(
      /\[alarmTime, isAlarmSet, isRinging, playTrack, sessionState\.status, effectiveTimezone, userId, alarmSoundId\]/
    );
  });
});

// Edited-alarm gap, found and fixed during final Stage 2 verification:
// the handled-occurrence key only embeds the CURRENT alarmTime, so
// editing the alarm away and then back to an already-resolved time later
// the same day reproduced the exact same key and stayed wrongly
// suppressed - reproduced live (Playwright, real updateRhythm() calls
// through a temporary preview route, no source assumption) before this
// fix. A pure timezone-only call (TimezoneSettings.jsx passes the SAME
// alarmTime back unchanged) must NOT clear the marker - an already-
// resolved occurrence for today stays resolved across a TZ change alone.
describe('updateRhythm() clears the handled-occurrence marker only on a genuine alarm-time change', () => {
  const updateRhythmBody = alarmContextSource.match(/const updateRhythm = \([\s\S]*?\n {2}\};/)?.[0] ?? '';

  it('exists and calls clearHandledAlarmOccurrence guarded by newAlarm !== alarmTime', () => {
    expect(updateRhythmBody).not.toBe('');
    expect(updateRhythmBody).toMatch(/if \(newAlarm !== alarmTime\) \{\s*\n\s*clearHandledAlarmOccurrence\(\);\s*\n\s*\}/);
  });

  it('the guard runs before setAlarmTime updates the compared value', () => {
    const guardIndex = updateRhythmBody.indexOf('newAlarm !== alarmTime');
    const setIndex = updateRhythmBody.indexOf('setAlarmTime(newAlarm)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(setIndex).toBeGreaterThan(guardIndex);
  });
});
