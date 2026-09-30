// WakeWise Phase 2B — RevenueCat typed configuration boundary.
//
// This file is the ONLY place a real RevenueCat dashboard identifier
// (entitlement/offering/package id) or a public platform SDK key is ever
// named. No other file should hardcode these strings — every consumer
// imports them from here, exactly like applePurchaseAdapter.js's own
// APPLE_PRODUCT_IDS is the one place Apple's product identifiers live.
//
// Per this phase's own instruction ("if the real identifiers are
// unavailable, implement a typed configuration boundary and tests, but
// stop before claiming purchase readiness"): the approved COMMERCIAL
// decisions below are real values, since those are product decisions this
// task confirmed — but the public SDK keys are read from environment
// variables that do not exist in this project's .env.local today
// (confirmed by direct inspection — no RevenueCat key of any kind is
// present). Until a real RevenueCat project/app exists and its public
// keys are added to the environment, isRevenueCatConfigured() returns
// false and every adapter function in revenueCatAdapter.js safely no-ops
// — this module never invents a key, never falls back to a placeholder
// string that could be mistaken for a real one.
//
// Public SDK keys are safe to ship client-side (RevenueCat's own
// documented model — they authorize a specific app/platform to talk to
// RevenueCat, they do not grant write/administrative access). They are
// still read from the environment rather than hardcoded, so a real key
// only ever needs to be set once, in .env.local (DEV) or the equivalent
// production environment variable — never edited into this source file.
//
// PRICING UPDATE (mid-Phase-2B correction — supersedes this file's
// original "monthly-only, annual/founder deferred and hidden" scope):
// three tiers are now approved to PREPARE (not activate): monthly
// (US$6.99), standard annual (US$59.99), and a founder annual launch
// offer (US$49.99 first year, renewing at US$59.99/year with clear
// renewal disclosure). These three USD figures are the approved BASE
// prices for setting each store's own price schedule and are NEVER used
// to render a mobile price directly — every mobile display always uses
// the store's own localised price string (see revenueCatAdapter.js's own
// getPackage()/priceString handling and applePurchaseAdapter.js's
// existing, identical discipline). They exist here only as documentation
// of the approved commercial decision and for the web/Stripe
// configuration path (pricingConfig.js), which remains untouched by this
// phase (see APPROVED_FUTURE_USD_PRICES's own comment below).
export const REVENUECAT_ENTITLEMENT_ID = 'wakewise_plus';
export const REVENUECAT_OFFERING_ID = 'default';

// Google Play offer ids on the annual base plan — user-confirmed (given
// directly, not guessed or scraped): 'founder-first-year' and
// 'annual-trial-7-days'. Per the installed SDK's own SubscriptionOption
// type (offerings.d.ts), a SubscriptionOption.id is `basePlanId` for the
// base plan itself, or `basePlanId:offerId` for an offer — so these two
// raw offer-id strings are matched as an id SUFFIX
// (revenueCatAdapter.js's getGoogleNamedOfferOption), never assumed to be
// the full SubscriptionOption.id verbatim, since the exact base-plan-id
// prefix ('yearly', per the confirmed base-plan mapping below, but not
// independently re-verified against a live SDK response this session) is
// one layer less certain than the offer names themselves.
export const GOOGLE_OFFER_NAMES = Object.freeze({
  trial: 'annual-trial-7-days',
  founder: 'founder-first-year'
});

// RevenueCat's own predefined PACKAGE_TYPE values (monthly, annual) cover
// the standard tiers, and are the only two REAL RevenueCat packages this
// file names — both correspond to a genuine store product each platform
// actually sells. There is no third "founder" package here, on any
// platform — see the correction note and FOUNDER_OFFER_MODEL below for
// why, and this exact identifier string ($rc_monthly/$rc_annual) is
// RevenueCat's own documented convention for the predefined package
// identifiers a dashboard Offering exposes when using its standard
// package types — not yet independently re-verified against a real
// RevenueCat dashboard (no project exists — see the Phase 2B report).
export const REVENUECAT_PACKAGE_IDENTIFIERS = Object.freeze({
  monthly: '$rc_monthly',
  annual: '$rc_annual'
});

// CORRECTION (post-Phase-2B review): this file previously modeled the
// founder launch offer as a third RevenueCat "package"
// (`founderAnnual: 'annual_founder'`) purchased the same way as monthly/
// annual, with a placeholder dashboard identifier this task invented
// itself. That was wrong, and has been fully removed — replaced by
// FOUNDER_OFFER_MODEL below, which documents the ACTUAL, platform-specific
// mechanism each store uses for a discounted-first-period offer on an
// EXISTING product, none of which is "a RevenueCat package":
//
//   - Apple: WAKEWISEFOUNDING (source-confirmed: docs describe this offer
//     code as already configured, blocked on App Review) is a
//     Subscription Offer Code. A user REDEEMS it through iOS's own
//     code-redemption sheet (RevenueCat's presentCodeRedemptionSheet(),
//     confirmed present in the installed SDK — see
//     node_modules/@revenuecat/purchases-capacitor's own definitions.d.ts)
//     — it is never "purchased" via purchasePackage()/getOfferings() like
//     an ordinary package, and RevenueCat's Offering model has no package
//     representing it. Once redeemed, the resulting transaction is an
//     ordinary purchase of the SAME annual product
//     (com.zavaraai.wakewise.plus.annual) at the discounted price — it
//     surfaces through the exact same transaction-update listener as any
//     other purchase, needing no special handling downstream of
//     redemption. (Apple's separate "Promotional Offers" mechanism, for
//     re-engaging existing/lapsed subscribers via a server-signed
//     discount, is a different feature this project has not adopted for
//     the founder tier and is not modeled here.)
//
//   - Google Play: a discounted first-period offer on an existing base
//     plan IS represented in RevenueCat's own model — as a distinct
//     `SubscriptionOption` on the SAME StoreProduct (see
//     `subscriptionOptions`/`defaultOption` in the installed SDK's own
//     purchases-typescript-internal-esm types), purchased via
//     `purchaseSubscriptionOption()` — a genuinely different API from
//     `purchasePackage()`, and still not "a RevenueCat package" in the
//     Offering sense either.
//
//     CORRECTION (readiness-gap review, user-confirmed): the Google
//     monthly/annual base products DO now exist in RevenueCat —
//     com.zavaraai.wakewise.plus.monthly:monthly and
//     com.zavaraai.wakewise.plus.annual:yearly, both attached to
//     wakewise_plus and mapped in the default offering. Google service
//     credentials are valid in RevenueCat; Play's own "test notification
//     sent" receipt is still unconfirmed. Two Google Play OFFERS also
//     exist on the annual base plan — founder-first-year and
//     annual-trial-7-days (GOOGLE_OFFER_NAMES above, user-confirmed) — but
//     their exact current activation/eligibility status in the Play
//     Console, and the exact SubscriptionOption.id format the live SDK
//     returns for them, have NOT been independently verified this
//     session — `googleOfferId` below is the confirmed offer NAME, matched
//     against a live SubscriptionOption.id by suffix
//     (getGoogleNamedOfferOption), never assumed to be the complete id nor
//     dashboard-verified end-to-end against a real sandbox purchase yet.
//
//     REAL RISK, SDK-confirmed (not hypothetical): RevenueCat's Android
//     `purchasePackage()` purchases a package's `defaultOption`, and
//     RevenueCat's own documented defaultOption algorithm is "filter out
//     options tagged rc-ignore-offer/rc-customer-center, then pick the
//     option with the longest free trial or cheapest first phase, else
//     fall back to the base plan" — see
//     https://www.revenuecat.com/docs/tools/offering-configuration and
//     community confirmation
//     (https://community.revenuecat.com/general-questions-7/implementing-developer-determined-offer-with-android-2923).
//     Since founder-first-year and annual-trial-7-days are both offers on
//     the SAME annual base plan, calling `getPackage('annual')` then
//     `purchasePackage()` for an ORDINARY annual purchase is NOT safe to
//     assume excludes either offer — whichever offer's eligibility +
//     trial-length/price ordering wins becomes what the user is actually
//     charged, silently. See revenueCatAdapter.js's own
//     `describeDefaultAnnualSelection()`/purchase-path comments for the
//     mitigation (explicit SubscriptionOption resolution, never a blind
//     purchasePackage() call for Android annual, until this is verified
//     against a real RevenueCat sandbox purchase). The two safe fixes are
//     either tagging founder-first-year `rc-ignore-offer` in the
//     RevenueCat/Play dashboard (excludes it from defaultOption
//     resolution entirely) or always purchasing an explicitly-resolved
//     SubscriptionOption instead of relying on defaultOption — this file
//     does not assume either has been done.
//
//   - Stripe: a founder price is an entirely separate Stripe Price object
//     (or a Checkout coupon/promotion code) — RevenueCat is not involved
//     on the web path at all. See pricingConfig.js's own
//     FOUNDING_ANNUAL_FIRST_YEAR_PRICE, unaffected by and unrelated to
//     this file.
//
// Every identifier below that is not independently source-confirmed is
// `null` — never a guessed dashboard value.
export const FOUNDER_OFFER_MODEL = Object.freeze({
  apple: Object.freeze({
    mechanism: 'offer_code_redemption',
    appliesToProductId: 'com.zavaraai.wakewise.plus.annual', // = KNOWN_PRODUCT_IDS.annual.apple
    offerCode: 'WAKEWISEFOUNDING', // source-confirmed (repo docs)
    redemptionApi: 'presentCodeRedemptionSheet' // confirmed present in the installed SDK
  }),
  google: Object.freeze({
    mechanism: 'base_plan_offer',
    appliesToProductId: 'com.zavaraai.wakewise.plus.annual', // = KNOWN_PRODUCT_IDS.annual.google
    googleOfferId: GOOGLE_OFFER_NAMES.founder // = 'founder-first-year', user-confirmed; matched as a SubscriptionOption.id suffix, see GOOGLE_OFFER_NAMES's own comment
  }),
  stripe: Object.freeze({
    mechanism: 'stripe_price',
    appliesToProductId: null // Stripe Price ids are opaque secrets, not read by this app (see pricingConfig.js)
  })
});

// Real Apple product identifiers already created in App Store Connect
// (source-confirmed from this repo's own docs —
// docs/apple-subscription-architecture.md /
// docs/apple-subscription-implementation.md — not independently
// re-verified against the live App Store Connect dashboard this session;
// see the Phase 2B report's own external-verification classification).
//
// CORRECTION (readiness-gap review, user-confirmed): Google product ids
// are no longer null — both base products exist in RevenueCat and are
// mapped into the default offering: com.zavaraai.wakewise.plus.monthly
// (base plan "monthly") and com.zavaraai.wakewise.plus.annual (base plan
// "yearly"). The base-plan id itself (distinct from the product id) is
// not modeled here since nothing in this codebase reads it directly —
// RevenueCat's own Offering/Package resolution handles that mapping.
export const KNOWN_PRODUCT_IDS = Object.freeze({
  monthly: Object.freeze({ apple: 'com.zavaraai.wakewise.plus.monthly', google: 'com.zavaraai.wakewise.plus.monthly' }),
  annual: Object.freeze({ apple: 'com.zavaraai.wakewise.plus.annual', google: 'com.zavaraai.wakewise.plus.annual' })
});

// The approved future BASE prices (USD), for documentation and for the
// web/Stripe configuration path ONLY — never read by any mobile
// price-rendering code. pricingConfig.js (the existing web/Stripe display
// config) is NOT modified by this phase — it still shows its prior
// AUD figures pending a separately-approved real USD Stripe Price change,
// per this phase's own explicit instruction ("do not change the live
// Stripe price... unless a genuine USD $6.99 Stripe Price exists and is
// separately approved"). This record exists so the approved numbers are
// written down exactly once, not scattered across docs/comments with
// room to drift.
export const APPROVED_FUTURE_USD_PRICES = Object.freeze({
  monthly: 6.99,
  annual: 59.99,
  founderAnnualFirstYear: 49.99,
  founderAnnualRenewal: 59.99
});

const readEnv = (key) => {
  try {
    return import.meta.env?.[key] ?? null;
  } catch {
    return null;
  }
};

// Public SDK keys — one per platform, RevenueCat's own convention (unlike
// Stripe/Apple, a single cross-platform key is never correct here). Both
// read from Vite's client-exposed `VITE_` prefix, matching this project's
// existing subscriptionOverride.js convention.
export const getRevenueCatIosApiKey = () => readEnv('VITE_REVENUECAT_IOS_API_KEY');
export const getRevenueCatAndroidApiKey = () => readEnv('VITE_REVENUECAT_ANDROID_API_KEY');

/**
 * Whether this build has a real, non-empty public SDK key for the given
 * platform ('ios' | 'android'). Never true from a placeholder/example
 * value — only a genuinely present environment variable counts. Every
 * RevenueCat adapter entry point gates on this before touching the SDK,
 * so an unconfigured build behaves exactly like "RevenueCat does not
 * exist yet" rather than throwing or half-initializing.
 */
export const isRevenueCatConfigured = (platform) => {
  const key = platform === 'ios' ? getRevenueCatIosApiKey() : platform === 'android' ? getRevenueCatAndroidApiKey() : null;
  return typeof key === 'string' && key.trim().length > 0;
};
