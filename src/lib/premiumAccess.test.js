import { describe, it, expect } from 'vitest';
import { PREMIUM_GATE, resolvePremiumGate, isPremiumLocked } from './premiumAccess';

const entitlement = (overrides = {}) => ({ state: 'free', isEntitled: false, ...overrides });

describe('resolvePremiumGate — non-premium content is always allowed', () => {
  it('a free entry is allowed regardless of entitlement state', () => {
    expect(resolvePremiumGate({ premium: false }, entitlement({ state: 'loading' }))).toBe(PREMIUM_GATE.ALLOWED);
    expect(resolvePremiumGate({ premium: false }, entitlement({ state: 'expired' }))).toBe(PREMIUM_GATE.ALLOWED);
  });

  it('a missing/null entry (not yet resolved) is treated as allowed, never crashes', () => {
    expect(resolvePremiumGate(null, entitlement())).toBe(PREMIUM_GATE.ALLOWED);
    expect(resolvePremiumGate(undefined, entitlement())).toBe(PREMIUM_GATE.ALLOWED);
  });
});

describe('resolvePremiumGate — premium content', () => {
  const premiumEntry = { premium: true };

  it('is allowed for a genuinely entitled user, regardless of which state produced isEntitled', () => {
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'trial', isEntitled: true }))).toBe(PREMIUM_GATE.ALLOWED);
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'active', isEntitled: true }))).toBe(PREMIUM_GATE.ALLOWED);
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'cancelled_active_until_period_end', isEntitled: true }))).toBe(
      PREMIUM_GATE.ALLOWED
    );
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'grace_period', isEntitled: true }))).toBe(PREMIUM_GATE.ALLOWED);
  });

  it('is LOADING while the entitlement read is in flight — never LOCKED, so no paywall flashes before an existing subscriber is recognised', () => {
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'loading', isEntitled: false }))).toBe(PREMIUM_GATE.LOADING);
  });

  it('is VERIFICATION_UNAVAILABLE on a failed read — never silently LOCKED (which would read as an ordinary upsell) and never ALLOWED', () => {
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'verification_unavailable', isEntitled: false }))).toBe(
      PREMIUM_GATE.VERIFICATION_UNAVAILABLE
    );
  });

  it('is LOCKED for free/expired, once the read has genuinely resolved', () => {
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'free', isEntitled: false }))).toBe(PREMIUM_GATE.LOCKED);
    expect(resolvePremiumGate(premiumEntry, entitlement({ state: 'expired', isEntitled: false }))).toBe(PREMIUM_GATE.LOCKED);
  });
});

describe('isPremiumLocked', () => {
  it('is true only for the resolved LOCKED case, not LOADING/VERIFICATION_UNAVAILABLE/ALLOWED', () => {
    const premiumEntry = { premium: true };
    expect(isPremiumLocked(premiumEntry, entitlement({ state: 'free', isEntitled: false }))).toBe(true);
    expect(isPremiumLocked(premiumEntry, entitlement({ state: 'loading', isEntitled: false }))).toBe(false);
    expect(isPremiumLocked(premiumEntry, entitlement({ state: 'verification_unavailable', isEntitled: false }))).toBe(false);
    expect(isPremiumLocked(premiumEntry, entitlement({ state: 'active', isEntitled: true }))).toBe(false);
    expect(isPremiumLocked({ premium: false }, entitlement({ state: 'free', isEntitled: false }))).toBe(false);
  });
});
