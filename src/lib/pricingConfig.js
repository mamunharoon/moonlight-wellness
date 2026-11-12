// WakeWise — Legal, Subscription and Free-Trial Readiness — pricing config.
//
// The single source of truth for DISPLAYED subscription pricing, so the
// figures shown across the paywall, checkout, and legal copy can never
// drift from each other. This is a display config only — it does not
// create, read, or touch any Stripe product or price object.
//
// *** RECONCILED AGAINST APPLE'S OWN APPROVED AU PRICING — STILL NOT
// RECONCILED AGAINST STRIPE ***
// 2026-11-12: MONTHLY_PRICE corrected from 7.99 to 9.99. The web preview
// was showing 7.99, which matched neither of the two independent,
// authoritative references available: (1) App Store Connect's own
// "Current Pricing for New Subscribers" table for
// com.zavaraai.wakewise.plus.monthly lists Australia (AUD) $9.99 — read
// directly from ASC, not assumed; (2) this exact $9.99 figure is also
// the one already documented in currencyDisplay.js's own header, from a
// real RevenueCat/StoreKit TestFlight sandbox observation ("Apple's own
// purchase-confirmation sheet read 'A$9.99'"). ANNUAL_PRICE (59.99) was
// already correct — ASC's Australia (AUD) price for
// com.zavaraai.wakewise.plus.annual is also $59.99, confirmed the same
// way.
//
// What this does NOT establish: whether Stripe's own configured Price
// objects (STRIPE_PRICE_PLUS_MONTHLY / STRIPE_PRICE_PLUS_YEARLY — the
// Supabase Edge Function secrets create-checkout-session actually
// charges for web purchases) charge these same amounts. Those secrets'
// dollar values are still not readable from this codebase or from
// Supabase's own `secrets list` (which masks secret values), and no
// Stripe Dashboard/API access is available here. Do not assume web
// checkout now charges exactly 9.99/59.99 just because the display was
// corrected to match Apple's figures — someone with Stripe Dashboard
// access must still confirm the Price objects charge these exact
// amounts, or create/update them to match (the latter is explicitly a
// "create or alter Stripe products/prices" action requiring separate
// owner approval, never done implicitly by editing this file).
import { formatExplicitCurrencyAmount } from './currencyDisplay';

export const CURRENCY = 'AUD';
export const CURRENCY_SYMBOL = '$';

export const TRIAL_DAYS = 7;

export const MONTHLY_PRICE = 9.99;
export const ANNUAL_PRICE = 59.99;

// Founding-member introductory offer (see
// docs/founding-member-pricing-recommendation.md for the eligibility
// window and rollout approach — not wired into checkout yet; no Stripe
// object exists for this price today).
export const FOUNDING_ANNUAL_FIRST_YEAR_PRICE = 49.99;
export const FOUNDING_ANNUAL_RENEWAL_PRICE = ANNUAL_PRICE;

// Explicit-currency display (readiness-gap review): a bare "$" symbol is
// ambiguous — it reads as whatever currency the viewer assumes, which is
// exactly how a native TestFlight tester mistook a USD figure for AUD
// (see currencyDisplay.js's own header for the full incident). CURRENCY
// above is this app's own record of what the configured Stripe Price
// actually charges in (documented, not independently re-verified against
// the live Stripe Dashboard this session — see this file's own top-of-file
// note); formatExplicitCurrencyAmount renders it as an explicit ISO code
// ("AUD 7.99") instead of a bare symbol, the same presentation native
// purchases use, without changing the amount or currency itself.
const formatPrice = (amount) => formatExplicitCurrencyAmount(amount, CURRENCY) ?? `${CURRENCY} ${CURRENCY_SYMBOL}${amount.toFixed(2)}`;

export const formatMonthlyPrice = () => `${formatPrice(MONTHLY_PRICE)} per month`;
export const formatAnnualPrice = () => `${formatPrice(ANNUAL_PRICE)} per year`;

// Computed, not hardcoded, so it can never silently drift from the two
// prices above.
export const annualEffectiveMonthly = () => ANNUAL_PRICE / 12;
export const annualSavingsPercent = () => {
  const yearIfMonthly = MONTHLY_PRICE * 12;
  return Math.round(((yearIfMonthly - ANNUAL_PRICE) / yearIfMonthly) * 100);
};

export const trialDisclosureText = () =>
  `${TRIAL_DAYS} days free, then the selected plan renews automatically unless cancelled before the trial ends.`;

export const foundingMemberDisclosureText = () =>
  `Start with a ${TRIAL_DAYS}-day free trial, then ${formatPrice(FOUNDING_ANNUAL_FIRST_YEAR_PRICE)} for your first year. Your subscription renews at ${formatPrice(FOUNDING_ANNUAL_RENEWAL_PRICE)} per year unless cancelled before renewal.`;
