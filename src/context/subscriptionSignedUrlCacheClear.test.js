// Video startup performance (2026-11-01, DEV only) — regression guard
// for SubscriptionContext's defense-in-depth hook that clears the
// signed-video-URL cache when a plan/status change is observed. Source-
// level check, matching signOutIsolation.test.js's own established
// pattern for context wiring that isn't practically renderable in this
// repo's Node-environment Vitest. The cache module's own clearing
// behaviour is unit-tested directly in signedVideoUrlCache.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const subscriptionContextSource = read('./SubscriptionContext.jsx');

describe('SubscriptionContext clears the signed-video-URL cache when the resolved plan/status actually changes', () => {
  it('imports clearSignedVideoUrlCache from the cache module', () => {
    expect(subscriptionContextSource).toMatch(
      /import \{ clearSignedVideoUrlCache \} from '\.\.\/lib\/signedVideoUrlCache';/
    );
  });

  it('calls it inside an effect keyed on subscription.plan/status, guarded to skip the very first resolution', () => {
    const effectBody = subscriptionContextSource.match(
      /useEffect\(\(\) => \{\s*const previous = previousPlanRef\.current;[\s\S]*?\n {2}\}, \[subscription\.plan, subscription\.status\]\);/
    )?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/if \(previous !== undefined && previous !== current\) \{/);
    expect(effectBody).toMatch(/clearSignedVideoUrlCache\(\);/);
    expect(effectBody).toMatch(/previousPlanRef\.current = current;/);
  });

  it('the guard ref starts as undefined, not a real plan value, so mount/sign-in is never mistaken for a change', () => {
    expect(subscriptionContextSource).toMatch(/const previousPlanRef = useRef\(undefined\);/);
  });
});
