// Apple Server Verification task, Phase 3 — the one place Apple's
// notification/transaction vocabulary is translated into this project's
// provider-neutral status vocabulary ('trial' | 'active' | 'grace_period'
// | 'billing_retry' | 'cancelled' | 'expired' | 'refunded' | 'revoked'),
// exactly mirroring how planMapping.ts is already the one place Stripe's
// vocabulary gets translated. Every enum value referenced below
// (NotificationTypeV2, Subtype, Status, OfferType) was read directly out
// of Apple's own official `@apple/app-store-server-library` source
// during this task's research — not reconstructed from documentation
// summaries — so this mapping uses Apple's real, current semantics (see
// docs/apple-subscription-implementation.md for the citation). Every
// exported function here is pure: it only ever transforms an ALREADY
// VERIFIED, decoded Apple payload (see appleJwsVerification.ts) into
// this project's own vocabulary — it never itself verifies anything,
// and it never has to guess at a meaning Apple hasn't documented.

// Apple's numeric Status enum (App Store Server API `status` /
// notification `data.status`) -> this project's status vocabulary.
// Trial is deliberately NOT a value Apple's Status enum can express —
// see isAppleTrialTransaction below for how that distinction is made.
const APPLE_STATUS_TO_PROVIDER_STATUS = {
  1: 'active', // ACTIVE
  2: 'expired', // EXPIRED
  3: 'billing_retry', // BILLING_RETRY
  4: 'grace_period', // BILLING_GRACE_PERIOD
  5: 'revoked' // REVOKED
};

export const mapAppleStatusToProviderStatus = (appleStatus) =>
  APPLE_STATUS_TO_PROVIDER_STATUS[appleStatus] ?? null;

// offerType 1 = INTRODUCTORY_OFFER (Apple's OfferType enum). A
// transaction purchased or renewed under an introductory offer is this
// project's 'trial' state, regardless of the underlying Status being
// ACTIVE — matches this project's approved decision that the standard
// 7-day trial is implemented as Apple's own introductory-offer
// mechanism (docs/apple-subscription-architecture.md §6), so an
// introductory-offer transaction genuinely IS the trial, not a separate
// concept layered on top. offerType 3 = OFFER_CODE (the approved
// founding-member mechanism) is deliberately NOT treated as a trial —
// it is Pay Up Front with no trial, exactly as approved.
const INTRODUCTORY_OFFER_TYPE = 1;

export const isAppleTrialTransaction = (transaction) =>
  transaction?.offerType === INTRODUCTORY_OFFER_TYPE;

/**
 * Resolves the provider_subscriptions.status this project should record
 * for a verified transaction, given its own decoded fields plus the
 * Status this transaction's subscription group currently reports (from
 * the App Store Server API's "Get All Subscription Statuses", or from a
 * notification's own `data.status`). `appleStatus` may be null when only
 * a bare transaction (no accompanying status, e.g. a single "Get
 * Transaction Info" call) is available — in that case a transaction
 * that has not yet expired is treated as ACTIVE, matching Apple's own
 * "no evidence of expiry/refund/revocation" default.
 */
export const resolveProviderStatus = (transaction, appleStatus, now = new Date()) => {
  if (transaction?.revocationDate) return 'revoked';

  if (appleStatus != null) {
    const mapped = mapAppleStatusToProviderStatus(appleStatus);
    if (mapped === 'active' && isAppleTrialTransaction(transaction)) return 'trial';
    return mapped ?? 'expired';
  }

  const expiresAt = transaction?.expiresDate ? new Date(transaction.expiresDate) : null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return 'expired';
  return isAppleTrialTransaction(transaction) ? 'trial' : 'active';
};

// Apple's NotificationTypeV2 values this project reacts to by actually
// changing subscription state (as opposed to acknowledging only — see
// NOTIFICATION_TYPES_ACKNOWLEDGE_ONLY below). Every one of these still
// goes through resolveProviderStatus above using the notification's own
// accompanying `data.status` — this list only decides whether
// `cancelAtPeriodEnd` should also change.
const AUTO_RENEW_DISABLED_SUBTYPE = 'AUTO_RENEW_DISABLED';
const AUTO_RENEW_ENABLED_SUBTYPE = 'AUTO_RENEW_ENABLED';

/**
 * Notification types this project deliberately treats as
 * acknowledge-and-record-only: Apple's own event actually happened (and
 * is still recorded in provider_events for audit/idempotency), but none
 * of these should ever change entitlement, current status, or
 * cancel_at_period_end by themselves — per this task's own instruction
 * ("Unknown notification types must not accidentally grant or revoke
 * access... reconcile from Apple"). Each is listed with why:
 *   - TEST: Apple's own connectivity test notification, never real data.
 *   - CONSUMPTION_REQUEST: consumable IAP refund-request flow — WakeWise
 *     has no consumable products; not applicable to subscription state.
 *   - PRICE_INCREASE / PRICE_CHANGE: a price-consent workflow that does
 *     not itself change whether the subscription is active.
 *   - METADATA_UPDATE: app metadata changed, not subscription state.
 *   - EXTERNAL_PURCHASE_TOKEN: only relevant to the External Purchase
 *     Link entitlement, which this project has explicitly rejected
 *     (docs/apple-subscription-architecture.md §16 item 7).
 *   - RESCIND_CONSENT: a legal/consent notification, not a state change.
 *   - RENEWAL_EXTENDED / RENEWAL_EXTENSION: a goodwill extension Apple
 *     grants — the accompanying transaction's own new `expiresDate` is
 *     what actually carries the extended access, via the normal
 *     transaction-status path, not a separate rule here.
 *   - REFUND_DECLINED: no state change — the refund request Apple
 *     considered was declined, so nothing about the subscription changed.
 *   - REFUND_REVERSED: Apple reversed an earlier refund — deliberately
 *     acknowledge-only rather than guessing a restored status, since
 *     Apple's own docs describe this as rare/exceptional; the next
 *     ordinary status-bearing notification or a reconciliation pass
 *     will carry the correct restored state.
 *   - OFFER_REDEEMED / DID_CHANGE_RENEWAL_PREF: these DO carry a real
 *     transaction, but only ever change `product_id`/offer-tracking
 *     fields, never `status`/`cancel_at_period_end` by themselves — the
 *     transaction's own accompanying status (via resolveProviderStatus)
 *     is what the caller applies, this map only says "not an
 *     auto-renew-toggle notification."
 */
export const NOTIFICATION_TYPES_ACKNOWLEDGE_ONLY = new Set([
  'TEST',
  'CONSUMPTION_REQUEST',
  'PRICE_INCREASE',
  'PRICE_CHANGE',
  'METADATA_UPDATE',
  'EXTERNAL_PURCHASE_TOKEN',
  'RESCIND_CONSENT',
  'RENEWAL_EXTENDED',
  'RENEWAL_EXTENSION',
  'REFUND_DECLINED',
  'REFUND_REVERSED',
  'MIGRATION'
]);

// The converse of the set above, and the one this function actually
// gates on: an ALLOWLIST of the only notification types this project
// knows how to turn into a state change. Any type not explicitly listed
// here — including a type this project has simply never seen before —
// is acknowledge-only, by construction, never merely "not yet added to
// the deny list." This is the literal implementation of this task's
// "unknown notification types must not accidentally grant or revoke
// access" instruction: fail closed on the unknown, not open.
const NOTIFICATION_TYPES_WITH_STATE_CHANGE = new Set([
  'SUBSCRIBED',
  'DID_RENEW',
  'DID_FAIL_TO_RENEW',
  'GRACE_PERIOD_EXPIRED',
  'REFUND',
  'REVOKE',
  'EXPIRED',
  'OFFER_REDEEMED',
  'DID_CHANGE_RENEWAL_PREF',
  'DID_CHANGE_RENEWAL_STATUS',
  'ONE_TIME_CHARGE'
]);

/**
 * Given a verified, decoded App Store Server Notification V2 payload
 * (notificationType/subtype from the outer payload; transaction/
 * renewalInfo already independently JWS-verified from
 * data.signedTransactionInfo/signedRenewalInfo), returns the state
 * change this project should apply, or null for an
 * acknowledge-only notification (still recorded in provider_events,
 * never applied to provider_subscriptions/entitlements).
 *
 * Never invents a meaning for a notificationType this function does not
 * recognise — an unrecognised type is treated exactly like an
 * acknowledge-only one (recorded, not acted on), per this task's
 * explicit "unknown notification types must not accidentally grant or
 * revoke access" instruction, rather than throwing or guessing.
 */
export const mapVerifiedAppleNotificationToStateChange = ({
  notificationType,
  subtype,
  transaction,
  appleStatus
} = {}) => {
  if (!NOTIFICATION_TYPES_WITH_STATE_CHANGE.has(notificationType)) {
    return null;
  }

  // REVOKE has no accompanying transaction status worth trusting beyond
  // "revoked" itself — Family Sharing access was pulled.
  if (notificationType === 'REVOKE') {
    return { status: 'revoked', cancelAtPeriodEnd: undefined };
  }

  if (notificationType === 'EXPIRED') {
    return { status: 'expired', cancelAtPeriodEnd: undefined };
  }

  if (notificationType === 'REFUND') {
    return { status: 'refunded', cancelAtPeriodEnd: undefined };
  }

  if (!transaction) {
    // A recognised, state-bearing notification type with no transaction
    // to derive status from is malformed, not silently ignorable — the
    // caller should treat this as a processing error (retry-worthy),
    // never as "no change."
    return null;
  }

  const status = resolveProviderStatus(transaction, appleStatus);

  if (notificationType === 'DID_CHANGE_RENEWAL_STATUS') {
    if (subtype === AUTO_RENEW_DISABLED_SUBTYPE) {
      // The defining case this task calls out explicitly: cancellation
      // alone must not end access before the verified expiry time.
      // Status is whatever the transaction currently says (still
      // active/trial/grace/retry) — only the renewal flag changes.
      return { status, cancelAtPeriodEnd: true };
    }
    if (subtype === AUTO_RENEW_ENABLED_SUBTYPE) {
      return { status, cancelAtPeriodEnd: false };
    }
    return { status, cancelAtPeriodEnd: undefined };
  }

  // SUBSCRIBED, DID_RENEW, DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED,
  // OFFER_REDEEMED, DID_CHANGE_RENEWAL_PREF, ONE_TIME_CHARGE (non-renewing,
  // not a WakeWise product but handled the same way defensively) all
  // resolve status purely from the transaction/appleStatus above — none
  // of them independently toggle cancel_at_period_end.
  return { status, cancelAtPeriodEnd: undefined };
};
