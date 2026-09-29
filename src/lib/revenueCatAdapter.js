// WakeWise Phase 2B — RevenueCat purchase adapter.
//
// The ONLY file in this app that imports @revenuecat/purchases-capacitor
// directly — mirrors applePurchaseAdapter.js's own "isolate plugin-
// specific code behind a small adapter" boundary. Every function here is
// gated on both isNativePlatform() and isRevenueCatConfigured(platform) —
// on web, on a platform with no public key configured, or before
// configure() has run, every function safely no-ops (returns an
// 'unavailable'/empty result) rather than throwing.
//
// Security posture (never relaxed by this file, matching
// applePurchaseAdapter.js's own three rules):
//   - Never grants entitlement. This module only ever reports what the
//     RevenueCat SDK says happened on-device; the caller must treat every
//     purchase/restore result here as "pending server-side webhook
//     confirmation," never as access on its own — see
//     entitlementResolver.js, which only trusts a fresh Supabase read,
//     never a client SDK callback.
//   - Never logs a full CustomerInfo object, receipt, or transaction
//     payload — only a product/package identifier (already a fixed,
//     dashboard-configured string, not sensitive) or a plain error
//     message is ever passed to console.*.
//   - Never purchases an arbitrary package the caller names — only ever a
//     package that came back from this module's own getOfferings() call,
//     which itself only trusts what the SDK returns for the one
//     configured offering.
//
// Coexistence with the existing Apple-direct adapter (applePurchaseAdapter.js,
// @capgo/native-purchases): per this phase's explicit instruction, that
// integration is NOT removed or altered by this file. The two SDKs are
// two entirely separate native plugins with their own independent
// StoreKit listener registration — see this module's own header note
// below on the migration strategy required before they could safely run
// purchase flows side by side.
//
// ==========================================================================
// Coexistence / migration strategy (documented per this phase's explicit
// instruction, not yet executed):
//
// @capgo/native-purchases and @revenuecat/purchases-capacitor each
// register their own StoreKit 2 transaction-observer internally. Running
// BOTH of their purchase/restore flows live, from the same screen, at the
// same time would create exactly the "duplicate listeners / purchase
// ownership ambiguity" this phase warns against: a single real purchase
// could be observed and reported twice, by two independent plugins, each
// believing it is the authoritative source.
//
// The safe migration is a CUTOVER, not a merge:
//   1. Ship this phase's scaffolding (adapter, identity lifecycle,
//      resolver, webhook, migration) completely inert — no UI calls
//      purchasePackage/restorePurchases from this adapter yet.
//   2. Once a real RevenueCat project + Apple/Google apps + entitlement +
//      offering are dashboard-confirmed (Phase 2B's own external
//      prerequisites) and the webhook is deployed and verified end-to-end
//      in a sandbox purchase, flip Subscription.jsx's purchase/restore
//      buttons to call THIS adapter instead of applePurchaseAdapter.js —
//      in one change, for one platform at a time, never both adapters
//      wired to the same button simultaneously.
//   3. Only once RevenueCat's Apple path has been proven with a real
//      sandbox purchase should @capgo/native-purchases' own purchase
//      call sites be deleted. Until then it stays exactly as Phase 2A
//      left it — Profile's existing Restore Purchases row keeps using
//      the Apple-direct path, unchanged by this phase.
// ==========================================================================
import { Purchases } from '@revenuecat/purchases-capacitor';
import { isNativePlatform, isIOS, isAndroid } from './platform';
import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
  FOUNDER_OFFER_MODEL,
  getRevenueCatIosApiKey,
  getRevenueCatAndroidApiKey,
  isRevenueCatConfigured
} from './revenueCatConfig';

const currentPlatform = () => (isIOS() ? 'ios' : isAndroid() ? 'android' : null);

/** True only on a native iOS/Android build with a real public key for this platform. */
export const isRevenueCatSupported = () => {
  const platform = currentPlatform();
  return Boolean(platform) && isNativePlatform() && isRevenueCatConfigured(platform);
};

const safeErrorMessage = (error) => (error && typeof error.message === 'string' ? error.message : 'Unknown error');

let configured = false;

/**
 * Initializes the RevenueCat SDK exactly once per app session, with the
 * correct platform-specific public key and — if already known at this
 * point — the Supabase user UUID as the initial appUserID. Safe to call
 * multiple times; only the first call on an unconfigured instance does
 * anything. Never configures with an anonymous/guest identity that later
 * needs silently replacing — see useRevenueCatIdentity.js for why
 * configure() and the subsequent logIn() are kept as two separate,
 * explicitly-ordered steps rather than trying to pass appUserID here for
 * every case.
 */
export const configureRevenueCat = async (initialAppUserId) => {
  if (configured || !isRevenueCatSupported()) return { outcome: 'unavailable' };
  const platform = currentPlatform();
  const apiKey = platform === 'ios' ? getRevenueCatIosApiKey() : getRevenueCatAndroidApiKey();
  try {
    await Purchases.configure({ apiKey, appUserID: initialAppUserId ?? null });
    configured = true;
    return { outcome: 'configured' };
  } catch (error) {
    console.warn('[revenueCatAdapter] configure failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/** Only ever true if configureRevenueCat() has genuinely succeeded this session. */
export const isRevenueCatConfiguredThisSession = () => configured;

/**
 * Logs in to RevenueCat with the given App User ID — this app ALWAYS
 * passes the authenticated Supabase user's own UUID here, never an email,
 * display name, device id, or locally generated id (see
 * useRevenueCatIdentity.js, the only caller). Returns whether this was
 * the user's very first RevenueCat login (useful for analytics only,
 * never used to decide entitlement).
 */
export const logInRevenueCat = async (supabaseUserId) => {
  if (!configured || !isRevenueCatSupported() || !supabaseUserId) return { outcome: 'unavailable' };
  try {
    const result = await Purchases.logIn({ appUserID: supabaseUserId });
    return { outcome: 'logged-in', created: Boolean(result?.created) };
  } catch (error) {
    console.warn('[revenueCatAdapter] logIn failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/**
 * Logs out of RevenueCat, returning the SDK to its own anonymous identity.
 * Called on every sign-out (see useRevenueCatIdentity.js) so User B can
 * never see User A's RevenueCat-resolved entitlement on a shared device —
 * mirrors AuthContext.signOut()'s own "clear everything before the next
 * identity arrives" discipline.
 */
export const logOutRevenueCat = async () => {
  if (!configured || !isRevenueCatSupported()) return { outcome: 'unavailable' };
  try {
    await Purchases.logOut();
    return { outcome: 'logged-out' };
  } catch (error) {
    // logOut() rejects if the current user is already anonymous — an
    // ordinary, expected case (e.g. signing out a guest who never
    // completed identity login), never a real failure to surface.
    return { outcome: 'already-anonymous', message: safeErrorMessage(error) };
  }
};

/**
 * Fetches the one configured offering and resolves the package for the
 * given tier ('monthly' | 'annual') — never guesses a package identifier.
 * Both use RevenueCat's own predefined offering.monthly/offering.annual
 * accessors, since both are genuine RevenueCat packages backing a real
 * store product. There is deliberately no 'founder' tier here — the
 * founder launch offer is NOT a RevenueCat package on any platform; see
 * getAppleFounderOfferModel()/redeemAppleFounderOfferCode() and
 * getGoogleFounderSubscriptionOption() below for the actual,
 * platform-specific mechanisms (this was corrected after an earlier
 * version of this file incorrectly modeled it as a third package with an
 * invented dashboard identifier — see revenueCatConfig.js's own
 * correction note). Returns null (never a fabricated package) if
 * RevenueCat has no current offering, or no package for the requested
 * tier within it.
 */
export const getPackage = async (tier) => {
  if (!configured || !isRevenueCatSupported()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings?.current ?? offerings?.all?.[REVENUECAT_OFFERING_ID] ?? null;
    if (!offering) return null;
    if (tier === 'monthly') return offering.monthly ?? null;
    if (tier === 'annual') return offering.annual ?? null;
    return null;
  } catch (error) {
    console.warn('[revenueCatAdapter] getOfferings failed, continuing without it', safeErrorMessage(error));
    return null;
  }
};

/**
 * The founder offer's Apple mechanism, exactly as configured today
 * (source-confirmed — see revenueCatConfig.js's own FOUNDER_OFFER_MODEL).
 * A plain, synchronous config read — never calls the SDK itself. Exists
 * so a future paywall can decide what to show/offer without duplicating
 * this project's own understanding of how Apple's offer code actually
 * works.
 */
export const getAppleFounderOfferModel = () => FOUNDER_OFFER_MODEL.apple;

/**
 * Presents iOS's own code-redemption sheet (StoreKit, iOS 14+) so the
 * user can redeem the founder offer code themselves — this is Apple's
 * REAL mechanism for a Subscription Offer Code (see
 * revenueCatConfig.js's own correction note for why this is not a
 * "purchase" of any package). There is no code parameter: the OS sheet
 * itself prompts for the code; WakeWise never collects, stores, or
 * transmits the code text. Whatever the user redeems (if anything)
 * surfaces afterward as an ordinary purchase via the SAME
 * addAppleTransactionUpdateListener already wired for regular purchases —
 * no separate completion handling exists or is needed here, and this
 * function itself never grants entitlement.
 */
export const redeemAppleFounderOfferCode = async () => {
  if (!configured || !isRevenueCatSupported() || currentPlatform() !== 'ios') return { outcome: 'unavailable' };
  try {
    await Purchases.presentCodeRedemptionSheet();
    return { outcome: 'presented' };
  } catch (error) {
    console.warn('[revenueCatAdapter] presentCodeRedemptionSheet failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/**
 * The founder offer's Google mechanism, exactly as configured today
 * (source-confirmed absence — see revenueCatConfig.js's own
 * FOUNDER_OFFER_MODEL). Always reports `googleOfferId: null` until a real
 * Google Play base-plan offer is dashboard-confirmed — never invented.
 */
export const getGoogleFounderOfferModel = () => FOUNDER_OFFER_MODEL.google;

/**
 * Resolves the founder-offer SubscriptionOption on Google's annual
 * product, if one is configured — Google's REAL mechanism for a
 * discounted-first-period offer on an existing base plan (a distinct
 * SubscriptionOption on the same StoreProduct, never a separate
 * RevenueCat package — see revenueCatConfig.js's own correction note).
 * Purchased via purchaseGoogleSubscriptionOption() below, not
 * purchasePackage(). Returns null (never a fabricated option) whenever
 * FOUNDER_OFFER_MODEL.google.googleOfferId is null, which it is today —
 * this function cannot do anything useful until a real Google offer id is
 * dashboard-confirmed and recorded there.
 */
export const getGoogleFounderSubscriptionOption = async () => {
  const { googleOfferId } = FOUNDER_OFFER_MODEL.google;
  if (!configured || !isRevenueCatSupported() || currentPlatform() !== 'android' || !googleOfferId) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings?.current ?? offerings?.all?.[REVENUECAT_OFFERING_ID] ?? null;
    const annualProduct = offering?.annual?.product ?? null;
    return (annualProduct?.subscriptionOptions ?? []).find((option) => option.id === googleOfferId) ?? null;
  } catch (error) {
    console.warn('[revenueCatAdapter] getOfferings failed while resolving the Google founder option, continuing without it', safeErrorMessage(error));
    return null;
  }
};

/**
 * Purchases a Google SubscriptionOption (must have come from
 * getGoogleFounderSubscriptionOption() above, or any other real
 * SubscriptionOption) — the Google-specific purchase API, distinct from
 * purchasePackage(). Same non-entitlement-granting discipline as
 * purchasePackage() above: a 'purchased' outcome here still requires a
 * fresh Supabase read via entitlementResolver.js before treating the user
 * as entitled.
 */
export const purchaseGoogleSubscriptionOption = async (subscriptionOption) => {
  if (!configured || !isRevenueCatSupported() || currentPlatform() !== 'android' || !subscriptionOption) {
    return { outcome: 'unavailable' };
  }
  try {
    const result = await Purchases.purchaseSubscriptionOption({ subscriptionOption });
    return {
      outcome: 'purchased',
      productIdentifier: result?.productIdentifier ?? subscriptionOption.productId ?? null
    };
  } catch (error) {
    if (error?.userCancelled) return { outcome: 'cancelled' };
    console.warn('[revenueCatAdapter] purchaseSubscriptionOption failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/**
 * Starts a RevenueCat purchase for the given package (must have come from
 * getPackage() above). Resolves with a plain, non-sensitive summary —
 * never the full CustomerInfo object logged or otherwise exposed beyond
 * what the caller needs to trigger a server-side refresh/verification. A
 * 'purchased' outcome here is NEVER sufficient to grant access on its own
 * (see this file's own header) — the caller must still wait for
 * entitlementResolver.js to confirm access via a fresh Supabase read,
 * exactly like applePurchaseAdapter.js's own purchaseAppleProduct.
 */
export const purchasePackage = async (aPackage) => {
  if (!configured || !isRevenueCatSupported() || !aPackage) return { outcome: 'unavailable' };
  try {
    const result = await Purchases.purchasePackage({ aPackage });
    return {
      outcome: 'purchased',
      productIdentifier: result?.productIdentifier ?? aPackage.product?.identifier ?? null
    };
  } catch (error) {
    // The SDK's own cancellation shape (userCancelled: true) is checked
    // before treating this as a real failure — a user changing their mind
    // is expected, ordinary behaviour, never an application error.
    if (error?.userCancelled) return { outcome: 'cancelled' };
    console.warn('[revenueCatAdapter] purchasePackage failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/**
 * Restores previous purchases via RevenueCat. Like purchasePackage, never
 * grants entitlement itself — the caller must still re-check real
 * entitlement state via entitlementResolver.js after this resolves.
 * Distinguishes a genuine failure from "the call succeeded but restored
 * nothing" via the resolver's own later isEntitled check, never via a
 * fixed timeout (that inference was explicitly withdrawn in Phase 2A's
 * own useAppleRestore.js correction, for the same reason it would be
 * wrong here: a slow verification is not the same as "nothing to
 * restore").
 */
export const restoreRevenueCatPurchases = async () => {
  if (!configured || !isRevenueCatSupported()) return { outcome: 'unavailable' };
  try {
    await Purchases.restorePurchases();
    return { outcome: 'restored' };
  } catch (error) {
    console.warn('[revenueCatAdapter] restorePurchases failed', safeErrorMessage(error));
    return { outcome: 'failed', message: safeErrorMessage(error) };
  }
};

/**
 * Reads RevenueCat's own locally-cached CustomerInfo and reports whether
 * the configured entitlement is currently active according to the SDK —
 * for UI convenience only (e.g. deciding whether to show a "you already
 * have an active membership" state before even attempting a purchase).
 * NEVER treated as the access decision itself — entitlementResolver.js's
 * own server-verified read is always the actual authority. Returns null
 * (never a guessed true/false) if RevenueCat is unavailable or the call
 * fails.
 */
export const getRevenueCatEntitlementSnapshot = async () => {
  if (!configured || !isRevenueCatSupported()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const entitlement = customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
    return entitlement ? { isActive: true, willRenew: entitlement.willRenew, expirationDate: entitlement.expirationDate } : { isActive: false };
  } catch (error) {
    console.warn('[revenueCatAdapter] getCustomerInfo failed, continuing without it', safeErrorMessage(error));
    return null;
  }
};
