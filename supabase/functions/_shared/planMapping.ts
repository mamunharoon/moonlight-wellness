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

// Apple Subscription Architecture task, Phase D — the two confirmed
// Stripe gaps this app's own earlier audits found: the trial was never
// actually passed to Stripe, and refund/dispute events were never
// handled. Both pure/framework-free so they're directly unit-testable
// (this file has no Deno-specific import at module scope — only
// knownPlusPriceIds/priceIdForInterval above read Deno.env, and this
// project's Vitest config can still import this .ts file from a test
// under src/lib/, exactly the same cross-boundary import pattern this
// task's own test suite uses).

// Server-side trial eligibility: a user is eligible only if their own
// subscriptions row has never recorded a trial start before. Never
// derived from anything client-supplied — create-checkout-session reads
// the row itself, not a flag the browser sent. `row` is the existing
// subscriptions record for this user (or null/undefined for "no row
// yet," which is eligible — a brand new subscriber).
export const isTrialEligible = (row) => !row?.trial_used_at;

// Refund/dispute lifecycle events -> this app's subscriptions.status
// vocabulary (now widened to include 'refunded' by
// 20260916110000_stripe_trial_and_refund_support.sql). 'refunded' is
// deliberately NOT in entitlements.js's ACTIVE_STATUSES, so mapping to
// it alone revokes access — no change to entitlements.js is needed for
// this to take effect. A dispute is treated as an immediate access
// suspension (the existing 'cancelled' value) pending resolution, not a
// new status value, keeping the schema change minimal. Any other event
// type maps to null — the caller must skip processing, never guess.
export const STRIPE_REFUND_DISPUTE_EVENT_STATUS = {
  'charge.refunded': 'refunded',
  'charge.dispute.created': 'cancelled'
};

export const mapRefundOrDisputeEventToStatus = (stripeEventType) =>
  STRIPE_REFUND_DISPUTE_EVENT_STATUS[stripeEventType] ?? null;

// Apple Subscription Architecture task, Phase C — the proposed App Store
// Connect product identifiers (docs/apple-subscription-architecture.md
// §6; not yet created in App Store Connect). Mirrors
// src/lib/applePurchaseAdapter.js's own APPLE_PRODUCT_IDS constant —
// kept as a separate, independently-declared list here (not imported
// across the Deno/Vite boundary) so the server-side allow-list can never
// be silently widened by a client-side change to the other file; both
// must be updated together by hand if these identifiers ever change.
export const KNOWN_APPLE_PLUS_PRODUCT_IDS = [
  'com.zavaraai.wakewise.plus.monthly',
  'com.zavaraai.wakewise.plus.annual'
];

export const isKnownApplePlusProductId = (productId) => KNOWN_APPLE_PLUS_PRODUCT_IDS.includes(productId);

// Duplicate-Subscription Remediation — two deliberately distinct
// vocabularies, never conflated:
//
// BLOCKING_STRIPE_STATUSES is Stripe's OWN raw subscription.status
// values, used only at checkout-guard time (create-checkout-session)
// when live-querying Stripe directly — the DB can be stale (the exact
// bug this remediation fixes), so the guard must classify what Stripe
// itself reports, before anything is mapped into this app's vocabulary.
// 'canceled' and 'incomplete_expired' are the only terminal Stripe
// statuses; every other status is access-bearing or still resolving and
// must block a second checkout.
export const BLOCKING_STRIPE_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
  'incomplete'
];

export const isBlockingStripeStatus = (stripeStatus) => BLOCKING_STRIPE_STATUSES.includes(stripeStatus);

// NON_TERMINAL_LEDGER_STATUSES is this app's OWN mapped vocabulary
// (mapStripeStatus's output, also provider_subscriptions.status's
// broader set), used only when counting existing rows in the
// provider_subscriptions ledger during webhook processing — see
// stripe-webhook/index.ts's projection-selection logic. Mirrors
// entitlementResolution.js's own ACCESS_GRANTING_STATUSES so the two
// never drift apart.
export const NON_TERMINAL_LEDGER_STATUSES = ['trial', 'active', 'grace_period', 'billing_retry'];

export const isNonTerminalLedgerStatus = (status) => NON_TERMINAL_LEDGER_STATUSES.includes(status);
