// WakeWise Phase 2B — the one place RevenueCat's own event vocabulary is
// translated into this project's provider-neutral status vocabulary
// ('trial' | 'active' | 'grace_period' | 'billing_retry' | 'cancelled' |
// 'expired' | 'refunded' | 'revoked'), exactly mirroring how
// appleSubscriptionStateMapping.ts is already the one place Apple's own
// vocabulary gets translated, and planMapping.ts for Stripe. Every
// exported function here is pure: it only ever transforms an ALREADY
// AUTHENTICATED webhook event body (see the webhook's own Authorization
// check) into this project's vocabulary — it never itself authenticates
// anything, and it never has to guess at a meaning RevenueCat hasn't
// documented.
//
// Deliberately a plain .js file (not .ts) so this exact module can be
// imported unmodified both by the Deno Edge Function (revenuecat-webhook)
// and by this repo's own Vitest suite for real-execution testing — same
// reasoning as entitlementResolution.js already being framework/runtime
// agnostic.
//
// RevenueCat's REST API v2 webhook event shape (https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields):
//   event.type, event.id, event.app_user_id, event.product_id, event.store
//   ('APP_STORE'|'PLAY_STORE'|'STRIPE'|...), event.period_type
//   ('NORMAL'|'TRIAL'|'INTRO'), event.expiration_at_ms, event.environment
//   ('SANDBOX'|'PRODUCTION'), event.cancel_reason, event.transferred_from/
//   event.transferred_to (arrays of app_user_ids, TRANSFER events only).

// event.store -> this project's provider vocabulary. RevenueCat's own
// 'STRIPE' value is deliberately never mapped here — Stripe stays on its
// existing, separate stripe-webhook/index.ts path entirely; a RevenueCat
// event claiming store=STRIPE would be a configuration error in the
// RevenueCat project itself (Stripe should never be added as a store
// there for WakeWise), not something this webhook has any business
// acting on.
const STORE_TO_PROVIDER = {
  APP_STORE: 'apple',
  MAC_APP_STORE: 'apple',
  PLAY_STORE: 'google'
};

export const mapRevenueCatStoreToProvider = (store) => STORE_TO_PROVIDER[store] ?? null;

export const isRevenueCatTrialPeriod = (periodType) => periodType === 'TRIAL' || periodType === 'INTRO';

// The converse of an allowlist below: any event.type not explicitly
// listed in REVENUECAT_EVENT_TYPES_WITH_STATE_CHANGE is acknowledge-only,
// by construction — recorded in provider_events for idempotency/audit,
// never applied to provider_subscriptions/entitlements. This is the
// literal implementation of the same "unknown/unhandled event types must
// never accidentally grant or revoke access" rule
// appleSubscriptionStateMapping.ts already established.
//
// TRANSFER is deliberately NOT in the state-change allowlist for this
// phase: moving a subscription's ownership from one app_user_id to
// another requires its own dedicated, carefully ownership-checked write
// path (mirroring provider_subscriptions' own unique-constraint-based
// conflict protection) — treating it as an ordinary status update would
// risk silently attaching one user's purchase to a different account.
// Recorded for audit; a future task must implement real transfer
// handling before this event type can safely change state.
//
// SUBSCRIPTION_PAUSED (Android prepaid-only) and NON_RENEWING_PURCHASE
// are also acknowledge-only: WakeWise's only product is an auto-renewing
// monthly subscription, so neither currently has a meaningful status this
// project's vocabulary can express — acknowledging rather than guessing.
export const REVENUECAT_EVENT_TYPES_WITH_STATE_CHANGE = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE'
]);

/**
 * Given an authenticated RevenueCat webhook event body's own `event`
 * object, returns the state change this project should apply, or null
 * for an acknowledge-only event (still recorded in provider_events, never
 * applied to provider_subscriptions/entitlements). Never invents a
 * meaning for an event type this function does not recognise.
 */
export const mapRevenueCatEventToStateChange = (event) => {
  if (!event || !REVENUECAT_EVENT_TYPES_WITH_STATE_CHANGE.has(event.type)) {
    return null;
  }

  if (event.type === 'EXPIRATION') {
    return { status: 'expired', cancelAtPeriodEnd: undefined };
  }

  if (event.type === 'BILLING_ISSUE') {
    return { status: 'billing_retry', cancelAtPeriodEnd: undefined };
  }

  if (event.type === 'CANCELLATION') {
    // Auto-renew was turned off. The subscription is not necessarily
    // over yet — access continues until expiration_at_ms, exactly the
    // "cancellation alone must not end access before the verified expiry
    // time" rule this project already applies to Apple's own
    // DID_CHANGE_RENEWAL_STATUS/AUTO_RENEW_DISABLED case.
    const status = isRevenueCatTrialPeriod(event.period_type) ? 'trial' : 'active';
    return { status, cancelAtPeriodEnd: true };
  }

  if (event.type === 'UNCANCELLATION') {
    const status = isRevenueCatTrialPeriod(event.period_type) ? 'trial' : 'active';
    return { status, cancelAtPeriodEnd: false };
  }

  // INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE: all resolve status purely
  // from period_type — none of them independently toggle
  // cancel_at_period_end (a renewal/product change carries no renewal-
  // preference evidence of its own; whatever this row already recorded
  // is preserved by the caller, exactly like Apple's own
  // OFFER_REDEEMED/DID_CHANGE_RENEWAL_PREF handling).
  const status = isRevenueCatTrialPeriod(event.period_type) ? 'trial' : 'active';
  return { status, cancelAtPeriodEnd: undefined };
};
