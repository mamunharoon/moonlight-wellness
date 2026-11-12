// WakeWise — Legal, Subscription and Free-Trial Readiness — pricing config.
//
// The single source of truth for DISPLAYED subscription pricing, so the
// figures shown across the paywall, checkout, and legal copy can never
// drift from each other. This is a display config only — it does not
// create, read, or touch any Stripe product or price object.
//
// *** 2026-11-12: SWITCHED FROM A SINGLE-COUNTRY (AU) DISPLAY TO AN
// EXPLICIT "US REFERENCE PRICING" DISPLAY ***
// History: this file originally showed Australia-specific AUD pricing
// (9.99/59.99 monthly/annual), reconciled against App Store Connect's
// own Australia (AUD) listing for com.zavaraai.wakewise.plus.monthly /
// .annual. That remains Apple's real, approved AU storefront price —
// unchanged, not what this file disagrees with.
//
// The problem AUD display caused: this file's AUD figures are shown on
// the WEB subscription screen (Stripe checkout path only — native
// iOS/Android never reaches this file, see Subscription.jsx's own
// native/web branch comment), and whether Stripe's own configured Price
// objects (STRIPE_PRICE_PLUS_MONTHLY/YEARLY) actually charge AUD 9.99/
// 59.99 for a web purchase has never been confirmed — no Stripe
// Dashboard/API access is available from this codebase, and the two
// secrets' dollar values are masked by Supabase's own `secrets list`.
// Showing a specific AUD figure therefore risked advertising a number
// the web checkout might not actually charge.
//
// The approved fix (owner decision, 2026-11-12): display the approved
// USD reference prices instead — 6.99/month, 39.99/year — the same
// base USD tier already used for most non-AU App Store territories (see
// the live ASC pricing table: most countries list exactly these two
// USD figures) and already referenced in currencyDisplay.js's own
// header as "the approved USD base price"
// (APPROVED_FUTURE_USD_PRICES.monthly). Labelled explicitly as US
// reference pricing (usdReferencePricingDisclosureText, below) precisely
// because actual native per-territory pricing is confirmed to differ
// (Australia's own approved price is AUD 9.99/59.99, not a currency
// conversion of 6.99/39.99 — a different tier entirely), and the web
// checkout's real charged amount/currency remains unconfirmed against
// Stripe. This file still does not create, read, or touch any Stripe or
// App Store product/price object — it is a display config only.
export const CURRENCY = 'USD';
export const CURRENCY_SYMBOL = '$';

export const TRIAL_DAYS = 7;

export const MONTHLY_PRICE = 6.99;
export const ANNUAL_PRICE = 39.99;

// Founding-member introductory offer (see
// docs/founding-member-pricing-recommendation.md for the eligibility
// window and rollout approach — not wired into checkout yet; no Stripe
// object exists for this price today).
export const FOUNDING_ANNUAL_FIRST_YEAR_PRICE = 49.99;
export const FOUNDING_ANNUAL_RENEWAL_PRICE = ANNUAL_PRICE;

// Explicit-currency display: a bare "$" symbol is ambiguous — it reads as
// whatever currency the viewer assumes, which is exactly how a native
// TestFlight tester once mistook a USD figure for AUD (see
// currencyDisplay.js's own header for that incident). "US$" is used here
// instead of formatExplicitCurrencyAmount's usual ISO-code presentation
// ("USD 6.99") deliberately: this is the one screen in the app whose
// price is a cross-region US reference figure rather than a real,
// provider-reported local price, so it needs its own unambiguous, always-
// US-dollar label — and it must never silently change to a different
// currency symbol or format just because a viewer's browser locale is set
// to e.g. Australia. Built with plain string interpolation
// (amount.toFixed(2)), not Intl.NumberFormat, specifically so it can
// never pick up a locale's own decimal/grouping conventions or currency
// display — "US$6.99" is exactly what renders everywhere, always.
export const formatPrice = (amount) => `US$${amount.toFixed(2)}`;

// "This is a reference price, your real charge may differ" disclosure —
// required alongside the price display because the two real purchase
// paths are confirmed to charge differently from this USD reference and
// from each other: native iOS/Android goes through RevenueCat/StoreKit at
// each storefront's own approved local price (Australia's own approved
// price is AUD 9.99/59.99, confirmed directly in App Store Connect — not
// a currency conversion of 6.99/39.99, a different tier); the web
// checkout goes through Stripe, whose actual configured charge amount/
// currency has never been confirmed against this file (see the top-of-
// file note). Never state or imply this is what any specific checkout
// will charge.
export const usdReferencePricingDisclosureText = () =>
  'Prices shown are in US dollars (US$) as a general reference. The amount and currency you are actually charged may differ by region or purchase method — check your checkout or app store listing for the exact price before subscribing.';

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

// *** 2026-11-12: web-only "new checkouts disabled" mirror (U2 / Path A) ***
// PROD's real `create-checkout-session` Edge Function has carried a
// server-enforced kill switch since 2026-10-28, 08:47:49 UTC
// (`STRIPE_NEW_CHECKOUTS_DISABLED=true`, deployed from commit
// fd6dd261e90a33a8b9e59daf1f4e968517db544b under explicit owner approval
// — see reports/path-a-prod-execution-2026-10-28.md and
// reports/path-a-prod-approval-request-2026-10-28.md). It returns `503
// CHECKOUT_TEMPORARILY_DISABLED` before ever reaching Stripe, because
// PROD has no real Stripe webhook deployed (U2) to sync renewals,
// cancellations, or failed payments for a web subscriber afterward.
//
// This constant is a HAND-SYNCED MIRROR of that real secret, not a live
// read of it — there is no client-reachable way to read a Supabase
// secret's value. It exists so the web UI can proactively hide the
// Monthly/Yearly price cards and the "Upgrade to WakeWise Plus" button
// instead of offering an action that is guaranteed to fail, per the
// approval request's own explicit, still-standing hard constraint: *"Do
// not unset or flip STRIPE_NEW_CHECKOUTS_DISABLED while the PROD webhook
// gap (U2) remains unresolved. Re-enabling checkout is Path B's separate,
// later decision."*
//
// Flip this to `false` ONLY after ALL of the following, in order: (1)
// Path B (the real Stripe webhook, syncing renewals/cancellations/failed
// payments) is built, deployed to PROD, and verified against a real
// Stripe test-mode event; (2) the real PROD secret
// `STRIPE_NEW_CHECKOUTS_DISABLED` is itself unset/set to `false` by
// someone with Supabase access; (3) the Stripe Price objects behind
// STRIPE_PRICE_PLUS_MONTHLY/YEARLY have been read-verified (Stripe
// Dashboard or a restricted read-only API key — not available to this
// codebase) to actually charge what this file displays. Flipping only
// this client-side constant, without all three, would show a working
// Upgrade button for a checkout that still fails server-side.
export const WEB_CHECKOUT_TEMPORARILY_DISABLED = true;

// Same wording used in two places: the proactive replacement UI below
// (shown instead of the price cards/button, so most visitors never reach
// the backend at all) and the reactive fallback in Subscription.jsx's own
// checkout-error handler, for the one case the backend is still actually
// asked and it independently agrees checkout is disabled (confirms the
// two can never show different wording for the same state).
export const WEB_CHECKOUT_UNAVAILABLE_MESSAGE = 'Web subscriptions are temporarily unavailable. Please check back soon.';
