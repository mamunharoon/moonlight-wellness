// Client expiry-guard fix — SubscriptionContext.jsx must re-evaluate
// `entitlement` as time passes while mounted (an expiry-crossing with no
// new webhook), and on app resume/refetch (a provider's real state may
// have changed while backgrounded) — not only when a webhook-triggered
// `subscription` change re-runs loadEntitlement's own effect. Source-level
// check, same convention as this repo's other SubscriptionContext tests
// (subscriptionRefreshReturnValue.test.js) — no DOM/hook-rendering harness
// is set up in this project (no @testing-library/react dependency), so
// the actual TIME-SENSITIVE behaviour this wiring depends on
// (scheduleAtTime's hop-chaining, resolveUnifiedEntitlement's `now`
// parameter) is covered by real execution in scheduleAtTime.test.js and
// entitlementResolver.test.js's own "expiry crossing without a webhook"
// case; this file only pins that SubscriptionContext.jsx actually wires
// those pieces together as intended, so a future edit can't silently
// drop the wiring while every other test keeps passing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SubscriptionContext.jsx', import.meta.url)), 'utf-8');

describe('SubscriptionContext — re-evaluates on expiry crossing while mounted, without a new webhook', () => {
  it('imports scheduleAtTime and tracks the raw records a recompute would need', () => {
    expect(source).toMatch(/import \{ scheduleAtTime \} from '\.\.\/lib\/scheduleAtTime';/);
    expect(source).toMatch(/const lastRecordsRef = useRef\(\[\]\);/);
  });

  it('every loadEntitlement branch keeps lastRecordsRef in sync with what was actually resolved', () => {
    const body = source.match(/const loadEntitlement = async \(currentUser\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/lastRecordsRef\.current = \[\];/); // guest/no-user branch
    expect(body).toMatch(/lastRecordsRef\.current = fetchError \? \[\] : records;/); // real fetch
  });

  it('schedules a recompute at the stored expiry, keyed on isEntitled/currentPeriodEnd, and cancels on cleanup', () => {
    const effectMatch = source.match(
      /useEffect\(\(\) => \{\s*\n\s*if \(!entitlement\.isEntitled \|\| !entitlement\.currentPeriodEnd\) return undefined;[\s\S]*?\n {2}\}, \[entitlement\.isEntitled, entitlement\.currentPeriodEnd\]\);/
    );
    expect(effectMatch).not.toBeNull();
    const body = effectMatch[0];
    expect(body).toMatch(/scheduleAtTime\(expiresAtMs, \(\) => \{/);
    // Recomputes against the SAME already-fetched records with a fresh
    // `now` — never a refetch, since nothing about the data changed,
    // only whether `now` has crossed the stored expiry.
    expect(body).toMatch(/resolveUnifiedEntitlement\(\{ loading: false \}, lastRecordsRef\.current, new Date\(\)\)/);
    expect(body).toMatch(/return cancel;/);
  });
});

describe('SubscriptionContext — re-evaluates on app resume/refetch, not only on webhook', () => {
  it('registers a native appStateChange listener, gated to native only, calling refreshEntitlement only when becoming active', () => {
    expect(source).toMatch(/import \{ App as CapacitorApp \} from '@capacitor\/app';/);
    expect(source).toMatch(/import \{ isNativePlatform \} from '\.\.\/lib\/platform';/);
    expect(source).toMatch(/if \(isNativePlatform\(\)\) \{\s*\n\s*appStateListenerPromise = CapacitorApp\.addListener\('appStateChange', \(\{ isActive \}\) => \{\s*\n\s*if \(isActive\) refreshEntitlement\(\);/);
  });

  it('registers a visibilitychange listener for web/PWA, calling refreshEntitlement only when the tab becomes visible', () => {
    expect(source).toMatch(
      /const handleVisibilityChange = \(\) => \{\s*\n\s*if \(document\.visibilityState === 'visible'\) refreshEntitlement\(\);\s*\n\s*\};/
    );
    expect(source).toMatch(/document\.addEventListener\('visibilitychange', handleVisibilityChange\);/);
  });

  it('cleans up both listeners on unmount/re-run, never leaking a duplicate native listener', () => {
    expect(source).toMatch(/appStateListenerPromise\?\.then\(\(listener\) => listener\.remove\(\)\);/);
    expect(source).toMatch(/document\.removeEventListener\('visibilitychange', handleVisibilityChange\);/);
  });
});
