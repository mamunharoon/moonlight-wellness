import { describe, it, expect } from 'vitest';
import {
  isCurrentlyAccessGranting,
  isAuthorizedForPremiumAccess
} from '../../supabase/functions/_shared/entitlementResolution.ts';

// Phase 2C §6/§9a — direct, isolated coverage of isCurrentlyAccessGranting/
// isAuthorizedForPremiumAccess (server-only; no client mirror exists to
// cross-check against, unlike resolveEntitlement's own serverMirror.test.js).
// This round's review found a real mismatch between this code and the
// established rules: the original implementation treated provider==='manual'
// as an unconditional expiry bypass rather than §6's actual, narrower
// "a NULL expiry is the one legitimate exception" rule - §9a's own
// complimentary-tester-access design explicitly requires a real, honored
// expiry on every manual grant once that mechanism exists. Fixed in
// entitlementResolution.ts; these tests pin the corrected behaviour.
const NOW = new Date('2026-10-16T00:00:00Z');

describe('isCurrentlyAccessGranting — manual provider honors a real expiry when present', () => {
  it('a null expires_at is authorized for manual (the one documented exception)', () => {
    expect(isCurrentlyAccessGranting({ provider: 'manual', status: 'active', currentPeriodExpiresAt: null }, NOW)).toBe(true);
  });

  it('a real, still-future expires_at is authorized for manual', () => {
    expect(isCurrentlyAccessGranting({ provider: 'manual', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }, NOW)).toBe(
      true
    );
  });

  it('a real, already-past expires_at is DENIED for manual — never an unconditional bypass once a real expiry is set', () => {
    expect(isCurrentlyAccessGranting({ provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }, NOW)).toBe(
      false
    );
  });

  it('a manual record is still denied if its status is not access-granting, regardless of expires_at', () => {
    expect(isCurrentlyAccessGranting({ provider: 'manual', status: 'expired', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }, NOW)).toBe(
      false
    );
  });
});

describe('isCurrentlyAccessGranting — recurring providers unaffected by the fix', () => {
  it('stripe/apple/google still fail closed on a missing expires_at', () => {
    for (const provider of ['stripe', 'apple', 'google']) {
      expect(isCurrentlyAccessGranting({ provider, status: 'active', currentPeriodExpiresAt: null }, NOW)).toBe(false);
    }
  });

  it('stripe/apple/google still grant access for a real future expiry and deny for a real past one', () => {
    for (const provider of ['stripe', 'apple', 'google']) {
      expect(isCurrentlyAccessGranting({ provider, status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }, NOW)).toBe(true);
      expect(isCurrentlyAccessGranting({ provider, status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }, NOW)).toBe(false);
    }
  });
});

describe('isAuthorizedForPremiumAccess — pure OR across providers, using the corrected per-record rule', () => {
  it('an expired manual grant does not block a separately-valid provider record on the same account', () => {
    const records = [
      { provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' },
      { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }
    ];
    expect(isAuthorizedForPremiumAccess(records, NOW)).toBe(true);
  });

  it('an expired manual grant alone (no other provider) denies access', () => {
    const records = [{ provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }];
    expect(isAuthorizedForPremiumAccess(records, NOW)).toBe(false);
  });

  it('never throws on malformed/empty input and defaults to false', () => {
    expect(isAuthorizedForPremiumAccess([], NOW)).toBe(false);
    expect(isAuthorizedForPremiumAccess(null, NOW)).toBe(false);
    expect(isAuthorizedForPremiumAccess(undefined, NOW)).toBe(false);
    expect(isAuthorizedForPremiumAccess([null, undefined, {}], NOW)).toBe(false);
  });
});
