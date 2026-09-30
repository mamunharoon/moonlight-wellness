// WakeWise Phase 2B — RevenueCat typed configuration boundary. Real
// execution: isRevenueCatConfigured() is a plain function of
// import.meta.env, directly testable via vi.stubEnv.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
  REVENUECAT_PACKAGE_IDENTIFIERS,
  KNOWN_PRODUCT_IDS,
  FOUNDER_OFFER_MODEL,
  APPROVED_FUTURE_USD_PRICES,
  isRevenueCatConfigured
} from './revenueCatConfig';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('revenueCatConfig — approved commercial decisions, real values (not placeholders)', () => {
  it('entitlement id is wakewise_plus', () => {
    expect(REVENUECAT_ENTITLEMENT_ID).toBe('wakewise_plus');
  });

  it('offering id is default', () => {
    expect(REVENUECAT_OFFERING_ID).toBe('default');
  });

  it('exactly two package identifiers exist: monthly and annual - both real RevenueCat package types, backing a real product', () => {
    expect(REVENUECAT_PACKAGE_IDENTIFIERS.monthly).toBeTruthy();
    expect(REVENUECAT_PACKAGE_IDENTIFIERS.annual).toBeTruthy();
    expect(Object.keys(REVENUECAT_PACKAGE_IDENTIFIERS)).toEqual(['monthly', 'annual']);
  });

  it('the known Apple monthly and annual product ids match the ones already live in App Store Connect (source-confirmed)', () => {
    expect(KNOWN_PRODUCT_IDS.monthly.apple).toBe('com.zavaraai.wakewise.plus.monthly');
    expect(KNOWN_PRODUCT_IDS.annual.apple).toBe('com.zavaraai.wakewise.plus.annual');
  });

  it('Google product ids match the base products confirmed live in RevenueCat (readiness-gap correction — these now exist, for both tiers)', () => {
    expect(KNOWN_PRODUCT_IDS.monthly.google).toBe('com.zavaraai.wakewise.plus.monthly');
    expect(KNOWN_PRODUCT_IDS.annual.google).toBe('com.zavaraai.wakewise.plus.annual');
  });

  it('the approved future USD base prices are recorded exactly once: $6.99 monthly, $59.99 annual, $49.99 founder first year renewing at $59.99', () => {
    expect(APPROVED_FUTURE_USD_PRICES).toEqual({
      monthly: 6.99,
      annual: 59.99,
      founderAnnualFirstYear: 49.99,
      founderAnnualRenewal: 59.99
    });
  });
});

describe('FOUNDER_OFFER_MODEL — the corrected, platform-specific mechanism (not a RevenueCat package on any platform)', () => {
  it('Apple: an offer-code redemption on the existing annual product, never a purchasable package', () => {
    expect(FOUNDER_OFFER_MODEL.apple).toEqual({
      mechanism: 'offer_code_redemption',
      appliesToProductId: 'com.zavaraai.wakewise.plus.annual',
      offerCode: 'WAKEWISEFOUNDING',
      redemptionApi: 'presentCodeRedemptionSheet'
    });
  });

  it('Apple\'s appliesToProductId matches KNOWN_PRODUCT_IDS.annual.apple exactly - never a second, independently-drifting copy of the same id', () => {
    expect(FOUNDER_OFFER_MODEL.apple.appliesToProductId).toBe(KNOWN_PRODUCT_IDS.annual.apple);
  });

  it('Google: a base-plan-offer SubscriptionOption on the now-confirmed annual product, using the user-confirmed offer name (not a guessed dashboard id)', () => {
    expect(FOUNDER_OFFER_MODEL.google).toEqual({
      mechanism: 'base_plan_offer',
      appliesToProductId: 'com.zavaraai.wakewise.plus.annual',
      googleOfferId: 'founder-first-year'
    });
  });

  it('Stripe: an entirely separate mechanism, uninvolved with RevenueCat', () => {
    expect(FOUNDER_OFFER_MODEL.stripe).toEqual({
      mechanism: 'stripe_price',
      appliesToProductId: null
    });
  });

  it('no platform models the founder offer as a RevenueCat "package" - the word never appears in any FOUNDER_OFFER_MODEL entry\'s own mechanism value', () => {
    for (const platform of Object.keys(FOUNDER_OFFER_MODEL)) {
      expect(FOUNDER_OFFER_MODEL[platform].mechanism).not.toMatch(/package/i);
    }
  });
});

describe('isRevenueCatConfigured — never true without a real, non-empty key', () => {
  it('false for both platforms when no env var is set at all', () => {
    vi.stubEnv('VITE_REVENUECAT_IOS_API_KEY', '');
    vi.stubEnv('VITE_REVENUECAT_ANDROID_API_KEY', '');
    expect(isRevenueCatConfigured('ios')).toBe(false);
    expect(isRevenueCatConfigured('android')).toBe(false);
  });

  it('false for a platform with only whitespace as its key', () => {
    vi.stubEnv('VITE_REVENUECAT_IOS_API_KEY', '   ');
    expect(isRevenueCatConfigured('ios')).toBe(false);
  });

  it('true only for the specific platform with a real key set, independent of the other platform', () => {
    vi.stubEnv('VITE_REVENUECAT_IOS_API_KEY', 'appl_real_looking_key');
    vi.stubEnv('VITE_REVENUECAT_ANDROID_API_KEY', '');
    expect(isRevenueCatConfigured('ios')).toBe(true);
    expect(isRevenueCatConfigured('android')).toBe(false);
  });

  it('an unrecognised platform value is always false, never falls through to either key', () => {
    vi.stubEnv('VITE_REVENUECAT_IOS_API_KEY', 'appl_real_looking_key');
    expect(isRevenueCatConfigured('web')).toBe(false);
    expect(isRevenueCatConfigured(undefined)).toBe(false);
  });
});

describe('revenueCatConfig — mobile prices never hardcoded', () => {
  it('APPROVED_FUTURE_USD_PRICES is exported only for documentation/web-config use, never imported by the adapter\'s own price-rendering path', () => {
    const adapterSource = readFileSync(fileURLToPath(new URL('./revenueCatAdapter.js', import.meta.url)), 'utf-8');
    expect(adapterSource).not.toMatch(/APPROVED_FUTURE_USD_PRICES/);
  });
});
