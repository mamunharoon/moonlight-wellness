import { describe, it, expect } from 'vitest';
import { resolveEntitlement, hasActiveStripeOrAppleEntitlement, isAccessGrantingStatus } from './entitlementResolution';

// Apple Subscription Architecture task, Phase E.

describe('isAccessGrantingStatus', () => {
  it('grants for trial/active/grace_period/billing_retry', () => {
    ['trial', 'active', 'grace_period', 'billing_retry'].forEach((status) => {
      expect(isAccessGrantingStatus(status)).toBe(true);
    });
  });

  it('does not grant for cancelled/expired/refunded/revoked/unknown', () => {
    ['cancelled', 'expired', 'refunded', 'revoked', 'something-else', undefined, null].forEach((status) => {
      expect(isAccessGrantingStatus(status)).toBe(false);
    });
  });
});

describe('resolveEntitlement — unified rule: either provider active grants access', () => {
  it('grants when only a Stripe record is active', () => {
    const result = resolveEntitlement([{ provider: 'stripe', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z' }]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('stripe');
  });

  it('grants when only an Apple record is active', () => {
    const result = resolveEntitlement([{ provider: 'apple', status: 'trial', lastVerifiedAt: '2026-09-16T00:00:00Z' }]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });

  it('grants when both are active — picks the most recently verified as the reported provider', () => {
    const result = resolveEntitlement([
      { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-09-01T00:00:00Z' },
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z' }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });

  it('denies when neither provider is active', () => {
    const result = resolveEntitlement([
      { provider: 'stripe', status: 'cancelled', lastVerifiedAt: '2026-09-16T00:00:00Z' },
      { provider: 'apple', status: 'expired', lastVerifiedAt: '2026-09-16T00:00:00Z' }
    ]);
    expect(result).toEqual({ plan: 'free', status: 'active', activeProvider: null, expiresAt: null });
  });

  it('denies for an empty or malformed input, never throwing', () => {
    expect(resolveEntitlement([])).toEqual({ plan: 'free', status: 'active', activeProvider: null, expiresAt: null });
    expect(resolveEntitlement(null)).toEqual({ plan: 'free', status: 'active', activeProvider: null, expiresAt: null });
    expect(resolveEntitlement(undefined)).toEqual({ plan: 'free', status: 'active', activeProvider: null, expiresAt: null });
  });

  it('treats a record with no lastVerifiedAt as the least-recently-verified, not a crash', () => {
    const result = resolveEntitlement([
      { provider: 'manual', status: 'active', lastVerifiedAt: null },
      { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-01-01T00:00:00Z' }
    ]);
    expect(result.activeProvider).toBe('stripe');
  });

  it('reports the winning record expiry', () => {
    const result = resolveEntitlement([
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z', currentPeriodExpiresAt: '2026-10-16T00:00:00Z' }
    ]);
    expect(result.expiresAt).toBe('2026-10-16T00:00:00Z');
  });

  // WakeWise — native RevenueCat purchase integration (readiness-gap item
  // 10): an expired provider_subscriptions row (e.g. a lapsed Google/
  // RevenueCat trial, or a prior Apple purchase that has since expired)
  // must never override a genuinely active entitlement from another
  // provider — including when the expired row is the MORE RECENTLY
  // verified one, which would win the tie-break if it were allowed to
  // compete at all. This is true by construction (the `granting` filter
  // excludes non-access-granting statuses before the tie-break ever
  // runs), not by this test's own logic — the test exists to make that
  // guarantee explicit and regression-proof for the Apple-direct /
  // RevenueCat overlap this task introduces.
  it('an expired Google/RevenueCat record never outranks a genuinely active Apple entitlement, even when verified more recently', () => {
    const result = resolveEntitlement([
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-09-01T00:00:00Z' },
      { provider: 'google', status: 'expired', lastVerifiedAt: '2026-10-05T00:00:00Z' }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });

  it('an expired Apple record (direct-verification path) never outranks a genuinely active Google/RevenueCat entitlement', () => {
    const result = resolveEntitlement([
      { provider: 'apple', status: 'expired', lastVerifiedAt: '2026-10-05T00:00:00Z' },
      { provider: 'google', status: 'active', lastVerifiedAt: '2026-09-01T00:00:00Z' }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('google');
  });

  it('two verified-source-distinct records for the same real-world Apple purchase (RevenueCat webhook + direct Apple server notification both write provider="apple") resolve to one winner, never a conflicting double-count', () => {
    // Mirrors what apply_verified_apple_subscription_event's own ownership
    // lock guarantees at the DB layer: both write paths key on the same
    // apple_original_transaction_id, so a user only ever has ONE
    // provider_subscriptions row for provider='apple' regardless of which
    // path (or both) most recently verified it. Modelled here as the
    // single resulting record this app's read layer would ever see.
    const result = resolveEntitlement([{ provider: 'apple', status: 'active', lastVerifiedAt: '2026-10-05T00:00:00Z' }]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });

  // Native purchase integration validation: "equal-time events cannot
  // incorrectly change ownership or revoke valid access." Two genuinely
  // DIFFERENT providers' records can legitimately share the exact same
  // lastVerifiedAt (e.g. two webhooks processed in the same read-refresh
  // window) — the tie-break must be deterministic (never flip which
  // provider "wins" between renders/reads for the same input) and must
  // never cause either record to be treated as revoked.
  it('an exact tie in lastVerifiedAt between two active records is resolved deterministically (first-of-ties wins, stable across repeated calls), never randomly, and never revokes either record', () => {
    const tiedRecords = [
      { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-10-05T12:00:00Z' },
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-10-05T12:00:00Z' }
    ];
    const first = resolveEntitlement(tiedRecords);
    const second = resolveEntitlement(tiedRecords);
    const third = resolveEntitlement([...tiedRecords]); // a fresh array, same order/content
    expect(first.plan).toBe('plus');
    expect(first).toEqual(second);
    expect(first).toEqual(third);
    // Both records independently still grant access on their own (neither
    // the tie nor the chosen `activeProvider` ever implies the OTHER
    // provider's record was revoked or is now invalid) — proven by each
    // one alone still resolving to 'plus'.
    expect(resolveEntitlement([tiedRecords[0]]).plan).toBe('plus');
    expect(resolveEntitlement([tiedRecords[1]]).plan).toBe('plus');
  });

  it('a tie between an active record and an expired record is never ambiguous - the expired one was already excluded before any timestamp comparison happens', () => {
    const result = resolveEntitlement([
      { provider: 'google', status: 'expired', lastVerifiedAt: '2026-10-05T12:00:00Z' },
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-10-05T12:00:00Z' }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });
});

describe('hasActiveStripeOrAppleEntitlement', () => {
  it('is true if either is active', () => {
    expect(
      hasActiveStripeOrAppleEntitlement({ provider: 'stripe', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z' }, null)
    ).toBe(true);
    expect(
      hasActiveStripeOrAppleEntitlement(null, { provider: 'apple', status: 'trial', lastVerifiedAt: '2026-09-16T00:00:00Z' })
    ).toBe(true);
  });

  it('is false if neither is active', () => {
    expect(
      hasActiveStripeOrAppleEntitlement(
        { provider: 'stripe', status: 'expired', lastVerifiedAt: '2026-09-16T00:00:00Z' },
        { provider: 'apple', status: 'cancelled', lastVerifiedAt: '2026-09-16T00:00:00Z' }
      )
    ).toBe(false);
  });

  it('is false when both are entirely absent', () => {
    expect(hasActiveStripeOrAppleEntitlement(null, null)).toBe(false);
    expect(hasActiveStripeOrAppleEntitlement(undefined, undefined)).toBe(false);
  });
});
