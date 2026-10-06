// WakeWise — explicit-currency price display helper.
//
// Root cause this exists to address: a RevenueCat/StoreKit TestFlight
// sandbox tester saw WakeWise's own price label read "$6.99" while
// Apple's own purchase-confirmation sheet read "A$9.99" for the exact
// same monthly product. This is a documented RevenueCat/Apple TestFlight
// quirk, not a WakeWise bug: RevenueCat's own docs
// (https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store)
// state "Paywalls or getOfferings() may return prices in USD when
// testing through TestFlight, even if the tester's storefront is set to
// another country ... Apple's purchase sheet may still show the correct
// local currency." WakeWise's own $6.99 figure is the approved USD base
// price (see revenueCatConfig.js's APPROVED_FUTURE_USD_PRICES.monthly) —
// StoreKit itself handed this app that exact number under TestFlight, not
// a value this app invented.
//
// The one thing actually within this app's control is never leaving a
// bare, currency-ambiguous "$" on screen — a bare "$6.99" reads as
// whatever currency the viewer assumes (often their own local one), which
// is exactly how a USD figure gets mistaken for AUD. This module always
// renders the ISO 4217 currency code the provider itself reported
// (RevenueCat/StoreKit/Play Billing on native, the configured Stripe
// Price's own currency on web) alongside the amount — never inferred from
// device language/locale, never converted, never a different number than
// what the provider actually reported.
//
// Intl.NumberFormat's own `currencyDisplay: 'code'` option is used
// specifically so the ISO code is always shown (e.g. "AUD 9.99", "USD
// 6.99") instead of a symbol — the `locale` argument passed in only
// controls number formatting conventions (decimal separator, digit
// grouping), never which currency is shown; the currency itself is always
// the explicit `currencyCode` argument, taken directly from the provider.
export const formatExplicitCurrencyAmount = (amount, currencyCode) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (typeof currencyCode !== 'string' || currencyCode.trim().length === 0) return null;
  try {
    // Intl inserts a non-breaking space (U+00A0) between the code and the
    // amount — normalized to a plain space so the result is predictable
    // for exact-match comparisons (tests, logs) and never surprises a
    // caller with an invisible character; purely cosmetic, never affects
    // the actual code or amount shown.
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'code'
    }).format(amount);
    return formatted.split(String.fromCharCode(160)).join(' ');
  } catch {
    // An unrecognised currency string (never expected from a real
    // provider response) — still shows the real code and amount rather
    // than silently hiding the price or guessing a symbol.
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
};

/**
 * Native (RevenueCat) price formatting — takes the provider's own `price`
 * (number, already in the storefront's local currency) and `currencyCode`
 * (ISO 4217) straight off a RevenueCat `StoreProduct`, exactly as
 * documented in @revenuecat/purchases-typescript-internal-esm's
 * offerings.d.ts. Never reads `priceString` (whose formatted symbol is
 * exactly the ambiguous presentation this module exists to replace).
 * Returns null if the product is missing either field — callers must
 * show an explicit unavailable state, never a different/guessed price.
 */
export const formatNativeStorePrice = (product) => formatExplicitCurrencyAmount(product?.price, product?.currencyCode);

/**
 * Google Play's own `Price` shape (RevenueCat's SubscriptionOption
 * pricing phases) reports `amountMicros` — 1,000,000 micro-units equal
 * one unit of the currency — rather than a plain decimal. Used for the
 * founder-offer price (the one place this app surfaces a
 * SubscriptionOption's own price rather than a Package's). Returns null
 * for anything other than a real, finite micros amount — never a
 * guessed/divided-wrong number.
 */
export const formatGoogleMicrosPrice = (price) => {
  const amountMicros = price?.amountMicros;
  if (typeof amountMicros !== 'number' || !Number.isFinite(amountMicros)) return null;
  return formatExplicitCurrencyAmount(amountMicros / 1_000_000, price?.currencyCode);
};
