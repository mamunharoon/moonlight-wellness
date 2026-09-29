// WakeWise Phase 2A correction — SubscriptionContext.jsx's loadSubscription
// (and therefore refreshSubscription) now returns the exact value it just
// set as state, so a caller like useAppleRestore.js can know the real,
// current entitlement immediately after an awaited refresh without racing
// this Provider's own re-render. Source-level check, same convention as
// this repo's other context tests (no DOM rendering available).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SubscriptionContext.jsx', import.meta.url)), 'utf-8');

const loadSubscriptionBody = () => source.match(/const loadSubscription = async \(currentUser\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('SubscriptionContext — refreshSubscription()/loadSubscription() return the resolved value', () => {
  it('setResolvedSubscription itself returns the exact (dev-override-applied) value it set as state', () => {
    const setterBody = source.match(/const setResolvedSubscription = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(setterBody).toMatch(/const resolved = applySubscriptionOverride\(value\);/);
    expect(setterBody).toMatch(/setSubscription\(resolved\);/);
    expect(setterBody).toMatch(/return resolved;/);
  });

  it('every return path in loadSubscription (guest/no-user, fetch error, success) returns the resolved value, never undefined', () => {
    const body = loadSubscriptionBody();
    const returnStatements = body.match(/return resolved;/g) ?? [];
    // guest/no-user branch, fetch-error branch, and the success path.
    expect(returnStatements.length).toBe(3);
    expect(body).not.toMatch(/return;\s*\n {4}\}/);
  });

  it('refreshSubscription is still just loadSubscription(user) - the new return value flows through automatically, no separate plumbing needed at the call site', () => {
    expect(source).toMatch(/const refreshSubscription = \(\) => loadSubscription\(user\);/);
  });

  it('this is purely additive - useEffect\'s own fire-and-forget call sites are untouched', () => {
    expect(source).toMatch(/const load = async \(\) => \{\s*\n\s*if \(authLoading\) return;\s*\n\s*await loadSubscription\(user\);\s*\n\s*\};/);
  });
});
