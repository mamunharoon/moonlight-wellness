// Tester-reported defect: the screen sleeps mid-Morning-routine and
// mid-meditation. Source-level checks, matching this repo's own
// established no-DOM-harness convention (vite.config.js's test.environment
// is 'node' - no document/navigator/useEffect rendering pass available;
// see e.g. AnytimeStretch.phase2cGate.test.js's identical note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useWakeLock.js', import.meta.url)), 'utf-8');

describe('useWakeLock.js', () => {
  it('is a no-op (returns undefined, no effect body runs) when active is false, never acquiring anything', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!active\)[\s\S]*?\n {2}\}, \[active\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(!active\) return undefined;/);
  });

  it('feature-detects navigator.wakeLock and is a silent no-op where unsupported - never throws, never a hard dependency', () => {
    expect(source).toMatch(/if \(typeof navigator === 'undefined' \|\| !navigator\.wakeLock\) return undefined;/);
  });

  it('requests the real "screen" wake lock and swallows a decline (low battery, unsupported, etc.) rather than throwing', () => {
    const body = source.match(/const acquire = async \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/navigator\.wakeLock\.request\('screen'\)/);
    expect(body).toMatch(/catch \{/);
  });

  it('releases a sentinel acquired after this effect was already cancelled (fast active=true->false), never leaking it', () => {
    const body = source.match(/const acquire = async \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(cancelled\) \{\s*\n\s*sentinel\.release\(\)\.catch\(\(\) => \{\}\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('re-acquires on visibilitychange only when the document is actually visible again (app foregrounded) - never while still hidden', () => {
    const body = source.match(/const handleVisibilityChange = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(document\.visibilityState === 'visible'\) acquire\(\);/);
  });

  it('cleanup unconditionally releases the held sentinel and removes the visibilitychange listener, keyed on [active] so pausing/resuming re-runs it', () => {
    expect(source).toMatch(/document\.removeEventListener\('visibilitychange', handleVisibilityChange\);/);
    expect(source).toMatch(/sentinelRef\.current\?\.release\(\)\.catch\(\(\) => \{\}\);/);
    expect(source).toMatch(/\}, \[active\]\);/);
  });

  it('never calls navigator.wakeLock.request more than once per acquire cycle - acquire() is invoked exactly once on mount/re-activation, the rest is event-driven', () => {
    const requestCalls = source.match(/navigator\.wakeLock\.request/g) ?? [];
    expect(requestCalls.length).toBe(1);
  });
});
