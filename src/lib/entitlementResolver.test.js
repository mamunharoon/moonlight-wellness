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
    // A real, future expiry — a real Stripe trial row always carries one
    // (its own trial end date); null was never a realistic fixture for
    // this provider once the expiry guard (client fix) treats a missing
    // expiry on a recurring provider as a data-integrity problem, not an
    // implicit unlimited trial.
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'trial', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-01-01T00:00:00Z' }
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
        currentPeriodExpiresAt: '2099-01-01T00:00:00Z',
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
      { provider: 'google', status: 'grace_period', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-20T00:00:00Z' }
    ]);
    expect(result.state).toBe(ENTITLEMENT_STATES.GRACE_PERIOD);
    expect(result.isEntitled).toBe(true);
    expect(result.managementDestination).toBe('google_play');
  });

  it('billing_issue (Apple) — still governed by the same real-expiry requirement as active (a grace/retry status is a bounded continuation up to a known expiry, never unconditional)', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'apple', status: 'billing_retry', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-20T00:00:00Z' }
    ]);
    expect(result.state).toBe(ENTITLEMENT_STATES.BILLING_ISSUE);
    expect(result.isEntitled).toBe(true);
  });

  it('cancelled_active_until_period_end only fires with a real known period end - never a fabricated date', () => {
    const withDate = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', cancelAtPeriodEnd: true, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(withDate.state).toBe(ENTITLEMENT_STATES.CANCELLED_ACTIVE_UNTIL_PERIOD_END);
    expect(withDate.cancelAtPeriodEnd).toBe(true);

    // Behaviour change from the client expiry-guard fix: a recurring
    // provider (stripe here) with NO real expires_at is now a
    // data-integrity problem that fails closed entirely — it is no
    // longer "ACTIVE, just without a displayable cancellation date." The
    // 'manual' provider is the only one a missing expiry is ever
    // legitimate for (see the manual-grant test below).
    const withoutDate = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: null, cancelAtPeriodEnd: true, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(withoutDate.state).toBe(ENTITLEMENT_STATES.EXPIRED);
    expect(withoutDate.isEntitled).toBe(false);
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
      { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.isEntitled).toBe(true);
    expect(result.provider).toBe('apple');
  });

  it('between two simultaneously access-granting records, the most recently verified one wins - never "latest expiry wins"', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-01-01T00:00:00Z' },
      { provider: 'google', status: 'active', currentPeriodExpiresAt: '2099-06-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
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

  it('a manual grant with a real, already-past expiry does not grant — never an unconditional bypass just because provider==="manual" (Phase 2C §9a)', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.isEntitled).toBe(false);
    expect(result.state).toBe(ENTITLEMENT_STATES.EXPIRED);
  });

  it('a manual grant does not block a separately-valid provider record on the same account once it has lapsed', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' },
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-01-01T00:00:00Z' }
    ]);
    expect(result.isEntitled).toBe(true);
    expect(result.provider).toBe('stripe');
  });

  // Live-DEV scenario this fix addresses (read-only investigation
  // finding) — expired Google (stale 'active' status, real period
  // already elapsed) + valid Apple (status active, real period still
  // current): resolves via Apple, with Apple's own real expiry and
  // product displayed, never Google's.
  it('expired Google (stale active status) + valid Apple → resolves via Apple, with Apple\'s own provider/date/product displayed', () => {
    const now = new Date('2026-10-18T03:41:38Z');
    const result = resolveUnifiedEntitlement(
      { loading: false },
      [
        {
          provider: 'google',
          status: 'active',
          productId: 'com.zavaraai.wakewise.plus.annual:yearly',
          currentPeriodExpiresAt: '2026-10-17T08:06:28Z',
          cancelAtPeriodEnd: true,
          lastVerifiedAt: '2026-10-17T08:07:01Z'
        },
        {
          provider: 'apple',
          status: 'active',
          productId: 'com.zavaraai.wakewise.plus.annual',
          currentPeriodExpiresAt: '2026-10-18T06:39:33Z',
          cancelAtPeriodEnd: true,
          lastVerifiedAt: '2026-10-17T06:39:38Z'
        }
      ],
      now
    );
    expect(result.isEntitled).toBe(true);
    expect(result.provider).toBe('apple');
    expect(result.product).toBe('com.zavaraai.wakewise.plus.annual');
    expect(result.currentPeriodEnd).toBe('2026-10-18T06:39:33Z');
    expect(result.managementDestination).toBe('apple_settings');
    expect(result.state).toBe(ENTITLEMENT_STATES.CANCELLED_ACTIVE_UNTIL_PERIOD_END);
  });

  it('all providers expired (no expiry webhook ever flips a stale "active" status) → resolves Free/Expired, never leaves a stale Plus showing', () => {
    const now = new Date('2026-10-19T00:00:00Z'); // after both providers' real expiry below
    const result = resolveUnifiedEntitlement(
      { loading: false },
      [
        { provider: 'google', status: 'active', currentPeriodExpiresAt: '2026-10-17T08:06:28Z', cancelAtPeriodEnd: true, lastVerifiedAt: '2026-10-17T08:07:01Z' },
        { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2026-10-18T06:39:33Z', cancelAtPeriodEnd: true, lastVerifiedAt: '2026-10-17T06:39:38Z' }
      ],
      now
    );
    expect(result.isEntitled).toBe(false);
    expect(result.state).toBe(ENTITLEMENT_STATES.EXPIRED);
    expect(result.provider).toBeNull();
  });

  it('missing expiry on a recurring provider denies, even as the sole candidate (data-integrity problem, not implicit unlimited access)', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'apple', status: 'active', currentPeriodExpiresAt: null, cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.isEntitled).toBe(false);
    expect(result.state).toBe(ENTITLEMENT_STATES.EXPIRED);
  });

  it('an invalid/unparseable expiry on a recurring provider denies, the same as a missing one', () => {
    const result = resolveUnifiedEntitlement({ loading: false }, [
      { provider: 'google', status: 'active', currentPeriodExpiresAt: 'not-a-real-date', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-05-01T00:00:00Z' }
    ]);
    expect(result.isEntitled).toBe(false);
    expect(result.state).toBe(ENTITLEMENT_STATES.EXPIRED);
  });

  // "Expiry crossing without a webhook" at the resolver level: the exact
  // same records, resolved against two different `now` instants either
  // side of the stored expiry, flip from entitled to not — proving the
  // resolver itself re-derives currency from `now` on every call, rather
  // than caching "was granting" from an earlier read. SubscriptionContext's
  // own expiry-timer effect is what re-invokes this with a fresh `now` as
  // real time passes while the app is mounted (see that file and
  // subscriptionContextExpiry.test.js for the end-to-end version of this).
  it('the same unresolved records flip from entitled to not, purely as `now` crosses the stored expiry — no new record, no webhook', () => {
    const records = [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2026-10-18T12:00:00Z', cancelAtPeriodEnd: false, lastVerifiedAt: '2026-10-17T00:00:00Z' }
    ];
    const before = resolveUnifiedEntitlement({ loading: false }, records, new Date('2026-10-18T11:59:59Z'));
    const after = resolveUnifiedEntitlement({ loading: false }, records, new Date('2026-10-18T12:00:01Z'));
    expect(before.isEntitled).toBe(true);
    expect(after.isEntitled).toBe(false);
    expect(after.state).toBe(ENTITLEMENT_STATES.EXPIRED);
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
