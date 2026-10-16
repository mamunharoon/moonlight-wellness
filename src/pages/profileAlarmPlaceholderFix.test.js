// Tester-reported defect: "Morning alarm defaults to 7:30; concerned
// personal alarm information was accessed without permission." Investigated
// and confirmed via AlarmContext.jsx: '07:30' is a plain app-level default/
// loading placeholder (localStorage fallback for a guest with no saved
// value, or a transient reset shown synchronously for a signed-in user
// while their real saved rhythm is still being fetched) - never device/OS
// alarm data, never read via any native alarm-clock permission or API. The
// real, fixable bug: Profile's "Wake time"/"Bedtime" rows rendered that
// placeholder exactly like a confirmed value during the brief loading
// window, with nothing distinguishing the two. Source-level checks,
// matching this repo's own established no-DOM-harness convention (see
// profileMinimumFoundation.test.js's identical note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('AlarmContext.jsx — rhythmSettled exposes the existing settled-identity check to consumers', () => {
  const source = read('../context/AlarmContext.jsx');
  it('derives rhythmSettled from the same rhythmSettledUserId === userId pattern timezoneUnconfirmed already established, and exposes it on the Provider value', () => {
    expect(source).toMatch(/const rhythmSettled = rhythmSettledUserId === userId;/);
    expect(source).toMatch(/alarmConfigured,\s*\n\s*rhythmSettled,/);
  });
});

describe('Profile.jsx — "Wake time"/"Bedtime" never show the loading placeholder as if it were a confirmed value', () => {
  const source = read('./Profile.jsx');
  it('destructures rhythmSettled from useAlarm()', () => {
    expect(source).toMatch(/const \{ alarmTime, bedTime, routineDuration, setRoutineDuration, effectiveTimezone, rhythmSettled \} = useAlarm\(\);/);
  });

  it('both rows render alarmTime/bedTime only once rhythmSettled is true, a neutral placeholder otherwise - never the raw context value unconditionally', () => {
    expect(source).toMatch(/\{rhythmSettled \? alarmTime : '…'\}/);
    expect(source).toMatch(/\{rhythmSettled \? bedTime : '…'\}/);
    // The old unconditional renders must actually be gone, not just
    // shadowed - a regression here would silently reintroduce the defect.
    expect(source).not.toMatch(/\{alarmTime\}\s*\n\s*<span className="material-symbols-outlined text-sm">chevron_right<\/span>/);
    expect(source).not.toMatch(/\{bedTime\}\s*\n\s*<span className="material-symbols-outlined text-sm">chevron_right<\/span>/);
  });
});
