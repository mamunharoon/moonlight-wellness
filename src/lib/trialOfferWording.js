// WakeWise — trial / introductory-offer wording, reconciled against real
// per-product offer metadata instead of a single "annual only" assumption.
//
// Why this exists: a sandbox purchase on the iOS MONTHLY product recorded
// a genuine period_type: TRIAL event, even though the paywall copy this
// replaces only ever claimed a trial existed on the annual plan. Apple
// configures an introductory offer (including a free trial) per PRODUCT,
// independently for monthly and annual — this module never hardcodes
// which tier has one. Every function here is pure and takes the real
// offer data the caller already resolved (RevenueCat's own
// PurchasesStoreProduct.introPrice on iOS; a resolved Google
// SubscriptionOption's freePhase/introPhase on Android) rather than
// guessing from a product id or interval name.
//
// Eligibility discipline (never promise a trial every user will get):
// Apple's own checkTrialOrIntroductoryPriceEligibility doc says "the best
// course of action on unknown status is to display the non-intro
// pricing, to not create a misleading situation" — this module's
// UNKNOWN-status wording follows that same discipline while still
// surfacing that an offer exists (conditionally), since suppressing it
// entirely would hide a real offer from a genuinely eligible user just
// because this app cannot yet prove it. Android's eligibility check
// always returns UNKNOWN (RevenueCat-documented, Android has no
// per-user introductory-eligibility API) so Android trial wording is
// always conditional, never a firm promise.
//
// Sandbox wording is supplied BY THE CALLER (sandboxConfirmationClause),
// never decided in here: whether a sandbox build actually avoids a real
// charge is a platform-specific billing-policy fact (TestFlight always
// sandboxes iOS purchases; Google Play only avoids a real charge if the
// tester's account is configured as a Play Console License Tester — the
// client build flag alone proves neither), not something this
// framework-free wording module should assert on its own.
import { formatExplicitCurrencyAmount } from './currencyDisplay';

export const INTRO_ELIGIBILITY = Object.freeze({
  ELIGIBLE: 'ELIGIBLE',
  INELIGIBLE: 'INELIGIBLE',
  UNKNOWN: 'UNKNOWN',
  NO_INTRO_OFFER_EXISTS: 'NO_INTRO_OFFER_EXISTS'
});

const PERIOD_UNIT_LABELS = Object.freeze({ DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' });

/**
 * e.g. humanizePeriodLength('DAY', 7) -> '7-day'. Returns null (never a
 * guessed length) for any unit/count this app cannot describe.
 */
export const humanizePeriodLength = (periodUnit, numberOfUnits) => {
  const label = PERIOD_UNIT_LABELS[periodUnit];
  if (!label || !Number.isFinite(numberOfUnits) || numberOfUnits <= 0) return null;
  return `${numberOfUnits}-${label}`;
};

/**
 * @param {{price: number, currencyCode?: string, periodUnit: string, periodNumberOfUnits: number} | null} introOffer
 *   Real intro/trial pricing-phase data for ONE specific product — null
 *   means this product genuinely has no introductory offer/trial
 *   configured at all (never assumed from another product's data). A
 *   non-zero `price` is shown explicitly (via `currencyCode`, the SAME
 *   explicit-ISO-code presentation every other price in this app uses) —
 *   never just named "an introductory price" with no real figure, and
 *   never the product's standard/renewal price mistaken for the offer's
 *   own discounted amount.
 * @param {string | null | undefined} eligibilityStatus one of
 *   INTRO_ELIGIBILITY's values; treated the same as UNKNOWN if omitted.
 * @param {string} storeLabel e.g. 'the App Store' | 'Google Play' — whose
 *   purchase sheet actually confirms the real terms.
 * @param {string | null} [sandboxConfirmationClause] when provided
 *   (non-null), replaces the default "will confirm ... before you're
 *   charged" clause — the caller's own platform-accurate sandbox wording
 *   (see this file's own header for why that decision does not belong
 *   here). Omit/null for normal production wording.
 * @returns {string | null} the sentence to show, or null to make no
 *   trial/intro claim at all for this product.
 */
export const describeIntroOfferWording = (introOffer, eligibilityStatus, storeLabel, sandboxConfirmationClause = null) => {
  if (eligibilityStatus === INTRO_ELIGIBILITY.NO_INTRO_OFFER_EXISTS) return null;
  if (!introOffer) return null;
  // A real offer exists on this product, but this specific user already
  // used it — say nothing, rather than repeat a claim the store itself
  // will reject at the purchase sheet.
  if (eligibilityStatus === INTRO_ELIGIBILITY.INELIGIBLE) return null;

  const isFreeTrial = introOffer.price === 0;
  const periodText = humanizePeriodLength(introOffer.periodUnit, introOffer.periodNumberOfUnits);
  const lengthPhrase = periodText ? `${periodText} ` : '';
  const formattedAmount = !isFreeTrial ? formatExplicitCurrencyAmount(introOffer.price, introOffer.currencyCode) : null;
  // "an introductory price of AUD 2.99" when the real amount resolved;
  // falls back to the bare noun only if it genuinely could not (missing
  // currency code) — never a guessed or wrong figure.
  const offerNoun = isFreeTrial ? 'free trial' : formattedAmount ? `introductory price of ${formattedAmount}` : 'introductory price';

  const confirmationClause = sandboxConfirmationClause ?? `${storeLabel} will confirm the exact terms before you're charged`;

  if (eligibilityStatus === INTRO_ELIGIBILITY.ELIGIBLE) {
    return `You're eligible for a ${lengthPhrase}${offerNoun} — ${confirmationClause}.`;
  }

  // UNKNOWN, or not checked at all (e.g. every Android call): conditional
  // wording only — never asserts this specific user gets it.
  return `New subscribers may be eligible for a ${lengthPhrase}${offerNoun} — ${confirmationClause}.`;
};
