// WakeWise Phase 2B — RevenueCat event mapping. Real execution: every
// exported function here is pure, so its actual decision logic is
// exercised directly with fixtures. Cross-boundary import, same pattern
// as appleServerApi.test.js/appleJwsVerification.test.js — the real
// module lives under supabase/functions/_shared/ (imported unmodified by
// the Deno Edge Function) and is not itself Deno-specific, so it is
// directly importable and testable here too.
import { describe, it, expect } from 'vitest';
import {
  mapRevenueCatStoreToProvider,
  isRevenueCatTrialPeriod,
  mapRevenueCatEventToStateChange,
  REVENUECAT_EVENT_TYPES_WITH_STATE_CHANGE
} from '../../supabase/functions/_shared/revenueCatEventMapping.js';

describe('mapRevenueCatStoreToProvider — never invents a provider Stripe/Apple/Google/manual does not already allow', () => {
  it('APP_STORE and MAC_APP_STORE both map to apple', () => {
    expect(mapRevenueCatStoreToProvider('APP_STORE')).toBe('apple');
    expect(mapRevenueCatStoreToProvider('MAC_APP_STORE')).toBe('apple');
  });

  it('PLAY_STORE maps to google', () => {
    expect(mapRevenueCatStoreToProvider('PLAY_STORE')).toBe('google');
  });

  it('STRIPE is deliberately never mapped here - Stripe stays on its own separate webhook entirely', () => {
    expect(mapRevenueCatStoreToProvider('STRIPE')).toBeNull();
  });

  it('an unrecognised/unknown store is null, never guessed', () => {
    expect(mapRevenueCatStoreToProvider('AMAZON')).toBeNull();
    expect(mapRevenueCatStoreToProvider(undefined)).toBeNull();
  });
});

describe('isRevenueCatTrialPeriod', () => {
  it('TRIAL and INTRO both count as trial', () => {
    expect(isRevenueCatTrialPeriod('TRIAL')).toBe(true);
    expect(isRevenueCatTrialPeriod('INTRO')).toBe(true);
  });

  it('NORMAL and anything else does not', () => {
    expect(isRevenueCatTrialPeriod('NORMAL')).toBe(false);
    expect(isRevenueCatTrialPeriod(undefined)).toBe(false);
  });
});

describe('mapRevenueCatEventToStateChange — unknown/unhandled event types are always acknowledge-only (fail closed)', () => {
  it('an event type not in the allowlist returns null, never a guessed state change', () => {
    expect(mapRevenueCatEventToStateChange({ type: 'TEST' })).toBeNull();
    expect(mapRevenueCatEventToStateChange({ type: 'SUBSCRIPTION_PAUSED' })).toBeNull();
    expect(mapRevenueCatEventToStateChange({ type: 'NON_RENEWING_PURCHASE' })).toBeNull();
    expect(mapRevenueCatEventToStateChange({ type: 'SOMETHING_REVENUECAT_ADDS_LATER' })).toBeNull();
  });

  it('TRANSFER is deliberately acknowledge-only in this phase - real ownership-transfer handling is a documented, separate future task', () => {
    expect(mapRevenueCatEventToStateChange({ type: 'TRANSFER', transferred_from: ['a'], transferred_to: ['b'] })).toBeNull();
    expect(REVENUECAT_EVENT_TYPES_WITH_STATE_CHANGE.has('TRANSFER')).toBe(false);
  });

  it('null/missing event never throws', () => {
    expect(mapRevenueCatEventToStateChange(null)).toBeNull();
    expect(mapRevenueCatEventToStateChange(undefined)).toBeNull();
  });
});

describe('mapRevenueCatEventToStateChange — real state-changing events', () => {
  it('INITIAL_PURCHASE during a trial period maps to trial, not active', () => {
    const result = mapRevenueCatEventToStateChange({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL' });
    expect(result).toEqual({ status: 'trial', cancelAtPeriodEnd: undefined });
  });

  it('INITIAL_PURCHASE in a normal period maps to active', () => {
    const result = mapRevenueCatEventToStateChange({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL' });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: undefined });
  });

  it('RENEWAL maps to active and never independently toggles cancelAtPeriodEnd', () => {
    const result = mapRevenueCatEventToStateChange({ type: 'RENEWAL', period_type: 'NORMAL' });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: undefined });
  });

  it('CANCELLATION keeps the subscription active (or trial) until period end - access is never revoked by cancellation alone', () => {
    const active = mapRevenueCatEventToStateChange({ type: 'CANCELLATION', period_type: 'NORMAL' });
    expect(active).toEqual({ status: 'active', cancelAtPeriodEnd: true });

    const trial = mapRevenueCatEventToStateChange({ type: 'CANCELLATION', period_type: 'TRIAL' });
    expect(trial).toEqual({ status: 'trial', cancelAtPeriodEnd: true });
  });

  it('UNCANCELLATION clears cancelAtPeriodEnd', () => {
    const result = mapRevenueCatEventToStateChange({ type: 'UNCANCELLATION', period_type: 'NORMAL' });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: false });
  });

  it('EXPIRATION maps to expired, regardless of period_type', () => {
    const result = mapRevenueCatEventToStateChange({ type: 'EXPIRATION', period_type: 'NORMAL' });
    expect(result).toEqual({ status: 'expired', cancelAtPeriodEnd: undefined });
  });

  it('BILLING_ISSUE maps to billing_retry - access continues, mirroring this project\'s existing short-grace treatment', () => {
    const result = mapRevenueCatEventToStateChange({ type: 'BILLING_ISSUE' });
    expect(result).toEqual({ status: 'billing_retry', cancelAtPeriodEnd: undefined });
  });

  it('PRODUCT_CHANGE (e.g. monthly to annual, or into/out of the founder offer) resolves status from period_type alone, preserving any existing cancellation preference', () => {
    const result = mapRevenueCatEventToStateChange({ type: 'PRODUCT_CHANGE', period_type: 'NORMAL' });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: undefined });
  });
});
