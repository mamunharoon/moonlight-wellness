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
//
// REFUND_REVERSED (App-Store-only; "a refund was reversed" — official
// docs) IS a state change: its own official sample payload carries the
// same expiration_at_ms/period_type shape as RENEWAL/UNCANCELLATION, so
// whether it actually restores access can be decided the identical way
// every other event already is — by resolveEntitlement/the RPC's own
// expiry guard checking the real expiration_at_ms this event carries
// against `now`, never by assuming the reversal itself means "access is
// back" regardless of whether that expiry has since passed again.
export const REVENUECAT_EVENT_TYPES_WITH_STATE_CHANGE = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'REFUND_REVERSED'
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

    // cancel_reason === 'CUSTOMER_SUPPORT' means this CANCELLATION
    // represents a refund, not a voluntary unsubscribe — official docs:
    // "A subscription or non-renewing purchase was canceled or
    // refunded... In the case of refunds, a subscription's auto-renewal
    // setting may still be active." The event itself carries no field
    // proving auto-renew was actually turned off for this reason (the
    // real, official sample CANCELLATION payload has no such field at
    // all), so forcing cancelAtPeriodEnd:true here would be asserting a
    // fact this event does not establish. `undefined` — not `false`,
    // not `true` — preserves whatever this row already recorded,
    // exactly like RENEWAL/INITIAL_PURCHASE/PRODUCT_CHANGE already do
    // below when THEY have no fresh renewal-preference evidence of
    // their own; this is the same established pattern, only now also
    // applied to the one CANCELLATION sub-case that shares that
    // property. Every other cancel_reason (UNSUBSCRIBE, BILLING_ERROR,
    // DEVELOPER_INITIATED, PRICE_INCREASE, UNKNOWN) keeps the original,
    // correct cancelAtPeriodEnd:true — those genuinely do mean auto-renew
    // is off.
    const cancelAtPeriodEnd = event.cancel_reason === 'CUSTOMER_SUPPORT' ? undefined : true;
    return { status, cancelAtPeriodEnd };
  }

  if (event.type === 'REFUND_REVERSED') {
    // Apple reversed an earlier refund. Resolved the same way RENEWAL/
    // UNCANCELLATION already are: status from period_type, and
    // cancelAtPeriodEnd preserved (undefined) rather than guessed —
    // this event's own cancel/renewal preference is not independently
    // re-established by a reversal, exactly the same reasoning as
    // RENEWAL/PRODUCT_CHANGE above. Whether this actually restores
    // access is decided downstream by the real expiration_at_ms this
    // event carries (read by the caller into p_current_period_expires_at
    // exactly like every other event) being checked against `now` by
    // the RPC's own expiry guard — never assumed true here just because
    // a reversal happened.
    const status = isRevenueCatTrialPeriod(event.period_type) ? 'trial' : 'active';
    return { status, cancelAtPeriodEnd: undefined };
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
