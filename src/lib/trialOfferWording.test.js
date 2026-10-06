// WakeWise — trial/introductory-offer wording (readiness-gap fix).
// Real-execution tests for pure functions, same convention as
// entitlementResolution.test.js.
import { describe, it, expect } from 'vitest';
import { humanizePeriodLength, describeIntroOfferWording, INTRO_ELIGIBILITY } from './trialOfferWording';

describe('humanizePeriodLength', () => {
  it('describes a real period length, matching the observed 7-day Apple intro offer', () => {
    expect(humanizePeriodLength('DAY', 7)).toBe('7-day');
    expect(humanizePeriodLength('WEEK', 1)).toBe('1-week');
    expect(humanizePeriodLength('MONTH', 1)).toBe('1-month');
    expect(humanizePeriodLength('YEAR', 1)).toBe('1-year');
  });

  it('returns null (never a guessed length) for an unrecognised unit or non-positive count', () => {
    expect(humanizePeriodLength('UNKNOWN', 7)).toBeNull();
    expect(humanizePeriodLength('DAY', 0)).toBeNull();
    expect(humanizePeriodLength('DAY', -1)).toBeNull();
    expect(humanizePeriodLength('DAY', null)).toBeNull();
    expect(humanizePeriodLength(null, 7)).toBeNull();
  });
});

describe('describeIntroOfferWording — never promises every user a trial', () => {
  const freeTrial7Days = { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7 };
  const discountedIntro = { price: 2.99, currencyCode: 'AUD', periodUnit: 'MONTH', periodNumberOfUnits: 1 };

  it('makes no claim at all when the product genuinely has no intro/trial offer', () => {
    expect(describeIntroOfferWording(null, undefined, 'the App Store')).toBeNull();
  });

  it('makes no claim when the SDK itself reports NO_INTRO_OFFER_EXISTS, even if introOffer data were somehow passed', () => {
    expect(describeIntroOfferWording(freeTrial7Days, INTRO_ELIGIBILITY.NO_INTRO_OFFER_EXISTS, 'the App Store')).toBeNull();
  });

  it('makes no claim for a user confirmed INELIGIBLE - never repeats an offer this specific user cannot get', () => {
    expect(describeIntroOfferWording(freeTrial7Days, INTRO_ELIGIBILITY.INELIGIBLE, 'the App Store')).toBeNull();
  });

  it('ELIGIBLE: states the real offer confidently, naming the free trial and its real length', () => {
    const wording = describeIntroOfferWording(freeTrial7Days, INTRO_ELIGIBILITY.ELIGIBLE, 'the App Store');
    expect(wording).toMatch(/You're eligible for a 7-day free trial/);
    expect(wording).not.toMatch(/may be eligible/);
  });

  it('UNKNOWN (or unchecked, e.g. every Android call): conditional "may be eligible" wording, never a firm promise', () => {
    const wording = describeIntroOfferWording(freeTrial7Days, INTRO_ELIGIBILITY.UNKNOWN, 'Google Play');
    expect(wording).toMatch(/New subscribers may be eligible for a 7-day free trial/);
    expect(wording).toMatch(/Google Play will confirm the exact terms before you're charged/);
  });

  it('omitting eligibility entirely is treated the same as UNKNOWN - conditional wording, never a promise', () => {
    const wording = describeIntroOfferWording(freeTrial7Days, undefined, 'the App Store');
    expect(wording).toMatch(/may be eligible/);
  });

  it('a discounted (non-zero) intro price is described as an "introductory price", never mislabelled a "free trial", AND states the real offer amount - never the bare noun alone, never a guessed figure', () => {
    const wording = describeIntroOfferWording(discountedIntro, INTRO_ELIGIBILITY.ELIGIBLE, 'the App Store');
    expect(wording).toMatch(/introductory price of AUD 2\.99/);
    expect(wording).not.toMatch(/free trial/);
  });

  it('falls back to the bare "introductory price" noun (never a guessed amount) when the offer has no resolvable currency code', () => {
    const wording = describeIntroOfferWording({ price: 2.99, periodUnit: 'MONTH', periodNumberOfUnits: 1 }, INTRO_ELIGIBILITY.ELIGIBLE, 'the App Store');
    expect(wording).toMatch(/a 1-month introductory price —/);
  });

  it('a free trial never states an amount - there is nothing to charge', () => {
    const wording = describeIntroOfferWording(freeTrial7Days, INTRO_ELIGIBILITY.ELIGIBLE, 'the App Store');
    expect(wording).not.toMatch(/\d+\.\d\d/); // no "X.XX"-shaped price anywhere
    expect(wording).toMatch(/7-day free trial — the App Store/);
  });

  it('checks monthly and annual independently - two different introOffer values never produce the same claim by accident', () => {
    const monthlyWording = describeIntroOfferWording(freeTrial7Days, INTRO_ELIGIBILITY.ELIGIBLE, 'the App Store');
    const annualWording = describeIntroOfferWording(null, INTRO_ELIGIBILITY.NO_INTRO_OFFER_EXISTS, 'the App Store');
    expect(monthlyWording).not.toBeNull();
    expect(annualWording).toBeNull();
  });

  it('production copy (no sandbox clause given) says "before you\'re charged" - a real charge is expected', () => {
    const wording = describeIntroOfferWording(freeTrial7Days, INTRO_ELIGIBILITY.ELIGIBLE, 'the App Store');
    expect(wording).toMatch(/before you're charged/);
  });

  it('a caller-supplied sandbox clause replaces the production clause verbatim - this module never decides platform-specific sandbox billing claims itself', () => {
    const wording = describeIntroOfferWording(
      freeTrial7Days,
      INTRO_ELIGIBILITY.ELIGIBLE,
      'the App Store',
      "this sandbox build's own platform-accurate clause"
    );
    expect(wording).not.toMatch(/before you're charged/);
    expect(wording).toMatch(/this sandbox build's own platform-accurate clause\.$/);
  });
});
