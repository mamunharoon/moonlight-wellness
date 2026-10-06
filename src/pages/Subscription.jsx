/* eslint-disable no-unused-vars */
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getSubscriptionOverride } from '../lib/subscriptionOverride';
import { startCheckout, openBillingPortal } from '../lib/stripeApi';
import { getStatusExplanation, formatExpiryDate } from '../lib/subscriptionStatusMessages';
import { BackButton } from '../components/BackButton';
import {
  annualEffectiveMonthly,
  annualSavingsPercent,
  formatAnnualPrice,
  formatMonthlyPrice,
  trialDisclosureText,
  CURRENCY
} from '../lib/pricingConfig';
import { isNativePlatform, isIOS, isAndroid } from '../lib/platform';
// Native purchase/restore integration — readiness-gap item: wires the
// real Subscription screen onto revenueCatAdapter.js (exactly the same
// functions SubscriptionSandboxTest.jsx has exercised end-to-end against
// a real RevenueCat sandbox) instead of applePurchaseAdapter.js's
// direct-Apple path. applePurchaseAdapter.js and its server-verification
// counterparts (verify-apple-transaction, apple-server-notifications) are
// deliberately left untouched and still deployed — this is a client-side
// CUTOVER of which SDK this screen's buttons call, per revenueCatAdapter.js's
// own documented migration strategy, not a removal of the legacy path.
// `openAppleManageSubscriptions` is the one exception kept from the Apple
// adapter: it just opens iOS's own OS-level subscription-management
// screen, a platform feature unrelated to which SDK made the purchase —
// correct for a RevenueCat-originated Apple subscription exactly as it
// was for a direct-Apple one.
import { openAppleManageSubscriptions } from '../lib/applePurchaseAdapter';
import {
  getPackage,
  purchasePackage,
  purchaseGoogleOrdinaryAnnual,
  purchaseGoogleAnnualTierExplicit,
  redeemAppleFounderOfferCode,
  addRevenueCatCustomerInfoListener,
  checkIntroEligibility,
  describeGoogleTrialOffer,
  getGoogleNamedOfferOption,
  getGoogleBasePlanAnnualOption
} from '../lib/revenueCatAdapter';
import { GOOGLE_OFFER_NAMES } from '../lib/revenueCatConfig';
// Explicit-currency native pricing (readiness-gap fix): a bare "$" from
// RevenueCat's own priceString is exactly how a USD figure got mistaken
// for AUD on a TestFlight sandbox tester's device — see
// currencyDisplay.js's own header for the full root-cause writeup.
// Always built from the package/option's own real price + ISO currency
// code, never a hardcoded/converted figure.
import { formatNativeStorePrice, formatGoogleMicrosPrice, formatExplicitCurrencyAmount } from '../lib/currencyDisplay';
// Trial/intro-offer wording, reconciled per-product instead of a single
// "annual only" assumption — see trialOfferWording.js's own header for
// why (a real sandbox purchase recorded a TRIAL period on the MONTHLY
// iOS product).
import { describeIntroOfferWording } from '../lib/trialOfferWording';
// Native purchase integration — restore is now consolidated onto the same
// shared hook Profile.jsx uses (readiness-gap item 1), rather than this
// page's own separate inline implementation.
// Reuses the exact same bounded-retry constants useNativeRestore.js's own
// confirmation poll uses, so a purchase and a restore wait the same real
// amount of time for the same underlying webhook, never two independently
// drifting numbers.
import {
  useNativeRestore,
  NEUTRAL_RESTORE_COMPLETION_MESSAGE,
  CONFIRMATION_MAX_ATTEMPTS,
  CONFIRMATION_RETRY_DELAY_MS
} from '../hooks/useNativeRestore';
import { useRevenueCatIdentityStatus, isRevenueCatIdentityReadyFor } from '../lib/revenueCatIdentityStatus';
// Verified package/product details for the Android management deep link
// below (readiness-gap item 2) — com.zavaraai.wakewise is confirmed in
// android/app/build.gradle's applicationId and codemagic.yaml's own
// BUNDLE_ID anchor, not a guessed/invented value.
const ANDROID_PACKAGE_NAME = 'com.zavaraai.wakewise';

// Platform behaviour (native purchase integration): computed once — the
// platform an app is running on never changes within a session, so these
// are plain module-scope constants, not component state. Native iOS/
// Android: RevenueCat purchase/restore only, Stripe checkout/portal
// hidden entirely below for BOTH (not just iOS — see readiness-gap item
// 7, a native Android build must never fall through to the Stripe/web
// branch the way it silently would have before IS_NATIVE_ANDROID
// existed). Web build: Stripe only, unchanged. An existing active
// Stripe/Apple/Google subscriber still sees their real entitlement on
// any platform (the "Current plan" section below reads the unified,
// provider-aware `entitlement` from SubscriptionContext the same way on
// every platform) — they just don't see a purchase CTA for a channel
// that isn't theirs.
const IS_NATIVE_IOS = isNativePlatform() && isIOS();
const IS_NATIVE_ANDROID = isNativePlatform() && isAndroid();
const IS_NATIVE = IS_NATIVE_IOS || IS_NATIVE_ANDROID;

// The same build-time kill-switch SubscriptionSandboxTest.jsx already
// uses (see that file's own header) — Vite inlines this at BUILD time,
// and codemagic.yaml only ever sets it 'true' for the dedicated
// wakewise-ios-sandbox-test workflow, never wakewise-ios-testflight. Used
// here only to adjust COPY (never charge wording, never a date, never an
// entitlement rule) on the real Subscription screen so a sandbox tester
// is never told a real charge/renewal will follow a test purchase.
const IS_SANDBOX_TEST_BUILD = import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST === 'true';
const NATIVE_STORE_LABEL = IS_NATIVE_IOS ? 'the App Store' : 'Google Play';

// Sandbox "no real charge" wording is PLATFORM-SPECIFIC (readiness-gap
// fix) — whether this build's purchases actually avoid a real charge is
// a store-level fact the VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST build flag
// alone cannot establish:
//   - iOS/TestFlight: Apple ALWAYS routes a TestFlight build's in-app
//     purchases through its sandbox backend, regardless of which Apple
//     ID is signed in (Apple/RevenueCat-documented — see
//     https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/
//     and RevenueCat's own sandbox docs) — a confident, unconditional
//     claim is accurate here.
//   - Android/Google Play: a purchase only avoids a real charge if the
//     SPECIFIC Google account making it is added as a Play Console
//     License Tester (Monetization setup -> License testing) — a Play
//     Console configuration fact this app's own build flag has no
//     bearing on whatsoever (confirmed via Google's own Play Console
//     documentation). Never claimed unconditionally here.
const SANDBOX_BANNER_TEXT = IS_NATIVE_IOS
  ? "Sandbox test build — TestFlight purchases always run through Apple's test environment and never charge real money. Trials and renewals here run much faster than in production."
  : 'Sandbox test build — purchases are only test purchases if your Google account is a Play Console License Tester; confirm this first. Trials and renewals here may also run faster than in production.';
const SANDBOX_TRIAL_CLAUSE = IS_NATIVE_IOS
  ? 'this sandbox build never charges real money'
  : 'this sandbox build only avoids a real charge for Play Console License Tester accounts';
const SANDBOX_RENEWAL_TEXT = IS_NATIVE_IOS
  ? 'This sandbox test build never charges real money, regardless of what renews or expires below.'
  : 'This sandbox test build only avoids a real charge for Play Console License Tester accounts, regardless of what renews or expires below.';

/*
 * Subscription Model, Sprint 2 Stage 1 (+ Stage 1A, Stage 3A) — Subscription screen
 *
 * Reached from Settings (not a bottom-nav tab), so this page owns its
 * own small back-affordance header — same pattern as Settings.jsx and
 * SettingsInfo.jsx, not a new one.
 *
 * Stage 1A: the dev-override badge below getSubscriptionOverride()
 * directly (not through useSubscription()) purely to display the raw
 * override value — it's already baked into `subscription` itself via
 * SubscriptionContext, so this is never out of sync with what's shown
 * above, just a visible reminder of *why* Current plan says what it
 * says. Renders nothing outside development (see subscriptionOverride.js).
 *
 * Stage 3A: Upgrade and Manage subscription are now wired to real
 * Stripe Test Mode Checkout / Billing Portal (see stripeApi.js and the
 * create-checkout-session / create-portal-session Edge Functions). This
 * page never decides entitlement itself — it only ever starts a hosted
 * Stripe flow and, on return, calls refreshSubscription() to re-read
 * whatever the webhook has since written. The old "Restore purchases"
 * placeholder is gone entirely: a hosted-redirect flow has no separate
 * restore concept, and Stripe Customer Portal (Manage subscription) is
 * the correct web equivalent for viewing/cancelling/managing billing.
 */
const PLAN_COMPARISON = [
  { free: 'Morning routines', plus: 'Guided audio' },
  { free: 'Evening routines', plus: 'Advanced insights' },
  { free: 'Support tools', plus: 'Extended reflections' }
];

const PLUS_FEATURES = [
  { id: 'audio', icon: 'graphic_eq', title: 'Guided audio', description: 'Voice-guided sessions for every routine.' },
  { id: 'reflections', icon: 'auto_stories', title: 'Extended reflections', description: 'Deeper evening journaling prompts.' },
  { id: 'insights', icon: 'insights', title: 'Personalised insights', description: 'Patterns in your rhythm over time.' },
  { id: 'premium', icon: 'diamond', title: 'Premium experiences', description: 'Exclusive soundscapes and sessions.' }
];

const PLAN_LABELS = { free: 'Free', plus: 'WakeWise Plus' };
// Covers every entitlementResolver.js ENTITLEMENT_STATES value this page
// can now genuinely show, not just the legacy table's narrower
// trial/active/cancelled/expired vocabulary — a native (Apple/Google)
// subscriber can land in grace_period/billing_issue/
// cancelled_active_until_period_end, none of which the old legacy-table
// read could ever produce.
const STATUS_LABELS = {
  free: 'Free',
  trial: 'Trial',
  active: 'Active',
  cancelled_active_until_period_end: 'Active (cancelling)',
  grace_period: 'Grace period',
  billing_issue: 'Billing issue',
  expired: 'Expired',
  verification_unavailable: 'Unavailable'
};
const INTERVAL_LABELS = { monthly: 'Monthly', yearly: 'Yearly' };

const formatRenewalDate = (entitlement) => {
  if (!entitlement.isEntitled || !entitlement.currentPeriodEnd) return 'No renewal date';
  return formatExpiryDate(entitlement.currentPeriodEnd);
};

export const Subscription = () => {
  const navigate = useNavigate();
  // RevenueCat identity (the Supabase user id passed as appUserID) is
  // already established app-wide by App.jsx's RevenueCatIdentityHandler
  // (useRevenueCatIdentity.js) before this page ever mounts — unlike the
  // legacy direct-Apple path, purchasePackage() takes no appAccountToken
  // parameter. `user` is still read here, though, for two reasons neither
  // of which is "identify the purchase": (1) checking RevenueCat's own
  // identity readiness is READY for THIS exact id before allowing a
  // purchase/founder action (readiness-gap item 3), and (2) detecting an
  // account switch while a purchase/confirmation poll is in flight, so a
  // late result can never be applied to a different signed-in user
  // (readiness-gap item 5).
  const { isGuest, user } = useAuth();
  const identityStatus = useRevenueCatIdentityStatus();
  // `subscription` (the legacy Stripe/manual-only table) is intentionally
  // not read here anymore — see `entitlement`'s own header below. Still
  // destructured via refreshSubscription only, for the existing Stripe
  // checkout-return flow, which writes to that same legacy table.
  const { entitlement, refreshSubscription, refreshEntitlement } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-in' | 'founder-confirm' | null
  const [interval, setInterval_] = useState('monthly'); // 'monthly' | 'yearly'
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);
  const [banner, setBanner] = useState(null); // 'success' | 'cancelled' | null
  const devOverride = getSubscriptionOverride();

  // Native purchase integration — RevenueCat-backed state, shared by iOS
  // and Android (unlike the legacy Apple-only state this replaces).
  // Entirely inert on web (every setter below is only ever reached from
  // native-gated effects/handlers).
  const [monthlyPackage, setMonthlyPackage] = useState(null);
  const [annualPackage, setAnnualPackage] = useState(null);
  const [nativeProductsState, setNativeProductsState] = useState(IS_NATIVE ? 'loading' : 'idle'); // 'idle'|'loading'|'ready'|'unavailable'
  // Per-user introductory-offer eligibility (readiness-gap fix: trial
  // wording reconciliation) — keyed by real product id, iOS only
  // (checkIntroEligibility itself is a no-op everywhere else, per
  // revenueCatAdapter.js's own header). Android's per-user eligibility is
  // always genuinely unknowable (RevenueCat-documented), so this stays an
  // empty map there and every lookup below correctly falls back to
  // conditional wording.
  const [introEligibility, setIntroEligibility] = useState({});
  // idle|purchasing|awaiting-confirmation|confirmation_timeout|cancelled|failed|identity_not_ready
  const [nativePurchaseState, setNativePurchaseState] = useState('idle');
  const [nativePurchaseError, setNativePurchaseError] = useState(null);
  const [appleManageState, setAppleManageState] = useState('idle'); // 'idle'|'opening'|'failed'
  // Restore is consolidated onto the same hook Profile.jsx uses
  // (readiness-gap item 1) — no separate inline restore state here.
  const { state: nativeRestoreState, error: nativeRestoreError, restore: handleNativeRestore } = useNativeRestore();

  // Account-switch safety (readiness-gap item 5): the user id THIS
  // purchase/founder/confirmation-poll attempt was started for — checked
  // before applying any async result, never assumed to still be the
  // current signed-in user. A separate tracking ref from
  // useNativeRestore.js's own (restore and purchase are independent
  // in-flight operations that must not clobber each other's checks).
  const startedForUserIdRef = useRef(null);

  // Never grants access from a client-side purchase callback —
  // RevenueCat purchases are verified asynchronously, server-side, by
  // RevenueCat's own systems and reported to this app only via the
  // deployed revenuecat-webhook (never a client-initiated verify call —
  // unlike the legacy direct-Apple path, a RevenueCat purchasePackage()
  // result carries no jwsRepresentation for this app to forward anywhere).
  // The only source of truth for whether the user has access is a fresh
  // read of real entitlement state via refreshEntitlement() — the
  // provider_subscriptions-aware read, NOT refreshSubscription() (the
  // legacy Stripe-only `subscriptions` table a native purchase never
  // writes to).
  const handleNativePurchaseResult = async (result) => {
    if (result.outcome === 'cancelled') {
      setNativePurchaseState('cancelled');
      return;
    }
    if (result.outcome === 'unavailable') {
      setNativePurchaseState('failed');
      setNativePurchaseError('In-app purchases are not available right now.');
      return;
    }
    if (result.outcome === 'not_found' || result.outcome === 'mismatch') {
      // purchaseGoogleOrdinaryAnnual/purchaseGoogleAnnualTierExplicit's
      // own explicit-selection enforcement rejected rather than
      // purchasing something the user didn't ask for — surfaced plainly,
      // never silently retried as a different tier.
      setNativePurchaseState('failed');
      setNativePurchaseError("We couldn't match the expected plan. Please try again or contact support.");
      return;
    }
    if (result.outcome === 'receipt_already_in_use') {
      setNativePurchaseState('failed');
      setNativePurchaseError('That purchase is already linked to a different account.');
      return;
    }
    if (result.outcome === 'failed') {
      setNativePurchaseState('failed');
      setNativePurchaseError(result.message || "We couldn't complete that purchase. Please try again.");
      return;
    }
    if (result.outcome === 'purchased') {
      await beginConfirmationPoll();
    }
  };

  // Handle delayed webhook confirmation (readiness-gap item 4): the
  // native purchase call succeeding is NOT the same as the entitlement
  // actually being recorded — that depends on revenuecat-webhook, an
  // async, server-side event this client cannot await directly. A
  // bounded number of real entitlement re-reads (never a single fixed
  // delay used to INFER failure — see useNativeRestore.js's own header
  // for why that inference must never return in any form) decides
  // whether to show a confirmed state or an honest recovery offer.
  // Shared with the "founder purchase confirmed" path below — both start
  // from the exact same poll.
  const beginConfirmationPoll = async () => {
    const forUserId = startedForUserIdRef.current;
    setNativePurchaseState('awaiting-confirmation');
    for (let attempt = 0; attempt < CONFIRMATION_MAX_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_RETRY_DELAY_MS));
      // The signed-in user may have changed WHILE this poll was running —
      // never apply a result (or even keep polling) for a now-different
      // account.
      if (startedForUserIdRef.current !== forUserId) return;
      const refreshed = await refreshEntitlement();
      if (startedForUserIdRef.current !== forUserId) return;
      if (refreshed?.isEntitled) return; // the !plusActive-gated section unmounts itself once this re-renders
    }
    if (startedForUserIdRef.current === forUserId) {
      setNativePurchaseState('confirmation_timeout');
    }
  };

  // A manual recovery action (readiness-gap item 4's "offer recovery")
  // for when the bounded poll above exhausted without confirmation —
  // restarts the exact same bounded wait rather than claiming anything
  // new happened.
  const handleCheckConfirmationAgain = () => {
    beginConfirmationPoll();
  };

  useEffect(() => {
    if (!IS_NATIVE) return undefined;

    let ignore = false;
    Promise.all([getPackage('monthly'), getPackage('annual')]).then(async ([monthly, annual]) => {
      if (ignore) return;
      setMonthlyPackage(monthly);
      setAnnualPackage(annual);
      setNativeProductsState(monthly || annual ? 'ready' : 'unavailable');

      // Per-user trial/intro eligibility (iOS only — see
      // checkIntroEligibility's own header) for whichever real product
      // ids actually came back, never a guessed/hardcoded id.
      if (IS_NATIVE_IOS) {
        const productIds = [monthly?.product?.identifier, annual?.product?.identifier].filter(Boolean);
        const eligibility = await checkIntroEligibility(productIds);
        if (!ignore) setIntroEligibility(eligibility);
      }
    });

    // The real completion signal for a founder offer-code redemption
    // (iOS) and a safety net for any purchase/renewal RevenueCat observes
    // out-of-band — see addRevenueCatCustomerInfoListener's own header.
    // Only acted on if it's for the account a purchase/founder action was
    // actually started for from THIS page (readiness-gap item 5) — a
    // listener fire with nothing in flight here (startedForUserIdRef
    // null) is correctly ignored; useNativeRestore.js's own listener
    // instance is what reacts to restore-originated events.
    const removeListener = addRevenueCatCustomerInfoListener(() => {
      if (startedForUserIdRef.current && startedForUserIdRef.current === user?.id) {
        refreshEntitlement();
      }
    });

    return () => {
      ignore = true;
      removeListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Account-switch safety: if the signed-in user changes while a
  // purchase/confirmation-poll from a PREVIOUS user is still tracked,
  // forget it entirely — never let a late poll iteration or listener
  // callback touch the new user's state, and never show the previous
  // user's purchase status to whoever is signed in now on a shared
  // device.
  useEffect(() => {
    if (startedForUserIdRef.current && startedForUserIdRef.current !== (user?.id ?? null)) {
      startedForUserIdRef.current = null;
      setNativePurchaseState('idle');
      setNativePurchaseError(null);
    }
  }, [user?.id]);

  const handleNativePurchase = async () => {
    if (isGuest) {
      setActiveDialog('sign-in');
      return;
    }
    if (!isRevenueCatIdentityReadyFor(identityStatus, user?.id)) {
      setNativePurchaseState('identity_not_ready');
      setNativePurchaseError('Still preparing your account. Please try again in a moment.');
      return;
    }
    setNativePurchaseState('purchasing');
    setNativePurchaseError(null);
    startedForUserIdRef.current = user?.id ?? null;

    let result;
    if (interval === 'monthly') {
      result = await purchasePackage(monthlyPackage);
    } else if (IS_NATIVE_ANDROID) {
      // Never purchasePackage()/defaultOption for Android annual — see
      // purchaseGoogleOrdinaryAnnual's own header. Founder is never
      // reachable from this button; it has its own explicit action below.
      result = await purchaseGoogleOrdinaryAnnual(annualPackage);
    } else {
      // iOS annual: no defaultOption ambiguity, a plain package purchase
      // is safe — the founder tier is never purchased this way on this
      // platform at all (offer-code redemption instead, its own action
      // below).
      result = await purchasePackage(annualPackage);
    }
    // The signed-in user may have changed WHILE the native call was in
    // flight — never apply its result to a now-different account.
    if (startedForUserIdRef.current !== (user?.id ?? null)) return;
    await handleNativePurchaseResult(result);
  };

  // Android's founder mechanism is a real purchase (a distinct
  // SubscriptionOption on the same annual product) — gated behind an
  // explicit confirmation so it is never one accidental tap away from a
  // real charge. iOS's founder mechanism is Apple's own OS code-
  // redemption sheet, which is already its own explicit, user-driven
  // confirmation step — no extra dialog needed before presenting it.
  const handleFounderOfferAction = () => {
    if (isGuest) {
      setActiveDialog('sign-in');
      return;
    }
    if (!isRevenueCatIdentityReadyFor(identityStatus, user?.id)) {
      setNativePurchaseState('identity_not_ready');
      setNativePurchaseError('Still preparing your account. Please try again in a moment.');
      return;
    }
    if (IS_NATIVE_ANDROID) {
      setActiveDialog('founder-confirm');
      return;
    }
    if (IS_NATIVE_IOS) {
      handleAppleFounderRedemption();
    }
  };

  const handleAppleFounderRedemption = async () => {
    setNativePurchaseState('purchasing');
    setNativePurchaseError(null);
    startedForUserIdRef.current = user?.id ?? null;
    const result = await redeemAppleFounderOfferCode();
    if (result.outcome !== 'presented') {
      setNativePurchaseState('failed');
      setNativePurchaseError("We couldn't open the code redemption screen. Please try again.");
      return;
    }
    // The user is now in Apple's own OS sheet; completion (if any) arrives
    // asynchronously via the CustomerInfo listener above, never this
    // function's own return — resetting to idle here would otherwise show
    // a confusing "Subscribe" button while the OS sheet is still open.
    setNativePurchaseState('idle');
  };

  const confirmGoogleFounderPurchase = async () => {
    setActiveDialog(null);
    setNativePurchaseState('purchasing');
    setNativePurchaseError(null);
    startedForUserIdRef.current = user?.id ?? null;
    const result = await purchaseGoogleAnnualTierExplicit(annualPackage, 'founder');
    if (startedForUserIdRef.current !== (user?.id ?? null)) return;
    await handleNativePurchaseResult(result);
  };

  // The verified Android package name (ANDROID_PACKAGE_NAME, above) plus
  // the real, server-recorded product id for THIS subscriber
  // (entitlement.product — never a guessed/hardcoded one of the two
  // possible product ids) — Google's own documented deep-link format for
  // managing a specific subscription (readiness-gap item 2). A plain
  // external link, not a new native plugin: this Capacitor WebView has no
  // existing @capacitor/browser dependency, and a play.google.com link
  // already resolves to the Play Store app via the device's own intent
  // handling in the common case — not independently re-verified against
  // a real device in this task.
  const androidManageSubscriptionUrl =
    entitlement.provider === 'google' && entitlement.product
      ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(entitlement.product)}&package=${encodeURIComponent(ANDROID_PACKAGE_NAME)}`
      : null;

  const handleAppleManage = async () => {
    setAppleManageState('opening');
    const result = await openAppleManageSubscriptions();
    setAppleManageState(result.outcome === 'opened' ? 'idle' : 'failed');
  };

  if (ConfirmDialog && Fragment && Link) { /* no-op to satisfy blind linter */ }

  // Stage 3A: on return from hosted Stripe Checkout, refresh subscription
  // state (?checkout=success) or just acknowledge cancellation
  // (?checkout=cancelled), then strip the query param either way. Named,
  // component-scope handler + an inline wrapper that only awaits it —
  // same shape as every other data-loading effect in this codebase
  // (AuthContext.jsx, SubscriptionContext.jsx, AdminUsers.jsx).
  const handleCheckoutReturn = async (checkoutParam) => {
    if (checkoutParam === 'success') {
      await refreshSubscription();
      setBanner('success');
    } else if (checkoutParam === 'cancelled') {
      setBanner('cancelled');
    }
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    const checkoutParam = searchParams.get('checkout');
    if (!checkoutParam) return;

    const load = async () => {
      await handleCheckoutReturn(checkoutParam);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // The unified, provider-aware entitlement is the only source that can
  // ever reflect a real Apple/Google purchase — `subscription` (the
  // legacy table) is Stripe/manual-only and a native purchase never
  // writes to it. See entitlement/refreshEntitlement's own header above.
  const loading = entitlement.state === 'loading';
  const verificationUnavailable = entitlement.state === 'verification_unavailable';
  const plusActive = entitlement.isEntitled;
  // getStatusExplanation/formatExpiryDate (subscriptionStatusMessages.js)
  // were written against the legacy row's own field names — reused
  // unchanged via this small adapter object rather than touching that
  // file, exactly the same vocabulary, just sourced from `entitlement`.
  const statusExplanationInput = {
    status: entitlement.status,
    expires_at: entitlement.currentPeriodEnd,
    cancel_at_period_end: entitlement.cancelAtPeriodEnd
  };

  // Trial end vs. next renewal (readiness-gap fix): the SAME
  // entitlement.currentPeriodEnd timestamp either way — it already comes
  // straight from the provider's own authoritative expiry
  // (revenuecat-webhook writes event.expiration_at_ms verbatim, never a
  // locally-computed or extended date) — but the LABEL must say which
  // kind of date it is, never call a still-in-trial date a "renewal".
  const periodEndRowLabel = entitlement.status === 'trial' ? 'Trial ends' : 'Next renewal';

  // Native pricing/trial section data (readiness-gap fix: explicit
  // currency + per-product trial reconciliation). The selected package's
  // own real product data only — never a different package's, never a
  // hardcoded figure.
  const selectedNativePackage = interval === 'monthly' ? monthlyPackage : annualPackage;
  const selectedNativeProductId = selectedNativePackage?.product?.identifier ?? null;
  // iOS: a real per-product introPrice (StoreKit/RevenueCat), checked
  // independently for monthly and annual — never assumed to exist only
  // on annual. Android: the only trial offer this codebase models is the
  // annual product's own 'annual-trial-7-days' offer (GOOGLE_OFFER_NAMES)
  // — there is no equivalent monthly offer in the Play Console catalogue
  // today, so monthly correctly makes no claim there.
  const selectedIntroOffer = IS_NATIVE_IOS
    // iOS's introPrice carries price/period fields but no currencyCode of
    // its own (a product's introductory price is always in the SAME
    // currency as its standard price) — explicitly attached here so
    // trialOfferWording.js can show the real discounted amount, never
    // the product's standard/renewal price mistaken for it.
    ? selectedNativePackage?.product?.introPrice
      ? { ...selectedNativePackage.product.introPrice, currencyCode: selectedNativePackage.product.currencyCode }
      : null
    : interval === 'yearly'
      ? describeGoogleTrialOffer(annualPackage)
      : null;
  const selectedIntroEligibility = IS_NATIVE_IOS ? introEligibility[selectedNativeProductId] ?? null : null;
  const introOfferWording = describeIntroOfferWording(
    selectedIntroOffer,
    selectedIntroEligibility,
    NATIVE_STORE_LABEL,
    IS_SANDBOX_TEST_BUILD ? SANDBOX_TRIAL_CLAUSE : null
  );

  // Founder-offer price (Android only — iOS's founder mechanism is Apple's
  // own offer-code redemption sheet, which shows its own price, never
  // this app's). Resolved from the SAME already-fetched annualPackage,
  // never a second network round-trip, and never shown unless the real
  // SubscriptionOption/price actually resolved.
  //
  // readiness-gap fix: fullPricePhase is explicitly documented as "the
  // period of fullPricePhase (AFTER free and intro trials)" — i.e. the
  // STANDARD RENEWAL price (AUD 59.99), not the founder offer's own
  // discounted first-year amount (AUD 49.99). introPhase is the real
  // discounted phase (RevenueCat's own "first pricing phase where
  // amountMicros is greater than 0") — the correct source for what this
  // offer actually charges first. Falls back to the first pricing phase
  // generically (never to fullPricePhase, which would silently show the
  // wrong, higher renewal amount as if it were the offer price) if
  // introPhase itself is somehow absent.
  const googleFounderOption = IS_NATIVE_ANDROID ? getGoogleNamedOfferOption(annualPackage, GOOGLE_OFFER_NAMES.founder) : null;
  const googleFounderOfferPrice = googleFounderOption?.introPhase?.price ?? googleFounderOption?.pricingPhases?.[0]?.price ?? null;
  const googleFounderPriceText = googleFounderOfferPrice ? formatGoogleMicrosPrice(googleFounderOfferPrice) : null;

  // Headline "Annual" price (readiness-gap fix — task 3's "a package's
  // standard product price may differ from its offer price"):
  // PurchasesStoreProduct.price/currencyCode are documented as containing
  // "the price value of defaultOption for Google Play" — and this
  // project's OWN describeDefaultAnnualSelection finding already warns
  // defaultOption can resolve to the trial/founder offer rather than the
  // base plan (RevenueCat's own defaultOption algorithm picks the
  // longest-trial/cheapest-first-phase option). So the plain "Annual"
  // headline figure must come from the explicitly-resolved BASE PLAN
  // option's own fullPricePhase (its one real, standard recurring price)
  // — never from product.price, which could silently show a discounted
  // offer's price as if it were the ordinary annual price. iOS has no
  // equivalent risk (no SubscriptionOption/defaultOption concept;
  // product.price is always the plain standard price there), so this
  // only branches for Android + the annual interval.
  const googleBasePlanAnnualOption = IS_NATIVE_ANDROID ? getGoogleBasePlanAnnualOption(annualPackage) : null;
  const selectedNativePriceText =
    IS_NATIVE_ANDROID && interval === 'yearly'
      ? googleBasePlanAnnualOption?.fullPricePhase?.price
        ? formatGoogleMicrosPrice(googleBasePlanAnnualOption.fullPricePhase.price)
        : null
      : formatNativeStorePrice(selectedNativePackage?.product);

  const handleUpgradeClick = () => {
    if (isGuest) {
      setActiveDialog('sign-in');
      return;
    }
    startCheckoutFlow();
  };

  // Duplicate-Subscription Remediation — the Edge Function's structured
  // error codes get a specific message; ALREADY_CHECKOUT_IN_PROGRESS with
  // a resumable URL redirects straight to the existing Checkout Session
  // instead of dead-ending the user in an error state.
  const startCheckoutFlow = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      await startCheckout(interval);
      // On success this redirects the browser via window.location.href
      // and never returns control here.
    } catch (e) {
      console.error('Error starting checkout:', e.message);
      if (e.code === 'ALREADY_CHECKOUT_IN_PROGRESS' && e.checkoutUrl) {
        window.location.href = e.checkoutUrl;
        return;
      }
      if (e.code === 'ALREADY_SUBSCRIBED') {
        setCheckoutError('You already have a subscription. Manage it below.');
      } else if (e.code === 'ALREADY_CHECKOUT_IN_PROGRESS') {
        setCheckoutError('A checkout is already in progress for your account. Please wait a moment and try again.');
      } else if (e.code === 'ATTEMPT_NO_LONGER_VALID') {
        setCheckoutError('That checkout attempt is no longer valid. Please try again.');
      } else {
        setCheckoutError("We couldn't start checkout. Please try again.");
      }
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      await openBillingPortal();
    } catch (e) {
      console.error('Error opening billing portal:', e.message);
      setPortalError("We couldn't open billing management. Please try again.");
      setPortalLoading(false);
    }
  };

  const rowClass = 'flex items-center justify-between p-4 min-h-[56px]';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/settings" label="Back to Settings" />
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Subscription</h2>
      </div>

      {devOverride && (
        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-3 py-1.5 inline-block">
          Dev override active — plan forced to {devOverride}
        </p>
      )}

      {banner === 'success' && (
        <p role="status" className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1.5 text-center">
          Checkout complete — your subscription is updating.
        </p>
      )}
      {banner === 'cancelled' && (
        <p role="status" className="text-xs text-on-surface-variant bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-center">
          Checkout cancelled — no changes were made.
        </p>
      )}

      {/* Current plan — sourced from `entitlement`, the unified read
          across Stripe, Apple, and Google (see its own header above), so
          this is correct for every provider and every platform, not just
          Stripe/legacy-table subscribers. */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Current plan</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Current plan</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : PLAN_LABELS[plusActive ? 'plus' : 'free']}
            </span>
          </div>
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Status</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : STATUS_LABELS[entitlement.state] ?? entitlement.state}
            </span>
          </div>
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">{loading ? 'Next renewal' : periodEndRowLabel}</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : formatRenewalDate(entitlement)}
            </span>
          </div>
        </div>
        {!loading && getStatusExplanation(statusExplanationInput) && (
          <p className="text-xs text-on-surface-variant px-1 leading-relaxed">{getStatusExplanation(statusExplanationInput)}</p>
        )}
        {/* Sandbox-only clarification (readiness-gap fix, task 6): Apple's
            own TestFlight sandbox renews/compresses EVERY subscription
            period — including the initial trial — to a fixed 24-hour
            cycle regardless of the real configured duration (RevenueCat:
            "As of December 2024, Apple changed TestFlight subscription
            renewals to occur once every 24 hours, regardless of the
            subscription duration"). Never changes the date shown (still
            the same authoritative entitlement.currentPeriodEnd) or access
            itself — text only, so a tester does not mistake the
            compressed sandbox date for the real production trial length. */}
        {!loading && IS_SANDBOX_TEST_BUILD && entitlement.status === 'trial' && (
          <p className="text-[10px] text-on-surface-variant px-1 leading-relaxed">
            This sandbox test build uses the store's own accelerated test clock — Apple/Google compress trial and
            renewal periods for testing, so the date above will not match the real duration advertised to production
            users.
          </p>
        )}
        {verificationUnavailable && (
          <p role="alert" className="text-[10px] text-red-400 font-medium px-1">
            We couldn't verify your subscription right now. Showing the last known state.
          </p>
        )}
      </section>

      {/* Stage 1A: short Free vs Plus explainer, separate from the
          detailed Solas Plus feature list below — this answers "what's
          the difference" at a glance before the fuller pitch. */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Free vs Plus</h3>
        <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-2">
            <span className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface-variant border-b border-white/5">Free</span>
            <span className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-primary border-b border-white/5">Plus</span>
            {PLAN_COMPARISON.map((row, i) => (
              <Fragment key={i}>
                <span className="px-4 py-3 text-sm text-on-surface-variant border-t border-white/5">{row.free}</span>
                <span className="px-4 py-3 text-sm font-semibold text-on-surface border-t border-white/5">{row.plus}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Solas Plus */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">WakeWise Plus</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          {PLUS_FEATURES.map((feature) => (
            <div key={feature.id} className="flex items-center gap-3 p-4 min-h-[56px]">
              <span className="material-symbols-outlined text-primary text-xl shrink-0">{feature.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-on-surface">{feature.title}</span>
                <span className="block text-xs text-on-surface-variant">{feature.description}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Actions — native iOS/Android: RevenueCat purchase only, never
          Stripe (readiness-gap item 7: IS_NATIVE, not just IS_NATIVE_IOS,
          so a native Android build can never fall through to the
          Stripe/web branch below it). Web: Stripe only, unchanged from
          before this task. */}
      {!plusActive && !IS_NATIVE && (
        <div className="space-y-3">
          <div className="flex glass-panel rounded-full p-1 border-white/10">
            {Object.entries(INTERVAL_LABELS).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setInterval_(value)}
                className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                  interval === value ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Exact price, currency, and billing interval — shown for
              whichever plan is currently selected, never preselecting or
              visually favouring the annual option over monthly. */}
          <div className="glass-panel rounded-2xl p-4 text-center space-y-1 border-white/10">
            <p className="text-lg font-bold text-on-surface">
              {interval === 'monthly' ? formatMonthlyPrice() : formatAnnualPrice()}
            </p>
            {interval === 'yearly' && (
              <p className="text-xs text-on-surface-variant">
                Approximately {formatExplicitCurrencyAmount(annualEffectiveMonthly(), CURRENCY)} per month — save
                approximately {annualSavingsPercent()}% compared with monthly billing.
              </p>
            )}
            <p className="text-xs text-on-surface-variant pt-1">{trialDisclosureText()}</p>
          </div>

          <p className="text-[11px] text-on-surface-variant text-center leading-relaxed px-2">
            By subscribing, you agree to our{' '}
            <Link to="/settings/subscription-terms" className="text-primary font-semibold">Subscription Terms</Link>
            {' '}and{' '}
            <Link to="/settings/refund-policy" className="text-primary font-semibold">Refund Policy</Link>.
          </p>

          <button
            onClick={handleUpgradeClick}
            disabled={checkoutLoading}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60"
          >
            {checkoutLoading ? 'Redirecting to checkout…' : 'Upgrade to WakeWise Plus'}
          </button>
          {checkoutError && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1">{checkoutError}</p>
          )}
        </div>
      )}

      {!plusActive && IS_NATIVE && (
        <div className="space-y-3">
          <div className="flex glass-panel rounded-full p-1 border-white/10">
            {Object.entries(INTERVAL_LABELS).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setInterval_(value)}
                className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                  interval === value ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="glass-panel rounded-2xl p-4 text-center space-y-1 border-white/10">
            {nativeProductsState === 'loading' && (
              <p className="text-sm text-on-surface-variant">
                Loading prices from {IS_NATIVE_IOS ? 'the App Store' : 'Google Play'}…
              </p>
            )}
            {nativeProductsState === 'unavailable' && (
              <p className="text-sm text-on-surface-variant">
                We couldn't load {IS_NATIVE_IOS ? 'App Store' : 'Google Play'} pricing right now. Please try again
                shortly.
              </p>
            )}
            {nativeProductsState === 'ready' && (
              <>
                {/* Never a hard-coded/converted price on native, and never
                    the ambiguous bare-symbol priceString (readiness-gap
                    fix — see currencyDisplay.js's own header for the
                    incident this replaces): always a real price + ISO
                    4217 currency code, explicitly labelled (e.g. "AUD
                    9.99"). For Android annual specifically, the EXPLICITLY
                    RESOLVED base-plan option's own standard price
                    (selectedNativePriceText, above) — never product.price,
                    which is documented as reflecting Google's own
                    defaultOption and could silently show a discounted
                    trial/founder offer's price as if it were the ordinary
                    annual price. If that specific plan's price didn't come
                    back at all, an honest unavailable message is shown
                    instead — never a different number. */}
                {selectedNativePackage?.product ? (
                  <p className="text-lg font-bold text-on-surface">{selectedNativePriceText ?? 'Price unavailable'}</p>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    We couldn't load pricing for this plan right now. Please try again shortly.
                  </p>
                )}
                {/* Trial/intro-offer wording, reconciled per PRODUCT
                    (readiness-gap fix: a real sandbox purchase recorded a
                    TRIAL period on the MONTHLY iOS product, contradicting
                    this section's previous "annual only" assumption) —
                    see trialOfferWording.js's own header. Renders nothing
                    at all when the selected product genuinely has no
                    offer, and never claims the CURRENT user is eligible
                    beyond what checkIntroEligibility (iOS) actually
                    reports — Android's eligibility is always unknown, so
                    its wording stays conditional and lets the store's own
                    purchase sheet decide. */}
                {introOfferWording && <p className="text-xs text-on-surface-variant pt-1">{introOfferWording}</p>}
                <p className="text-xs text-on-surface-variant pt-1">
                  {IS_SANDBOX_TEST_BUILD
                    ? SANDBOX_RENEWAL_TEXT
                    : 'Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period.'}
                </p>
              </>
            )}
          </div>

          {/* Sandbox-test clarity banner (task 3): a prominent, separate
              notice — not just folded into the renewal sentence above —
              with concise, PLATFORM-SPECIFIC "no real charge" wording
              (SANDBOX_BANNER_TEXT, above — see its own header: iOS/
              TestFlight is unconditionally sandboxed, Android depends on
              Play Console License Tester setup this build flag cannot
              establish) plus a concise timing note (trials/renewals here
              run faster than production). Text only: never changes
              entitlement access, never hardcodes a sandbox expiry date.
              Gated on the SAME VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST
              build-time flag codemagic.yaml only sets for
              wakewise-ios-sandbox-test. */}
          {IS_SANDBOX_TEST_BUILD && (
            <p
              role="status"
              className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2 text-center leading-relaxed"
            >
              {SANDBOX_BANNER_TEXT}
            </p>
          )}

          <p className="text-[11px] text-on-surface-variant text-center leading-relaxed px-2">
            By subscribing, you agree to our{' '}
            <Link to="/settings/subscription-terms" className="text-primary font-semibold">Subscription Terms</Link>
            {' '}and{' '}
            <Link to="/settings/refund-policy" className="text-primary font-semibold">Refund Policy</Link>.
          </p>

          <button
            onClick={handleNativePurchase}
            disabled={nativeProductsState !== 'ready' || nativePurchaseState === 'purchasing'}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60"
          >
            {nativePurchaseState === 'purchasing' && 'Purchasing…'}
            {(nativePurchaseState === 'idle' ||
              nativePurchaseState === 'cancelled' ||
              nativePurchaseState === 'failed' ||
              nativePurchaseState === 'identity_not_ready' ||
              nativePurchaseState === 'awaiting-confirmation' ||
              nativePurchaseState === 'confirmation_timeout') &&
              `Subscribe — ${interval === 'monthly' ? 'Monthly' : 'Annual'}`}
          </button>

          {/* Founder offer — its own explicit action, never reachable from
              the ordinary Subscribe button above (readiness-gap item 5).
              Annual only: the founder mechanism only exists on the annual
              product on either platform. */}
          {interval === 'yearly' && (
            <button
              onClick={handleFounderOfferAction}
              disabled={nativeProductsState !== 'ready' || nativePurchaseState === 'purchasing'}
              className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 text-sm"
            >
              Have a founder offer code?
            </button>
          )}

          {nativePurchaseState === 'cancelled' && (
            <p role="status" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
              Purchase cancelled — no changes were made.
            </p>
          )}
          {nativePurchaseState === 'identity_not_ready' && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1 text-center">
              {nativePurchaseError}
            </p>
          )}
          {nativePurchaseState === 'failed' && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1 text-center">
              {nativePurchaseError || "We couldn't complete that purchase."}
            </p>
          )}
          {nativePurchaseState === 'awaiting-confirmation' && (
            <p role="status" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
              Purchase received — we're confirming your subscription. This can take a moment; check back shortly.
            </p>
          )}
          {/* Delayed webhook confirmation recovery (readiness-gap item 4):
              the bounded poll above gave up without confirming access —
              an honest "still don't know" state, never a claim the
              purchase failed. "Check again" simply restarts the same
              bounded wait on demand. */}
          {nativePurchaseState === 'confirmation_timeout' && (
            <div className="space-y-2">
              <p role="alert" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
                We still haven't been able to confirm your subscription. If you were charged, this can take a few
                minutes to finish — try checking again, or contact support with your purchase date if it doesn't
                update.
              </p>
              <button
                onClick={handleCheckConfirmationAgain}
                className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary text-sm"
              >
                Check again
              </button>
            </div>
          )}

          <button
            onClick={handleNativeRestore}
            disabled={nativeRestoreState === 'restoring'}
            className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 text-sm"
          >
            {nativeRestoreState === 'restoring' ? 'Restoring…' : 'Restore Purchases'}
          </button>
          {nativeRestoreState === 'restored' && (
            <p role="status" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
              Restore complete — your subscription status has been refreshed.
            </p>
          )}
          {nativeRestoreState === 'completed' && (
            <p role="status" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
              {NEUTRAL_RESTORE_COMPLETION_MESSAGE}
            </p>
          )}
          {(nativeRestoreState === 'failed' || nativeRestoreState === 'identity_not_ready') && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1 text-center">
              {nativeRestoreError || "We couldn't restore purchases. Please try again."}
            </p>
          )}
        </div>
      )}

      {/* Manage subscription — web/Stripe subscribers only ever see the
          Stripe portal (never on native, where Stripe Checkout/Portal must
          never open). A Stripe subscriber using a native app instead sees
          an informational message plus a link to manage on the web. */}
      {entitlement.managementDestination === 'stripe_portal' && !IS_NATIVE && (
        <div className="space-y-3">
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            {portalLoading ? 'Opening billing management…' : 'Manage subscription'}
          </button>
          {portalError && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1">{portalError}</p>
          )}
        </div>
      )}

      {entitlement.managementDestination === 'stripe_portal' && IS_NATIVE && (
        <p className="text-xs text-on-surface-variant text-center px-1 leading-relaxed">
          You're subscribed via the web. Manage or cancel your subscription at wakewise.com or in a browser — Stripe
          billing management isn't available inside the app.
        </p>
      )}

      {/* Apple-channel Manage Subscription — opens iOS's own OS-level
          subscription screen, correct regardless of whether this
          subscription was purchased via RevenueCat or the legacy
          direct-Apple path. */}
      {IS_NATIVE_IOS && entitlement.managementDestination === 'apple_settings' && (
        <div className="space-y-3">
          <button
            onClick={handleAppleManage}
            disabled={appleManageState === 'opening'}
            className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            {appleManageState === 'opening' ? 'Opening subscription management…' : 'Manage subscription'}
          </button>
          {appleManageState === 'failed' && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1">
              We couldn't open subscription management. Please try again.
            </p>
          )}
        </div>
      )}

      {/* Google-channel Manage Subscription (readiness-gap item 2) —
          Google's own documented deep-link format
          (play.google.com/store/account/subscriptions?sku=...&package=...),
          built from the verified package name and this subscriber's real,
          server-recorded product id (androidManageSubscriptionUrl, above)
          — never a guessed product. Falls back to plain informational
          text only if entitlement.product is somehow unavailable (should
          not happen for a real 'google' provider record, but never
          renders a broken/undefined link). A plain external link, not a
          new native plugin — see androidManageSubscriptionUrl's own
          comment for the un-verified-on-device caveat. */}
      {entitlement.managementDestination === 'google_play' && androidManageSubscriptionUrl && (
        <div className="space-y-2">
          <a
            href={androidManageSubscriptionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary block"
          >
            Manage subscription
          </a>
          <p className="text-[10px] text-on-surface-variant text-center px-1">
            Opens the Subscriptions section of the Google Play Store app.
          </p>
        </div>
      )}
      {entitlement.managementDestination === 'google_play' && !androidManageSubscriptionUrl && (
        <p className="text-xs text-on-surface-variant text-center px-1 leading-relaxed">
          You're subscribed via Google Play. Manage or cancel your subscription from the Subscriptions section of the
          Google Play Store app.
        </p>
      )}

      {plusActive && entitlement.managementDestination === null && (
        <p className="text-xs text-on-surface-variant text-center px-1">
          Your Plus access was granted by an administrator.
        </p>
      )}

      <ConfirmDialog
        open={activeDialog === 'sign-in'}
        title="Sign in required"
        message="Create an account or sign in to upgrade to WakeWise Plus."
        confirmLabel="Sign in"
        cancelLabel="Cancel"
        onConfirm={() => navigate('/auth')}
        onDismiss={() => setActiveDialog(null)}
      />

      {/* Android founder offer is a real purchase — confirmed explicitly
          before it fires, never one accidental tap away (readiness-gap
          item 5). iOS's equivalent is Apple's own OS code-redemption
          sheet, already its own confirmation step — no dialog needed. */}
      <ConfirmDialog
        open={activeDialog === 'founder-confirm'}
        title="Redeem founder offer?"
        message={
          // Explicit-currency founder price (task 1 extension: "every
          // subscription price ... wherever displayed"), from the
          // offer's own REAL discounted phase (googleFounderOfferPrice,
          // above — never fullPricePhase, the standard renewal price a
          // founder offer specifically discounts away from). Falls back
          // to the original, still-correct generic wording if the real
          // price hasn't resolved yet, never a guessed number.
          //
          // This dialog is reachable on Android only (iOS's founder
          // mechanism is Apple's own offer-code sheet — see the comment
          // above), so its sandbox copy states the Android-specific Play
          // Console License Tester caveat directly, rather than the
          // generic "never charged" claim this task found was never true
          // for Android regardless of this app's own build flag.
          IS_SANDBOX_TEST_BUILD
            ? `Sandbox test build — this only avoids a real charge if your Google account is a Play Console License Tester (confirm first). Starts a purchase${googleFounderPriceText ? ` at ${googleFounderPriceText}` : ' at the founder price'} for your first year, renewing at the standard annual price afterward unless you cancel.`
            : googleFounderPriceText
              ? `This starts a real purchase at the founder price (${googleFounderPriceText}) for your first year, renewing at the standard annual price afterward unless you cancel.`
              : 'This starts a real purchase at the founder price for your first year, renewing at the standard annual price afterward unless you cancel.'
        }
        confirmLabel="Redeem"
        cancelLabel="Cancel"
        confirmPending={nativePurchaseState === 'purchasing'}
        onConfirm={confirmGoogleFounderPurchase}
        onDismiss={() => setActiveDialog(null)}
      />
    </div>
  );
};
