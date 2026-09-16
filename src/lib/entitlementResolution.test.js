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
