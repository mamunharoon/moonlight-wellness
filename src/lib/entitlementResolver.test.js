// WakeWise Phase 2B — unified entitlement resolver. Real execution: this
// is a plain, framework-agnostic function, so its actual decision logic is
// exercised directly with fixtures rather than via source regex.
import { describe, it, expect } from 'vitest';
import { resolveUnifiedEntitlement, getManagementDestination, ENTITLEMENT_STATES } from './entitlementResolver';

describe('resolveUnifiedEntitlement — loading and error states never fabricate a plan', () => {
  it('loading', () => {
    const result = resolveUnifiedEntitlement({ loading: true }, [{ provider: 'stripe', status: 'active' }]);
    expect(result.state).toBe(ENTITLEMENT_STATES.LOADING);
    expect(result.isEntitled).toBe(false);
  });

  it('a real read error surfaces as verification_unavailable, never as free', () => {
    const result = resolveUnifiedEntitlement({ loading: false, error: 'boom' }, []);
    expect(result.state).toBe(ENTITLEMENT_STATES.VERIFICATION_UNAVAILABLE);
    expect(result.isEntitled).toBe(false);
  });
});

describe('resolveUnifiedEntitlement — no records at all', () => {
  it('free, with every optional field null/false, never fabricated', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, []);
    expect(result).toEqual({
      state: ENTITLEMENT_STATES.FREE,
      isEntitled: false,
      provider: null,
      product: null,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      managementDestination: null,
      lastVerifiedSource: null
    });
  });
});

describe('resolveUnifiedEntitlement — single-provider states', () => {
  it('trial (Stripe)', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'trial', currentPeriodExpiresAt: null, cancelAtPeriodEnd: false, lastVerifiedAt: '2026-01-01T00:00:00Z' }
    ]);
    expect(result.state).toBe(ENTITLEMENT_STATES.TRIAL);
    expect(result.isEntitled).toBe(true);
    expect(result.provider).toBe('stripe');
    expect(result.managementDestination).toBe('stripe_portal');
  });

  it('active (Apple), with a real product id carried through', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      {
        provider: 'apple',
        status: 'active',
        productId: 'com.zavaraai.wakewise.plus.monthly',
        currentPeriodExpiresAt: '2026-06-01T00:00:00Z',
        cancelAtPeriodEnd: false,
        lastVerifiedAt: '2026-05-01T00:00:00Z'
      }
    ]);
    expect(result.state).toBe(ENTITLEMENT_STATES.ACTIVE);
    expect(result.product).toBe('com.zavaraai.wakewise.plus.monthly');
    expect(result.managementDestination).toBe('apple_settings');
  });

  it('grace_period (Google) — a state Phase 2A explicitly could not express with the legacy table alone', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'google', status: 'grace_period', currentPeriodExpiresAt: '2026-06-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-20T00:00:00Z' }
    ]);
    expect(result.state).toBe(ENTITLEMENT_STATES.GRACE_PERIOD);
    expect(result.isEntitled).toBe(true);
    expect(result.managementDestination).toBe('google_play');
  });

  it('billing_issue (Apple)', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'apple', status: 'billing_retry', currentPeriodExpiresAt: null, cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-20T00:00:00Z' }
    ]);
    expect(result.state).toBe(ENTITLEMENT_STATES.BILLING_ISSUE);
    expect(result.isEntitled).toBe(true);
  });

  it('cancelled_active_until_period_end only fires with a real known period end - never a fabricated date', () => {
    const withDate = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2026-07-01T00:00:00Z', cancelAtPeriodEnd: true, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(withDate.state).toBe(ENTITLEMENT_STATES.CANCELLED_ACTIVE_UNTIL_PERIOD_END);
    expect(withDate.cancelAtPeriodEnd).toBe(true);

    const withoutDate = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: null, cancelAtPeriodEnd: true, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(withoutDate.state).toBe(ENTITLEMENT_STATES.ACTIVE);
  });

  it('a fully-lapsed cancelled record (no longer access-granting) resolves the same as expired - both mean "no access" once cancellation has taken effect', () => {
    const cancelled = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'cancelled', currentPeriodExpiresAt: '2026-01-01T00:00:00Z', cancelAtPeriodEnd: true, lastVerifiedAt: '2026-01-01T00:00:00Z' }
    ]);
    const expired = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'expired', currentPeriodExpiresAt: '2026-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-01-01T00:00:00Z' }
    ]);
    expect(cancelled.state).toBe(ENTITLEMENT_STATES.EXPIRED);
    expect(cancelled.isEntitled).toBe(false);
    expect(expired.state).toBe(ENTITLEMENT_STATES.EXPIRED);
  });
});

describe('resolveUnifiedEntitlement — multi-provider precedence ("losing one provider must not revoke access if another is active")', () => {
  it('an expired Stripe record alongside an active Apple record still resolves entitled, via Apple', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'expired', currentPeriodExpiresAt: '2026-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-01-01T00:00:00Z' },
      { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2026-06-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.isEntitled).toBe(true);
    expect(result.provider).toBe('apple');
  });

  it('between two simultaneously access-granting records, the most recently verified one wins - never "latest expiry wins"', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2027-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-01-01T00:00:00Z' },
      { provider: 'google', status: 'active', currentPeriodExpiresAt: '2026-06-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.provider).toBe('google');
  });

  it('a manual (admin-granted) record behaves like any other access-granting provider and has no management destination', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'manual', status: 'active', currentPeriodExpiresAt: null, cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.isEntitled).toBe(true);
    expect(result.managementDestination).toBeNull();
  });
});

describe('getManagementDestination — pure function of provider alone', () => {
  it('every known provider maps to its real destination, and an unrecognised provider maps to null rather than guessing', () => {
    expect(getManagementDestination('stripe')).toBe('stripe_portal');
    expect(getManagementDestination('apple')).toBe('apple_settings');
    expect(getManagementDestination('google')).toBe('google_play');
    expect(getManagementDestination('manual')).toBeNull();
    expect(getManagementDestination('revenuecat')).toBeNull();
    expect(getManagementDestination(undefined)).toBeNull();
  });
});
