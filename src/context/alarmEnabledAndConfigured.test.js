// Welcome alarm-status card — AlarmContext.jsx's real, persisted
// isAlarmSet (enable/disable) and alarmConfigured ("ever genuinely
// saved") wiring. Source-level regression guard (no DOM rendering in
// this repo's Vitest - see signOutIsolation.test.js's own note); the
// pure copy/formatting logic these feed is covered with real execution
// in alarmStatus.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AlarmContext.jsx');

describe('initial state: guest-only localStorage, mirroring intentionsConfirmed\'s own established shape', () => {
  it('isAlarmSet initializes from getInitialAlarmEnabled (defaults true when nothing stored)', () => {
    expect(source).toMatch(/const \[isAlarmSet, setIsAlarmSet\] = useState\(getInitialAlarmEnabled\);/);
    const fn = source.match(/const getInitialAlarmEnabled = \(\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(fn).toMatch(/return stored === null \? true : stored === 'true';/);
  });

  it('alarmConfigured initializes from getInitialAlarmConfigured (defaults false when nothing stored)', () => {
    expect(source).toMatch(/const \[alarmConfigured, setAlarmConfigured\] = useState\(getInitialAlarmConfigured\);/);
    const fn = source.match(/const getInitialAlarmConfigured = \(\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(fn).toMatch(/return localStorage\.getItem\(ALARM_CONFIGURED_KEY\) === 'true';/);
  });
});

describe('fetchRhythm — a registered user\'s real source of truth', () => {
  it('selects alarm_enabled and alarm_configured alongside the existing rhythm columns', () => {
    expect(source).toMatch(/\.select\('wake_up_time, bedtime, timezone, alarm_enabled, alarm_configured'\)/);
  });

  it('applies both to state with safe fallbacks when a row exists', () => {
    const fn = source.match(/const fetchRhythm = async \(uid\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/setIsAlarmSet\(data\.alarm_enabled \?\? true\);/);
    expect(fn).toMatch(/setAlarmConfigured\(Boolean\(data\.alarm_configured\)\);/);
  });
});

describe('syncRhythm identity-reset — cross-user/sign-out isolation', () => {
  it('the guest branch re-reads both from guest storage - never a leftover value from the previous identity', () => {
    const guestBranch = source.match(/if \(!userId\) \{[\s\S]*?settledRhythmUserIdRef\.current = userId;\s*\n\s*return;\s*\n\s*\}/)?.[0] ?? '';
    expect(guestBranch).toMatch(/setIsAlarmSet\(getInitialAlarmEnabled\(\)\);/);
    expect(guestBranch).toMatch(/setAlarmConfigured\(getInitialAlarmConfigured\(\)\);/);
  });

  it('the registered-user branch resets to neutral defaults (true/false) before the async fetch resolves - a mounted page can never paint the outgoing identity\'s enabled/configured state', () => {
    expect(source).toMatch(/setTimezoneState\(null\);\s*\n\s*setIsAlarmSet\(true\);\s*\n\s*setAlarmConfigured\(false\);\s*\n\s*await fetchRhythm\(userId\);/);
  });
});

describe('guest-only persistence effects', () => {
  it('isAlarmSet is written to ALARM_ENABLED_KEY, guarded by the same authLoading/isGuest/identity-settled checks every other rhythm field already uses', () => {
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(authLoading \|\| !isGuest\) return;\s*\n\s*if \(settledRhythmUserIdRef\.current !== userId\) return;\s*\n\s*localStorage\.setItem\(ALARM_ENABLED_KEY, isAlarmSet \? 'true' : 'false'\);\s*\n\s*\}, \[isAlarmSet, authLoading, isGuest, userId\]\);/
    );
  });

  it('alarmConfigured is written to ALARM_CONFIGURED_KEY the same way', () => {
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(authLoading \|\| !isGuest\) return;\s*\n\s*if \(settledRhythmUserIdRef\.current !== userId\) return;\s*\n\s*localStorage\.setItem\(ALARM_CONFIGURED_KEY, alarmConfigured \? 'true' : 'false'\);\s*\n\s*\}, \[alarmConfigured, authLoading, isGuest, userId\]\);/
    );
  });
});

describe('updateRhythm — the one real, deliberate save entry point', () => {
  const fn = source.match(/const updateRhythm = \(newAlarm, newBed, newTimezone, newEnabled\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

  it('accepts an optional 4th newEnabled param, same "omitted means don\'t change" convention as newTimezone', () => {
    expect(fn).not.toBe('');
    expect(fn).toMatch(/const resolvedEnabled = newEnabled !== undefined \? newEnabled : isAlarmSet;/);
    expect(fn).toMatch(/if \(newEnabled !== undefined\) setIsAlarmSet\(newEnabled\);/);
  });

  it('any real call unconditionally marks alarmConfigured true - even a call that only toggles newEnabled is a genuine, deliberate save', () => {
    expect(fn).toMatch(/setAlarmConfigured\(true\);/);
  });

  it('passes the resolved enabled state and true (configured) through to saveRhythm for registered users', () => {
    expect(fn).toMatch(/saveRhythm\(newAlarm, newBed, resolvedTimezone, resolvedEnabled, true\);/);
  });
});

describe('saveRhythm — upserts both new columns explicitly, never omitted', () => {
  it('the upsert payload includes alarm_enabled and alarm_configured', () => {
    const fn = source.match(/const saveRhythm = async \(newAlarm, newBed, newTimezone, newEnabled, newConfigured\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/alarm_enabled: newEnabled,/);
    expect(fn).toMatch(/alarm_configured: newConfigured,/);
  });
});

describe('useCurrentTimezone — a pure timezone confirmation, never a silent alarm re-enable or de-configure', () => {
  it('passes the CURRENT isAlarmSet/alarmConfigured through unchanged, never a hardcoded true/false', () => {
    const fn = source.match(/const useCurrentTimezone = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/saveRhythm\(alarmTime, bedTime, deviceTimezone, isAlarmSet, alarmConfigured\);/);
  });
});

describe('context value exposes alarmConfigured (isAlarmSet/setIsAlarmSet were already exposed before this work)', () => {
  it('alarmConfigured is in the Provider value object', () => {
    expect(source).toMatch(/isAlarmSet,\s*\n\s*setIsAlarmSet,\s*\n\s*alarmConfigured,\s*\n\s*isRinging,/);
  });
});
