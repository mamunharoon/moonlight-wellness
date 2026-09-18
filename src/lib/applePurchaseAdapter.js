// WakeWise — Apple In-App Purchase adapter (Phase B, native subscriptions).
//
// The ONLY file in this app that imports @capgo/native-purchases
// directly. Every other module (Subscription.jsx, any future component)
// talks to this adapter's plain functions, never to the raw plugin —
// this is the "isolate plugin-specific code behind a small
// adapter/service" boundary the implementation plan requires, mirroring
// stripeApi.js's own thin-wrapper role for Stripe.
//
// Security posture (never relaxed by this file):
//   - Never grants entitlement. This module only ever reports what
//     StoreKit/the plugin says happened on-device; the caller
//     (Subscription.jsx) must treat every result here as "pending server
//     verification," not as access — see
//     docs/apple-subscription-implementation.md for the full
//     server-verification design this hands off to (Phase C).
//   - Never logs a transaction payload, JWS, receipt, or appAccountToken.
//     Only a productIdentifier (a fixed, allow-listed constant, not
//     sensitive) or a plain error message is ever passed to console.*.
//   - Only ever purchases/looks up a product id from
//     ALLOWED_APPLE_PRODUCT_IDS below — an arbitrary string is never
//     passed through to the plugin.
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { isNativePlatform, isIOS } from './platform';

// Proposed identifiers from docs/apple-subscription-architecture.md §6 —
// not yet created in App Store Connect (see that document's §14). Kept
// here, not imported from pricingConfig.js, since these are Apple
// product identifiers, not the AUD display prices pricingConfig.js owns
// for the Stripe/web path.
export const APPLE_PRODUCT_IDS = Object.freeze({
  monthly: 'com.zavaraai.wakewise.plus.monthly',
  annual: 'com.zavaraai.wakewise.plus.annual'
});

const ALLOWED_APPLE_PRODUCT_IDS = new Set(Object.values(APPLE_PRODUCT_IDS));

export const isAppleIAPSupported = () => isNativePlatform() && isIOS();

/**
 * The one place `interval` ('monthly' | 'yearly') resolves to a StoreKit
 * product id and its display price. Used for both what Subscription.jsx
 * shows and what it purchases, so the two can never drift apart - e.g. a
 * new interval value added to the UI without updating a second, separate
 * mapping elsewhere. `priceString` is StoreKit's own localised, currency-
 * inclusive string (see getAppleProducts above) - null (not a hardcoded
 * fallback) whenever that exact product hasn't loaded yet.
 */
export const resolveAppleProductDisplay = (interval, appleProducts) => {
  const productId = interval === 'monthly' ? APPLE_PRODUCT_IDS.monthly : APPLE_PRODUCT_IDS.annual;
  return {
    productId,
    priceString: appleProducts?.[productId]?.priceString ?? null
  };
};

const safeErrorMessage = (error) => (error && typeof error.message === 'string' ? error.message : 'Unknown error');

/**
 * For a subscriber whose entitlement provider is Apple, resolves which
 * allow-listed product (monthly/annual) their real, current purchase
 * actually is - by asking StoreKit for the device's own purchase history
 * (never guessed from the DB, which has no interval/product-id column;
 * see subscriptions table schema), then reading that exact product's
 * already-fetched localised priceString out of `appleProducts` (the map
 * getAppleProducts returns). Returns null - never a guessed interval or
 * invented price - if unsupported, no allow-listed purchase is found, or
 * that product's priceString hasn't loaded into `appleProducts` yet.
 */
export const getActiveApplePlan = async (appleProducts) => {
  if (!isAppleIAPSupported()) return null;
  try {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
    const active = (purchases ?? []).find((p) => ALLOWED_APPLE_PRODUCT_IDS.has(p?.productIdentifier));
    if (!active) return null;

    const priceString = appleProducts?.[active.productIdentifier]?.priceString;
    if (!priceString) return null;

    return {
      interval: active.productIdentifier === APPLE_PRODUCT_IDS.monthly ? 'monthly' : 'yearly',
      priceString
    };
  } catch (error) {
    console.warn('[applePurchaseAdapter] getActiveApplePlan failed, continuing without it', safeErrorMessage(error));
    return null;
  }
};

/**
 * Builds the Current Plan section's localised price line for an Apple
 * subscriber, e.g. "A$7.99 per month after your free trial" - the one
 * place this exact sentence is assembled, so its wording can't drift
 * between callers. Returns null (never a partially-built or guessed
 * sentence) when there's no real priceString to show, matching "show the
 * current status/date without inventing a price" when StoreKit data
 * isn't available yet.
 */
export const formatActiveApplePlanMessage = (activeApplePlan, subscriptionStatus) => {
  if (!activeApplePlan?.priceString) return null;
  const perLabel = activeApplePlan.interval === 'monthly' ? 'per month' : 'per year';
  const trialSuffix = subscriptionStatus === 'trial' ? ' after your free trial' : '';
  return `${activeApplePlan.priceString} ${perLabel}${trialSuffix}`;
};

/**
 * Fetches the two WakeWise Plus products from StoreKit, via the plugin.
 * Returns only products whose identifier is in the allow-list above —
 * never trusts an arbitrary identifier the plugin might hand back.
 * Never throws; returns an empty map on any failure so the caller can
 * show an honest "unavailable" state rather than crash.
 */
export const getAppleProducts = async () => {
  if (!isAppleIAPSupported()) return {};
  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: Array.from(ALLOWED_APPLE_PRODUCT_IDS),
      productType: PURCHASE_TYPE.SUBS
    });
    const byId = {};
    for (const product of products ?? []) {
      if (!ALLOWED_APPLE_PRODUCT_IDS.has(product?.identifier)) continue;
      // Only the fields this app actually displays — never the full
      // native object (which may carry fields this plugin's own iOS
      // implementation does not populate reliably; see
      // docs/apple-subscription-implementation.md's plugin-evidence
      // section for the introductoryPrice/subscriptionPeriod caveat).
      byId[product.identifier] = {
        identifier: product.identifier,
        title: product.title,
        priceString: product.priceString
      };
    }
    return byId;
  } catch (error) {
    console.warn('[applePurchaseAdapter] getAppleProducts failed, continuing without it', safeErrorMessage(error));
    return {};
  }
};

/**
 * Starts a StoreKit purchase for one allow-listed product. `appAccountToken`
 * should be the current Supabase user's own id (already a UUID, matching
 * StoreKit 2's own appAccountToken requirement) — see
 * docs/apple-subscription-architecture.md §9 for why this, not the Apple
 * ID or email, is the identity-linking mechanism.
 *
 * Resolves with a plain, non-sensitive summary of what happened —
 * `{ outcome: 'purchased', transactionId, productIdentifier, jwsRepresentation }`
 * on success — never with the full native Transaction object logged or
 * otherwise exposed beyond the caller that needs it to call the (Phase C)
 * server-verification function. The caller must never treat a 'purchased'
 * outcome here as granted access on its own.
 *
 * Cancellation is reported as `{ outcome: 'cancelled' }`, not thrown as an
 * application error — a user changing their mind is expected, ordinary
 * behaviour. The exact error shape StoreKit/this plugin use for a
 * cancelled purchase has not been confirmed on a physical device in this
 * task (no macOS/Xcode/device available) — the heuristic below matches
 * the plugin's own documented/typical error surface but should be
 * re-verified once real sandbox testing is possible; see
 * docs/apple-subscription-implementation.md.
 */
export const purchaseAppleProduct = async (productIdentifier, { appAccountToken } = {}) => {
  if (!isAppleIAPSupported()) return { outcome: 'unavailable' };
  if (!ALLOWED_APPLE_PRODUCT_IDS.has(productIdentifier)) return { outcome: 'unavailable' };

  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier,
      appAccountToken: appAccountToken || undefined
    });
    return {
      outcome: 'purchased',
      transactionId: transaction?.transactionId ?? null,
      productIdentifier: transaction?.productIdentifier ?? productIdentifier,
      // The opaque, signed blob the (Phase C) server-verification
      // function needs — never interpreted or logged here.
      jwsRepresentation: transaction?.jwsRepresentation ?? null
    };
  } catch (error) {
    const message = safeErrorMessage(error).toLowerCase();
    const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
    const looksCancelled =
      code.includes('cancel') || message.includes('cancel') || message.includes('user did not confirm');
    if (looksCancelled) return { outcome: 'cancelled' };
    console.warn('[applePurchaseAdapter] purchaseAppleProduct failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/**
 * Restores previous purchases. Like purchaseAppleProduct, never grants
 * entitlement itself — restored transactions arrive via the
 * 'transactionUpdated' listener (addAppleTransactionUpdateListener below)
 * exactly as StoreKit delivers them, and must go through the same
 * server-verification path as a fresh purchase.
 */
export const restoreApplePurchases = async () => {
  if (!isAppleIAPSupported()) return { outcome: 'unavailable' };
  try {
    await NativePurchases.restorePurchases();
    return { outcome: 'restored' };
  } catch (error) {
    console.warn('[applePurchaseAdapter] restoreApplePurchases failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/** Opens Apple's own subscription-management surface — never WakeWise/Stripe UI. */
export const openAppleManageSubscriptions = async () => {
  if (!isAppleIAPSupported()) return { outcome: 'unavailable' };
  try {
    await NativePurchases.manageSubscriptions();
    return { outcome: 'opened' };
  } catch (error) {
    console.warn('[applePurchaseAdapter] openAppleManageSubscriptions failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/**
 * Subscribes to StoreKit transaction updates (fires on launch for any
 * unfinished transaction, and for renewals/restores afterward). Returns a
 * cleanup function, matching this codebase's existing native-listener
 * pattern (useMorningReminderNotificationTap.js, useNativeDeepLinks.js).
 * The callback receives only the same non-sensitive summary shape
 * purchaseAppleProduct resolves with — never the raw plugin payload.
 */
export const addAppleTransactionUpdateListener = (callback) => {
  if (!isAppleIAPSupported()) return () => {};
  const listenerPromise = NativePurchases.addListener('transactionUpdated', (transaction) => {
    if (!ALLOWED_APPLE_PRODUCT_IDS.has(transaction?.productIdentifier)) return;
    callback({
      outcome: 'purchased',
      transactionId: transaction?.transactionId ?? null,
      productIdentifier: transaction?.productIdentifier,
      jwsRepresentation: transaction?.jwsRepresentation ?? null
    });
  });
  return () => {
    listenerPromise.then((listener) => listener.remove());
  };
};
