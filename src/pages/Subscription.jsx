import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { isSubscribed } from '../lib/entitlements';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getSubscriptionOverride } from '../lib/subscriptionOverride';
import { startCheckout, openBillingPortal } from '../lib/stripeApi';
import {
  annualEffectiveMonthly,
  annualSavingsPercent,
  formatAnnualPrice,
  formatMonthlyPrice,
  trialDisclosureText
} from '../lib/pricingConfig';
import {
  APPLE_PRODUCT_IDS,
  isAppleIAPSupported,
  getAppleProducts,
  purchaseAppleProduct,
  restoreApplePurchases,
  openAppleManageSubscriptions,
  addAppleTransactionUpdateListener
} from '../lib/applePurchaseAdapter';
import { verifyAppleTransaction } from '../lib/appleVerificationApi';

// Platform behaviour (Apple Subscription Architecture task, Phase B):
// computed once — the platform an app is running on never changes
// within a session, so this is a plain module-scope constant, not
// component state. iOS native build: Apple IAP only, Stripe checkout/
// portal hidden entirely below. Web build: Stripe only, unchanged. An
// existing active Stripe subscriber still sees their real entitlement on
// iOS (the "Current plan"/status sections below read subscription from
// SubscriptionContext exactly the same way on every platform) — they
// just don't see a Stripe purchase or portal CTA there.
const IS_NATIVE_IOS = isAppleIAPSupported();

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
const STATUS_LABELS = { trial: 'Trial', active: 'Active', cancelled: 'Cancelled', expired: 'Expired' };
// Status explanations shown under the status row — what each state
// actually means and, where relevant, what to do about it. A failed
// renewal payment is not a distinct stored status here (see
// supabase/functions/_shared/planMapping.ts's mapStripeStatus — Stripe's
// own "past_due" is deliberately folded into "active" as a short grace
// period, and "unpaid"/"incomplete" fold into "expired"), so payment
// failures surface to the user as one of these two existing states
// rather than a dedicated "payment failed" screen.
const STATUS_EXPLANATIONS = {
  trial: 'Your free trial is active. You will not be charged until it ends unless you cancel first.',
  active: "Your subscription is active and will renew automatically unless you cancel. If a recent payment failed, we're still retrying it — you keep access in the meantime.",
  cancelled: 'Your subscription is cancelled. Depending on your billing provider, you may keep access until the end of your current paid period.',
  expired: 'Your subscription has ended, including after repeated failed payments. Subscribe again any time to restore Plus access.'
};
const INTERVAL_LABELS = { monthly: 'Monthly', yearly: 'Yearly' };

const formatRenewalDate = (subscription) => {
  if (subscription.plan === 'free' || !subscription.expires_at) return 'No renewal date';
  return new Date(subscription.expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const Subscription = () => {
  const navigate = useNavigate();
  const { isGuest, user } = useAuth();
  const { subscription, loading, error, refreshSubscription } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-in' | null
  const [interval, setInterval_] = useState('monthly'); // 'monthly' | 'yearly'
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);
  const [banner, setBanner] = useState(null); // 'success' | 'cancelled' | null
  const devOverride = getSubscriptionOverride();

  // Apple Subscription Architecture task, Phase B — native purchase
  // state. Entirely inert on web (every setter below is only ever
  // reached from native-gated effects/handlers).
  const [appleProducts, setAppleProducts] = useState({});
  const [appleProductsState, setAppleProductsState] = useState(IS_NATIVE_IOS ? 'loading' : 'idle'); // 'idle'|'loading'|'ready'|'unavailable'
  const [applePurchaseState, setApplePurchaseState] = useState('idle'); // 'idle'|'purchasing'|'verifying'|'awaiting-confirmation'|'cancelled'|'failed'
  const [applePurchaseError, setApplePurchaseError] = useState(null);
  const [appleRestoreState, setAppleRestoreState] = useState('idle'); // 'idle'|'restoring'|'restored'|'failed'
  const [appleManageState, setAppleManageState] = useState('idle'); // 'idle'|'opening'|'failed'

  // Never grants access from a client-side purchase/restore callback —
  // this only ever sends the transaction to the server (Phase C's
  // verify-apple-transaction, currently a fail-closed stub — see
  // docs/apple-subscription-implementation.md) and then re-reads real
  // entitlement state from Supabase via refreshSubscription(), exactly
  // like the existing Stripe return-from-checkout flow already does.
  const handleAppleTransactionResult = async (result) => {
    if (result.outcome === 'cancelled') {
      setApplePurchaseState('cancelled');
      return;
    }
    if (result.outcome === 'unavailable') {
      setApplePurchaseState('failed');
      setApplePurchaseError('In-app purchases are not available right now.');
      return;
    }
    if (result.outcome === 'failed') {
      setApplePurchaseState('failed');
      setApplePurchaseError(result.message || "We couldn't complete that purchase. Please try again.");
      return;
    }
    if (result.outcome === 'purchased') {
      setApplePurchaseState('verifying');
      try {
        await verifyAppleTransaction({
          transactionId: result.transactionId,
          productIdentifier: result.productIdentifier,
          jwsRepresentation: result.jwsRepresentation
        });
      } catch (e) {
        console.warn('[Subscription] Apple transaction verification call failed', e?.message);
      }
      // Whether or not verification above actually confirmed anything
      // (in this phase it never does — see the stub's own file header),
      // the only source of truth for whether the user has access is a
      // fresh read of their real subscription state, never this
      // callback's own outcome.
      await refreshSubscription();
      setApplePurchaseState('awaiting-confirmation');
    }
  };

  useEffect(() => {
    if (!IS_NATIVE_IOS) return undefined;

    let ignore = false;
    getAppleProducts().then((products) => {
      if (ignore) return;
      setAppleProducts(products);
      setAppleProductsState(Object.keys(products).length > 0 ? 'ready' : 'unavailable');
    });

    const removeListener = addAppleTransactionUpdateListener((result) => {
      handleAppleTransactionResult(result);
    });

    return () => {
      ignore = true;
      removeListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplePurchase = async () => {
    if (isGuest) {
      setActiveDialog('sign-in');
      return;
    }
    setApplePurchaseState('purchasing');
    setApplePurchaseError(null);
    const productIdentifier = interval === 'monthly' ? APPLE_PRODUCT_IDS.monthly : APPLE_PRODUCT_IDS.annual;
    const result = await purchaseAppleProduct(productIdentifier, { appAccountToken: user?.id });
    await handleAppleTransactionResult(result);
  };

  const handleAppleRestore = async () => {
    setAppleRestoreState('restoring');
    const result = await restoreApplePurchases();
    if (result.outcome === 'restored') {
      await refreshSubscription();
      setAppleRestoreState('restored');
    } else {
      setAppleRestoreState('failed');
    }
  };

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

  const plusActive = isSubscribed(subscription.plan, subscription.status);

  const handleUpgradeClick = () => {
    if (isGuest) {
      setActiveDialog('sign-in');
      return;
    }
    startCheckoutFlow();
  };

  const startCheckoutFlow = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      await startCheckout(interval);
      // On success this redirects the browser via window.location.href
      // and never returns control here.
    } catch (e) {
      console.error('Error starting checkout:', e.message);
      setCheckoutError("We couldn't start checkout. Please try again.");
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
        <button
          onClick={() => navigate('/settings')}
          aria-label="Back to Settings"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
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

      {/* Current plan */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Current plan</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Current plan</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : PLAN_LABELS[subscription.plan] ?? subscription.plan}
            </span>
          </div>
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Status</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          </div>
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Renewal date</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : formatRenewalDate(subscription)}
            </span>
          </div>
        </div>
        {!loading && STATUS_EXPLANATIONS[subscription.status] && (
          <p className="text-xs text-on-surface-variant px-1 leading-relaxed">{STATUS_EXPLANATIONS[subscription.status]}</p>
        )}
        {error && (
          <p role="alert" className="text-[10px] text-red-400 font-medium px-1">{error}</p>
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

      {/* Actions — native iOS: Apple In-App Purchase only, never Stripe.
          Web: Stripe only, unchanged from before this task. */}
      {!plusActive && !IS_NATIVE_IOS && (
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
                Approximately {`AUD $${annualEffectiveMonthly().toFixed(2)}`} per month — save approximately {annualSavingsPercent()}% compared with monthly billing.
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

      {!plusActive && IS_NATIVE_IOS && (
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
            {appleProductsState === 'loading' && (
              <p className="text-sm text-on-surface-variant">Loading prices from the App Store…</p>
            )}
            {appleProductsState === 'unavailable' && (
              <p className="text-sm text-on-surface-variant">
                We couldn't load App Store pricing right now. Please try again shortly.
              </p>
            )}
            {appleProductsState === 'ready' && (
              <>
                {/* Never a hard-coded price on iOS — always the exact,
                    localised string StoreKit itself returned. */}
                <p className="text-lg font-bold text-on-surface">
                  {interval === 'monthly'
                    ? appleProducts[APPLE_PRODUCT_IDS.monthly]?.priceString ?? '—'
                    : appleProducts[APPLE_PRODUCT_IDS.annual]?.priceString ?? '—'}
                </p>
                <p className="text-xs text-on-surface-variant pt-1">
                  A free trial or introductory offer may be available — the App Store will show your exact eligibility
                  and terms before you're charged. Subscriptions renew automatically unless cancelled at least 24 hours
                  before the end of the current period.
                </p>
              </>
            )}
          </div>

          <p className="text-[11px] text-on-surface-variant text-center leading-relaxed px-2">
            By subscribing, you agree to our{' '}
            <Link to="/settings/subscription-terms" className="text-primary font-semibold">Subscription Terms</Link>
            {' '}and{' '}
            <Link to="/settings/refund-policy" className="text-primary font-semibold">Refund Policy</Link>.
          </p>

          <button
            onClick={handleApplePurchase}
            disabled={appleProductsState !== 'ready' || applePurchaseState === 'purchasing' || applePurchaseState === 'verifying'}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60"
          >
            {applePurchaseState === 'purchasing' && 'Purchasing…'}
            {applePurchaseState === 'verifying' && 'Confirming your subscription…'}
            {(applePurchaseState === 'idle' || applePurchaseState === 'cancelled' || applePurchaseState === 'failed' || applePurchaseState === 'awaiting-confirmation') &&
              `Subscribe with Apple — ${interval === 'monthly' ? 'Monthly' : 'Annual'}`}
          </button>

          {applePurchaseState === 'cancelled' && (
            <p role="status" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
              Purchase cancelled — no changes were made.
            </p>
          )}
          {applePurchaseState === 'failed' && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1 text-center">
              {applePurchaseError || "We couldn't complete that purchase."}
            </p>
          )}
          {applePurchaseState === 'awaiting-confirmation' && (
            <p role="status" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
              Purchase received — we're confirming your subscription. This can take a moment; check back shortly, or
              contact support if it doesn't update.
            </p>
          )}

          <button
            onClick={handleAppleRestore}
            disabled={appleRestoreState === 'restoring'}
            className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 text-sm"
          >
            {appleRestoreState === 'restoring' ? 'Restoring…' : 'Restore Purchases'}
          </button>
          {appleRestoreState === 'restored' && (
            <p role="status" className="text-[10px] text-on-surface-variant font-medium px-1 text-center">
              Restore complete — refreshing your subscription status.
            </p>
          )}
          {appleRestoreState === 'failed' && (
            <p role="alert" className="text-[10px] text-red-400 font-medium px-1 text-center">
              We couldn't restore purchases. Please try again.
            </p>
          )}
        </div>
      )}

      {/* Manage subscription — web/Stripe subscribers only ever see the
          Stripe portal (never on iOS, where Stripe Checkout/Portal must
          never open). A Stripe subscriber using the iOS app instead sees
          an informational message plus a link to manage on the web. */}
      {subscription.provider === 'stripe' && !IS_NATIVE_IOS && (
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

      {subscription.provider === 'stripe' && IS_NATIVE_IOS && (
        <p className="text-xs text-on-surface-variant text-center px-1 leading-relaxed">
          You're subscribed via the web. Manage or cancel your subscription at wakewise.com or in a browser — Stripe
          billing management isn't available inside the iOS app.
        </p>
      )}

      {/* Apple-channel Manage Subscription — not reachable in this
          phase (see docs/apple-subscription-implementation.md: no live
          Apple entitlement can exist yet), included so this UI is
          already correct once a future task's server verification goes
          live and subscription.provider can genuinely be 'apple'. */}
      {IS_NATIVE_IOS && subscription.provider === 'apple' && (
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

      {plusActive && subscription.provider !== 'stripe' && subscription.provider !== 'apple' && (
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
    </div>
  );
};
