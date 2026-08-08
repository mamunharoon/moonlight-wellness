// Sprint 2 Stage 3A — the one place Stripe's vocabulary is translated
// into this app's existing entitlement vocabulary (see
// src/lib/entitlements.js). Both the checkout function and the webhook
// import from here so they can never drift apart.

// Solas Plus Monthly / Solas Plus Yearly (Stage 3A ticket, section 3) —
// both map to plan='plus'; this app has only ever had one paid tier
// (see entitlements.js's own comment), interval is a Stripe-side detail
// captured in stripe_price_id for reference, not a second plan value.
export const PRICE_ENV_VAR_BY_INTERVAL = {
  monthly: 'STRIPE_PRICE_PLUS_MONTHLY',
  yearly: 'STRIPE_PRICE_PLUS_YEARLY'
};

export const priceIdForInterval = (interval) => {
  const envVar = PRICE_ENV_VAR_BY_INTERVAL[interval];
  if (!envVar) return null;
  return Deno.env.get(envVar) ?? null;
};

// The two known Plus price ids, used by the webhook as a defensive
// check: a subscription event is only ever allowed to set plan='plus' if
// its price is one of these two — never inferred from event.type alone,
// and never trusted from anything client-supplied. Deliberately checked
// at call time (not module load time) so a missing env var in one
// interval doesn't prevent the other from working.
export const knownPlusPriceIds = () =>
  [Deno.env.get('STRIPE_PRICE_PLUS_MONTHLY'), Deno.env.get('STRIPE_PRICE_PLUS_YEARLY')]
    .filter(Boolean);

// Stripe subscription.status -> this app's existing subscriptions.status
// CHECK constraint values ('trial' | 'active' | 'cancelled' | 'expired').
// past_due is mapped to 'active' deliberately (a short grace period
// rather than an instant downgrade) — see the Stage 3A report's
// live-cutover checklist for real dunning/grace-period handling, which
// is out of scope for this test-mode foundation.
const STRIPE_STATUS_MAP = {
  trialing: 'trial',
  active: 'active',
  past_due: 'active',
  canceled: 'cancelled',
  paused: 'cancelled',
  unpaid: 'expired',
  incomplete: 'expired',
  incomplete_expired: 'expired'
};

export const mapStripeStatus = (stripeStatus) => STRIPE_STATUS_MAP[stripeStatus] ?? 'expired';
