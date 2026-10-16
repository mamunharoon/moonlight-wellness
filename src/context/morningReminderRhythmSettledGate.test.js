// iPhone alarm-defect investigation — real race found: AlarmContext resets
// alarmTime to a neutral '07:30' placeholder synchronously while a signed-in
// user's real saved wake time is still being fetched (see
// AlarmContext.jsx's own rhythmSettled). MorningReminderContext's mount
// effect and its alarmTime-watching effect both call reconcile()
// immediately — without a guard, reconcile() could compute a fingerprint
// and apply a native OS schedule against that placeholder during the brief
// loading window. Source-level checks, matching this repo's own
// established no-DOM-harness convention (vite.config.js's test environment
// is 'node' — see e.g. AnytimeStretch.phase2cGate.test.js's identical note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MorningReminderContext.jsx', import.meta.url)), 'utf-8');
const reconcileBody = () => source.match(/const reconcile = useCallback\(async \(\) => \{[\s\S]*?\n {2}\}, \[supported, alarmTime, rhythmSettled, buildFingerprint\]\);/)?.[0] ?? '';

describe('MorningReminderContext.jsx — reconcile() never acts against the unsettled alarmTime placeholder', () => {
  it('destructures rhythmSettled from useAlarm()', () => {
    expect(source).toMatch(/const \{ alarmTime, rhythmSettled \} = useAlarm\(\);/);
  });

  it('reconcile() returns before doing anything (no permission check, no scheduling, no state update) while rhythmSettled is false', () => {
    const body = reconcileBody();
    expect(body).not.toBe('');
    const guardIndex = body.indexOf('if (!rhythmSettled) return;');
    const permissionCheckIndex = body.indexOf('await checkPermission()');
    const scheduleIndex = body.indexOf('applyMorningReminderSchedule(');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(permissionCheckIndex).toBeGreaterThan(guardIndex);
    expect(scheduleIndex).toBeGreaterThan(guardIndex);
  });

  it('the guard runs before the in-flight reconcilingRef is ever set, so a premature call never blocks the real one that follows once settled', () => {
    const body = reconcileBody();
    const guardIndex = body.indexOf('if (!rhythmSettled) return;');
    const refSetIndex = body.indexOf('reconcilingRef.current = true;');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(refSetIndex).toBeGreaterThan(guardIndex);
  });

  it('rhythmSettled is included in reconcile\'s own useCallback dependency array, so the callback identity is current for the guard it relies on', () => {
    expect(source).toMatch(/\}, \[supported, alarmTime, rhythmSettled, buildFingerprint\]\);/);
  });
});
