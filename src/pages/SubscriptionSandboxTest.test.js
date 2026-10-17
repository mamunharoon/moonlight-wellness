// WakeWise — RevenueCat sandbox test surface. Source-level checks, same
// convention as Subscription.test.js's own established pattern (no DOM/
// component renderer available in this repo's Vitest - see that file's
// header for why).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SubscriptionSandboxTest.jsx', import.meta.url)), 'utf-8');

describe('SubscriptionSandboxTest.jsx — build-time kill switch', () => {
  it('reads the shared isSubscriptionSandboxTestVisible() flag - never its own re-typed import.meta.env literal, so Settings.jsx\'s nav link can never drift out of sync with this page\'s own gate', () => {
    expect(source).toMatch(/import \{ isSubscriptionSandboxTestVisible \} from '\.\.\/lib\/featureFlags';/);
    // The literal env-var read itself must only ever happen once, inside
    // featureFlags.js - this page's own SANDBOX_TEST_ENABLED assignment
    // must be a plain call to the shared function, not a second,
    // independently-typed import.meta.env.* comparison (the doc comment
    // above it still explains the concept in prose, which is fine - this
    // checks the actual assignment statement only).
    expect(source).toMatch(/const SANDBOX_TEST_ENABLED = isSubscriptionSandboxTestVisible\(\);/);
    expect(source).not.toMatch(/const SANDBOX_TEST_ENABLED = import\.meta\.env/);
  });

  it('still renders only the inert stub when the flag is off', () => {
    expect(source).toMatch(/if \(!SANDBOX_TEST_ENABLED\) \{\s*\n\s*return <div style=\{\{ padding: 16 \}\}>Not available in this build\.<\/div>;/);
  });
});

describe('SubscriptionSandboxTest.jsx — Describe Google subscription options row', () => {
  it('imports describeGoogleSubscriptionOptions from the adapter', () => {
    expect(source).toMatch(/describeGoogleSubscriptionOptions/);
  });

  it('is wired as its own Row, reading the page\'s own already-fetched annualPackage - never re-fetching or purchasing', () => {
    const body = source.match(/<Row\s*\n\s*label="Describe Google subscription options[\s\S]*?\/>/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/onRun=\{run\('googleSubscriptionOptions', \(\) => describeGoogleSubscriptionOptions\(annualPackage\)\)\}/);
  });

  it('sits alongside the existing founder-option probe, never replacing it - both diagnostics stay available', () => {
    expect(source).toMatch(/label="Get Google founder subscription option \(read-only inspection — does not purchase\)"/);
    expect(source).toMatch(/label="Describe Google subscription options/);
  });
});
