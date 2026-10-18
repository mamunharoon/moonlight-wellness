import { describe, it, expect } from 'vitest';
import {
  resolveEntitlement,
  hasActiveStripeOrAppleEntitlement,
  isAccessGrantingStatus,
  isCurrentlyAccessGranting,
  isAuthorizedForPremiumAccess
} from './entitlementResolution';

// Apple Subscription Architecture task, Phase E.
//
// Client expiry-guard fix (readiness-gap item: the display resolver must
// match the already-deployed server media-authorization guard — see
// isCurrentlyAccessGranting's own header). Every fixture below that is
// meant to still grant now carries an explicit, far-future
// `currentPeriodExpiresAt` (2099) so these assertions never depend on the
// real wall clock relative to whenever this suite actually runs — a
// fixture dated, say, "2026-10-16" would silently start failing the
// moment real time passes that date, which is exactly the kind of
// flakiness an explicit `now` (or a deliberately far-future date) avoids.
const FAR_FUTURE = '2099-01-01T00:00:00Z';

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
    const result = resolveEntitlement([
      { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('stripe');
  });

  it('grants when only an Apple record is active', () => {
    const result = resolveEntitlement([
      { provider: 'apple', status: 'trial', lastVerifiedAt: '2026-09-16T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });

  it('grants when both are active — picks the most recently verified as the reported provider', () => {
    const result = resolveEntitlement([
      { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-09-01T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE },
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });

  it('denies when neither provider is active', () => {
    const result = resolveEntitlement([
      { provider: 'stripe', status: 'cancelled', lastVerifiedAt: '2026-09-16T00:00:00Z' },
      { provider: 'apple', status: 'expired', lastVerifiedAt: '2026-09-16T00:00:00Z' }
    ]);
    expect(result).toEqual({ plan: 'free', status: 'active', activeProvider: null, expiresAt: null, cancelAtPeriodEnd: false, productId: null });
  });

  it('denies for an empty or malformed input, never throwing', () => {
    const freeResult = { plan: 'free', status: 'active', activeProvider: null, expiresAt: null, cancelAtPeriodEnd: false, productId: null };
    expect(resolveEntitlement([])).toEqual(freeResult);
    expect(resolveEntitlement(null)).toEqual(freeResult);
    expect(resolveEntitlement(undefined)).toEqual(freeResult);
  });

  it('treats a record with no lastVerifiedAt as the least-recently-verified, not a crash', () => {
    const result = resolveEntitlement([
      { provider: 'manual', status: 'active', lastVerifiedAt: null, currentPeriodExpiresAt: null },
      { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-01-01T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
    ]);
    expect(result.activeProvider).toBe('stripe');
  });

  it('reports the winning record expiry', () => {
    // Explicit `now` — see this file's own header — rather than relying
    // on this fixture's 2026-10-16 date staying in the future forever.
    const now = new Date('2026-09-20T00:00:00Z');
    const result = resolveEntitlement(
      [{ provider: 'apple', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z', currentPeriodExpiresAt: '2026-10-16T00:00:00Z' }],
      now
    );
    expect(result.expiresAt).toBe('2026-10-16T00:00:00Z');
  });

  it('reports the winning record cancelAtPeriodEnd and productId directly, never re-derived by a provider+status re-lookup (two Google rows sharing the same provider+status would make a re-lookup pick the wrong one)', () => {
    const result = resolveEntitlement([
      {
        provider: 'google',
        status: 'active',
        lastVerifiedAt: '2026-09-01T00:00:00Z',
        currentPeriodExpiresAt: '2026-09-17T00:00:00Z', // already past — excluded
        cancelAtPeriodEnd: true,
        productId: 'stale-product'
      },
      {
        provider: 'google',
        status: 'active',
        lastVerifiedAt: '2026-10-17T00:00:00Z',
        currentPeriodExpiresAt: FAR_FUTURE, // the genuinely valid one
        cancelAtPeriodEnd: false,
        productId: 'real-product'
      }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('google');
    expect(result.productId).toBe('real-product');
    expect(result.cancelAtPeriodEnd).toBe(false);
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
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-09-01T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE },
      { provider: 'google', status: 'expired', lastVerifiedAt: '2026-10-05T00:00:00Z' }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });

  it('an expired Apple record (direct-verification path) never outranks a genuinely active Google/RevenueCat entitlement', () => {
    const result = resolveEntitlement([
      { provider: 'apple', status: 'expired', lastVerifiedAt: '2026-10-05T00:00:00Z' },
      { provider: 'google', status: 'active', lastVerifiedAt: '2026-09-01T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('google');
  });

  // The exact live-DEV scenario this fix addresses (read-only investigation
  // finding): a Google row whose real period has already elapsed but whose
  // `status` is still 'active' (cancellation ≠ immediate expiry — RevenueCat
  // only flips status on a LATER EXPIRATION event) was verified MORE
  // recently than a genuinely-still-valid Apple row, so the old
  // most-recent-lastVerifiedAt-wins tie-break picked Google and surfaced its
  // already-past date. The expiry guard must exclude the stale Google row
  // from the tie-break entirely, so Apple — still actually valid — wins,
  // with ITS OWN real (future) expiry displayed, never Google's past one.
  it('a stale "active" Google row verified more recently than a genuinely-valid Apple row never wins — the guard excludes it before any tie-break runs', () => {
    const now = new Date('2026-10-18T03:41:38Z');
    const result = resolveEntitlement(
      [
        {
          provider: 'google',
          status: 'active', // stale — cancellation event set this, but period has elapsed
          lastVerifiedAt: '2026-10-17T08:07:01Z', // more recently verified than Apple below
          currentPeriodExpiresAt: '2026-10-17T08:06:28Z', // already past relative to `now`
          cancelAtPeriodEnd: true,
          productId: 'com.zavaraai.wakewise.plus.annual:yearly'
        },
        {
          provider: 'apple',
          status: 'active',
          lastVerifiedAt: '2026-10-17T06:39:38Z',
          currentPeriodExpiresAt: '2026-10-18T06:39:33Z', // still future relative to `now`
          cancelAtPeriodEnd: true,
          productId: 'com.zavaraai.wakewise.plus.annual'
        }
      ],
      now
    );
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
    expect(result.expiresAt).toBe('2026-10-18T06:39:33Z');
    expect(result.productId).toBe('com.zavaraai.wakewise.plus.annual');
  });

  it('two verified-source-distinct records for the same real-world Apple purchase (RevenueCat webhook + direct Apple server notification both write provider="apple") resolve to one winner, never a conflicting double-count', () => {
    // Mirrors what apply_verified_apple_subscription_event's own ownership
    // lock guarantees at the DB layer: both write paths key on the same
    // apple_original_transaction_id, so a user only ever has ONE
    // provider_subscriptions row for provider='apple' regardless of which
    // path (or both) most recently verified it. Modelled here as the
    // single resulting record this app's read layer would ever see.
    const result = resolveEntitlement([
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-10-05T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
    ]);
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
      { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-10-05T12:00:00Z', currentPeriodExpiresAt: FAR_FUTURE },
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-10-05T12:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
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
      { provider: 'apple', status: 'active', lastVerifiedAt: '2026-10-05T12:00:00Z', currentPeriodExpiresAt: FAR_FUTURE }
    ]);
    expect(result.plan).toBe('plus');
    expect(result.activeProvider).toBe('apple');
  });
});

describe('isCurrentlyAccessGranting — the expiry guard itself', () => {
  const NOW = new Date('2026-10-18T00:00:00Z');

  it('denies a non-granting status regardless of expiry', () => {
    expect(isCurrentlyAccessGranting({ provider: 'stripe', status: 'expired', currentPeriodExpiresAt: FAR_FUTURE }, NOW)).toBe(false);
  });

  it('stripe/apple/google all fail closed on a missing expires_at — never implicit unlimited access', () => {
    for (const provider of ['stripe', 'apple', 'google']) {
      expect(isCurrentlyAccessGranting({ provider, status: 'active', currentPeriodExpiresAt: null }, NOW)).toBe(false);
      expect(isCurrentlyAccessGranting({ provider, status: 'active' }, NOW)).toBe(false); // field absent entirely
    }
  });

  it('stripe/apple/google all fail closed on an unparseable/invalid expiry string', () => {
    for (const provider of ['stripe', 'apple', 'google']) {
      expect(isCurrentlyAccessGranting({ provider, status: 'active', currentPeriodExpiresAt: 'not-a-date' }, NOW)).toBe(false);
    }
  });

  it('stripe/apple/google grant for a real future expiry and deny for a real past one', () => {
    for (const provider of ['stripe', 'apple', 'google']) {
      expect(isCurrentlyAccessGranting({ provider, status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }, NOW)).toBe(true);
      expect(isCurrentlyAccessGranting({ provider, status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }, NOW)).toBe(false);
    }
  });

  it('manual grants with a null expiry — the one documented exception', () => {
    expect(isCurrentlyAccessGranting({ provider: 'manual', status: 'active', currentPeriodExpiresAt: null }, NOW)).toBe(true);
  });

  it('manual honors a real expiry once one is set — never an unconditional bypass', () => {
    expect(isCurrentlyAccessGranting({ provider: 'manual', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }, NOW)).toBe(
      true
    );
    expect(isCurrentlyAccessGranting({ provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }, NOW)).toBe(
      false
    );
  });

  it('grace_period/billing_retry are governed by the same expiry rule as active — a bounded continuation, never unconditional', () => {
    for (const status of ['grace_period', 'billing_retry']) {
      expect(isCurrentlyAccessGranting({ provider: 'stripe', status, currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }, NOW)).toBe(true);
      expect(isCurrentlyAccessGranting({ provider: 'stripe', status, currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }, NOW)).toBe(false);
    }
  });
});

describe('isAuthorizedForPremiumAccess — pure OR across providers, using the corrected per-record rule', () => {
  const NOW = new Date('2026-10-18T00:00:00Z');

  it('one still-valid provider grants access even if another provider record on the same account has lapsed', () => {
    const records = [
      { provider: 'google', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' },
      { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }
    ];
    expect(isAuthorizedForPremiumAccess(records, NOW)).toBe(true);
  });

  it('denies when every provider record has lapsed', () => {
    const records = [
      { provider: 'google', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' },
      { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2019-01-01T00:00:00Z' },
      { provider: 'stripe', status: 'cancelled', currentPeriodExpiresAt: '2018-01-01T00:00:00Z' }
    ];
    expect(isAuthorizedForPremiumAccess(records, NOW)).toBe(false);
  });

  it('never throws on malformed/empty input and defaults to false', () => {
    expect(isAuthorizedForPremiumAccess([], NOW)).toBe(false);
    expect(isAuthorizedForPremiumAccess(null, NOW)).toBe(false);
    expect(isAuthorizedForPremiumAccess(undefined, NOW)).toBe(false);
    expect(isAuthorizedForPremiumAccess([null, undefined, {}], NOW)).toBe(false);
  });
});

describe('hasActiveStripeOrAppleEntitlement', () => {
  it('is true if either is active', () => {
    expect(
      hasActiveStripeOrAppleEntitlement(
        { provider: 'stripe', status: 'active', lastVerifiedAt: '2026-09-16T00:00:00Z', currentPeriodExpiresAt: FAR_FUTURE },
        null
      )
    ).toBe(true);
    expect(
      hasActiveStripeOrAppleEntitlement(null, {
        provider: 'apple',
        status: 'trial',
        lastVerifiedAt: '2026-09-16T00:00:00Z',
        currentPeriodExpiresAt: FAR_FUTURE
      })
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
