import { describe, it, expect } from 'vitest';
import { resolveEntitlement as clientResolve } from './entitlementResolution.js';
import { resolveEntitlement as serverResolve } from '../../supabase/functions/_shared/entitlementResolution.ts';

// Deliberately duplicated implementations (see the server module's own
// header comment for why) — this test's only job is to prove the two
// copies never silently drift apart, across a representative spread of
// inputs, not to re-test the resolution rule itself (already covered by
// entitlementResolution.test.js).
describe('server-side entitlementResolution mirrors the client-side implementation exactly', () => {
  const cases = [
    [],
    [null, undefined],
    [{ provider: 'stripe', status: 'expired' }],
    [{ provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2027-01-01T00:00:00Z', lastVerifiedAt: '2026-09-01T00:00:00Z' }],
    [
      { provider: 'stripe', status: 'cancelled', currentPeriodExpiresAt: '2026-10-01T00:00:00Z', lastVerifiedAt: '2026-09-10T00:00:00Z' },
      { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2027-02-01T00:00:00Z', lastVerifiedAt: '2026-09-15T00:00:00Z' }
    ],
    [
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2027-01-01T00:00:00Z', lastVerifiedAt: '2026-09-16T00:00:00Z' },
      { provider: 'apple', status: 'trial', currentPeriodExpiresAt: '2026-10-01T00:00:00Z', lastVerifiedAt: '2026-09-01T00:00:00Z' }
    ],
    [{ provider: 'apple', status: 'grace_period', currentPeriodExpiresAt: null, lastVerifiedAt: '2026-09-16T00:00:00Z' }],
    [{ provider: 'apple', status: 'billing_retry', lastVerifiedAt: '2026-09-16T00:00:00Z' }],
    [{ provider: 'apple', status: 'refunded' }, { provider: 'stripe', status: 'revoked' }]
  ];

  it.each(cases)('agrees for input %#', (input) => {
    expect(serverResolve(input)).toEqual(clientResolve(input));
  });
});
