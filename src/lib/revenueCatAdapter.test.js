// WakeWise Phase 2B — RevenueCat adapter. Source-level checks, same
// convention as applePurchaseAdapter's own established pattern (no live
// SDK/native runtime available in this Vitest environment).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./revenueCatAdapter.js', import.meta.url)), 'utf-8');
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codeOnly = stripComments(source);

describe('revenueCatAdapter — every function gates on native + configured before touching the SDK', () => {
  for (const fn of [
    'configureRevenueCat',
    'logInRevenueCat',
    'logOutRevenueCat',
    'getPackage',
    'purchasePackage',
    'restoreRevenueCatPurchases',
    'getRevenueCatEntitlementSnapshot',
    'redeemAppleFounderOfferCode',
    'getGoogleFounderSubscriptionOption',
    'purchaseGoogleSubscriptionOption'
  ]) {
    it(`${fn} returns 'unavailable' rather than throwing when unsupported/unconfigured`, () => {
      const body = source.match(new RegExp(`export const ${fn} = async \\([^)]*\\) => \\{[\\s\\S]*?\\n\\};`))?.[0] ?? '';
      expect(body).not.toBe('');
      expect(body).toMatch(/outcome: 'unavailable'|return null;/);
    });
  }
});

describe('revenueCatAdapter — identity discipline', () => {
  it('logInRevenueCat requires a real supabaseUserId argument - never called with nothing', () => {
    const body = source.match(/export const logInRevenueCat = async \(supabaseUserId\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).toMatch(/!supabaseUserId\) return \{ outcome: 'unavailable' \};/);
    expect(body).toMatch(/Purchases\.logIn\(\{ appUserID: supabaseUserId \}\);/);
  });

  it('never passes an email, display name, or device id anywhere as an appUserID', () => {
    expect(codeOnly).not.toMatch(/appUserID:\s*(email|displayName|deviceId)/i);
  });
});

describe('revenueCatAdapter — never grants entitlement from a client callback', () => {
  it('purchasePackage resolves a plain summary, never writes plan/status/subscription itself', () => {
    expect(codeOnly).not.toMatch(/setSubscription\(|plan:\s*'plus'/);
  });

  it('distinguishes real cancellation (userCancelled) from a genuine failure', () => {
    const body = source.match(/export const purchasePackage = async \([\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(error\?\.userCancelled\) return \{ outcome: 'cancelled' \};/);
  });

  it('restore never infers "nothing to restore" from a timeout - no timer of any kind in this file', () => {
    expect(codeOnly).not.toMatch(/setTimeout|clearTimeout/);
  });
});

describe('revenueCatAdapter — never logs sensitive payloads', () => {
  it('console.warn calls only ever pass a plain error message, never the customerInfo/receipt variable itself as an argument', () => {
    const warnCalls = codeOnly.match(/console\.warn\([^)]*\)/g) ?? [];
    expect(warnCalls.length).toBeGreaterThan(0);
    for (const call of warnCalls) {
      // Matches the variable being passed as an argument (preceded by ', '
      // or '(' and followed by a word boundary) - not a log-prefix string
      // that merely mentions a method name like "getCustomerInfo failed".
      expect(call).not.toMatch(/[(,]\s*customerInfo\b/);
      expect(call).not.toMatch(/[(,]\s*(receipt|jwsRepresentation)\b/);
    }
  });
});

describe('revenueCatAdapter — offering/package selection never guesses', () => {
  it('getPackage resolves only the two real tiers - monthly and annual - never a third "founder" package, which does not exist on any platform', () => {
    const body = source.match(/export const getPackage = async \(tier\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(tier === 'monthly'\) return offering\.monthly \?\? null;/);
    expect(body).toMatch(/if \(tier === 'annual'\) return offering\.annual \?\? null;/);
    expect(body).not.toMatch(/founder/i);
  });

  it('an unrecognised tier falls through to a bare return null, rather than guessing a package', () => {
    const body = source.match(/export const getPackage = async \(tier\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    const annualCheckEnd = body.indexOf("if (tier === 'annual') return offering.annual ?? null;");
    const fallthroughReturn = body.indexOf('return null;', annualCheckEnd);
    expect(annualCheckEnd).toBeGreaterThan(-1);
    expect(fallthroughReturn).toBeGreaterThan(annualCheckEnd);
  });

  it('this file no longer imports or references REVENUECAT_PACKAGE_IDENTIFIERS at all - getPackage reads the SDK\'s own predefined offering.monthly/offering.annual accessors, never a package-identifier lookup', () => {
    expect(source).not.toMatch(/REVENUECAT_PACKAGE_IDENTIFIERS/);
  });
});

describe('revenueCatAdapter — founder offer: the corrected, platform-specific mechanisms (not a RevenueCat package)', () => {
  it('exposes the Apple and Google founder-offer models as plain config reads, never fabricating a value beyond what revenueCatConfig.js itself provides', () => {
    expect(source).toMatch(/export const getAppleFounderOfferModel = \(\) => FOUNDER_OFFER_MODEL\.apple;/);
    expect(source).toMatch(/export const getGoogleFounderOfferModel = \(\) => FOUNDER_OFFER_MODEL\.google;/);
  });

  it('redeemAppleFounderOfferCode calls presentCodeRedemptionSheet() - the real StoreKit/RevenueCat API for an offer code - never purchasePackage()', () => {
    const body = source.match(/export const redeemAppleFounderOfferCode = async \(\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/Purchases\.presentCodeRedemptionSheet\(\);/);
    expect(body).not.toMatch(/purchasePackage/);
    expect(body).toMatch(/currentPlatform\(\) !== 'ios'/);
  });

  it('never collects, logs, or transmits the redemption code text itself - the function takes no parameters at all, so there is nothing to collect', () => {
    expect(source).toMatch(/export const redeemAppleFounderOfferCode = async \(\) => \{/); // zero parameters
  });

  it('getGoogleFounderSubscriptionOption returns null whenever no real Google offer id is configured (true today) - never invents one', () => {
    const body = source.match(/export const getGoogleFounderSubscriptionOption = async \(\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/!googleOfferId\) return null;/);
    expect(body).toMatch(/currentPlatform\(\) !== 'android'/);
  });

  it('purchaseGoogleSubscriptionOption calls the Google-specific purchaseSubscriptionOption() API, distinct from purchasePackage()', () => {
    const body = source.match(/export const purchaseGoogleSubscriptionOption = async \(subscriptionOption\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/Purchases\.purchaseSubscriptionOption\(\{ subscriptionOption \}\);/);
    expect(body).toMatch(/if \(error\?\.userCancelled\) return \{ outcome: 'cancelled' \};/);
  });
});

describe('revenueCatAdapter — coexistence with the existing Apple-direct adapter', () => {
  it('does not import or call anything from applePurchaseAdapter.js - the two purchase paths stay fully separate until the documented cutover', () => {
    expect(source).not.toMatch(/from '\.\/applePurchaseAdapter'/);
  });

  it('documents the migration strategy required before both adapters could safely coexist in one purchase flow', () => {
    expect(source).toMatch(/duplicate listeners/i);
    expect(source).toMatch(/CUTOVER, not a merge/);
  });
});
