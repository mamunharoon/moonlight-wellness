// WakeWise — Legal, Subscription and Free-Trial Readiness — pricing config.
//
// The single source of truth for DISPLAYED subscription pricing, so the
// figures shown across the paywall, checkout, and legal copy can never
// drift from each other. This is a display config only — it does not
// create, read, or touch any Stripe product or price object.
//
// *** NOT YET RECONCILED WITH STRIPE ***
// The values below are ZavaraAI's PROPOSED Australian launch pricing,
// supplied for UI/legal preparation. STRIPE_PRICE_PLUS_MONTHLY and
// STRIPE_PRICE_PLUS_YEARLY (the Supabase Edge Function secrets
// create-checkout-session actually charges) are configured but their
// dollar amounts are not readable from this codebase — Supabase's own
// `secrets list` masks secret values, and this task does not have
// Stripe Dashboard/API access. Do not assume these numbers already
// match the live Stripe Price objects. Before this goes live, someone
// with Stripe Dashboard access must either confirm the Price objects
// already charge these exact amounts, or create new ones and update the
// two secrets to match — the second of those is explicitly a "create or
// alter Stripe products/prices" action requiring separate owner
// approval, never done implicitly by editing this file.
export const CURRENCY = 'AUD';
export const CURRENCY_SYMBOL = '$';

export const TRIAL_DAYS = 7;

export const MONTHLY_PRICE = 7.99;
export const ANNUAL_PRICE = 59.99;

// Founding-member introductory offer (see
// docs/founding-member-pricing-recommendation.md for the eligibility
// window and rollout approach — not wired into checkout yet; no Stripe
// object exists for this price today).
export const FOUNDING_ANNUAL_FIRST_YEAR_PRICE = 49.99;
export const FOUNDING_ANNUAL_RENEWAL_PRICE = ANNUAL_PRICE;

const formatPrice = (amount) => `${CURRENCY} ${CURRENCY_SYMBOL}${amount.toFixed(2)}`;

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
