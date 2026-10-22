import { BUILD_COMMIT, IS_DEV_BACKEND } from '../lib/buildInfo';
import { summarizeIntroOffer } from '../lib/trialOfferWording';
import { getLastIntroEligibilityError } from '../lib/revenueCatAdapter';

// DEV-only subscription diagnostic panel (2026-10-23, ST-38 trial
// investigation) — added specifically so "products load but no trial
// offer appears" can be diagnosed without Safari Web Inspector (the owner
// is on Windows, no Mac available). Shows exactly what this app's own
// already-completed RevenueCat calls returned — reads only state
// Subscription.jsx already fetched for its own paywall render, makes no
// new network/SDK call of its own, and changes no purchase/entitlement
// logic. Renders only when IS_DEV_BACKEND is true (same gate as
// DevBuildIndicator) — never in a production-backend build.
//
// Deliberately exposes NO key, token, receipt, or personal data: only a
// build commit (already public, see DevBuildIndicator), RevenueCat's own
// fixed, dashboard-configured product identifiers (not sensitive — same
// discipline as revenueCatAdapter.js's own header), an intro-offer
// duration, and the literal eligibility status string RevenueCat
// returned. UNKNOWN and INELIGIBLE are shown as their own distinct,
// literal values — never collapsed into each other or inferred from
// whether trial wording happened to render.
export const SubscriptionDiagnosticsPanel = ({ monthlyPackage, annualPackage, introEligibility }) => {
  if (!IS_DEV_BACKEND) return null;

  const lastError = getLastIntroEligibilityError();
  const rows = [
    { label: 'Monthly', pkg: monthlyPackage },
    { label: 'Annual', pkg: annualPackage }
  ];

  return (
    <div
      role="status"
      className="glass-panel rounded-2xl p-3 space-y-2 border-amber-400/30 text-[11px] font-mono text-on-surface-variant"
    >
      <p className="text-amber-400 font-bold uppercase tracking-wider text-[10px]">DEV subscription diagnostics</p>
      <p>Build: {BUILD_COMMIT}</p>
      {rows.map(({ label, pkg }) => {
        const productId = pkg?.product?.identifier ?? null;
        const introOffer = pkg?.product?.introPrice
          ? { ...pkg.product.introPrice, currencyCode: pkg.product.currencyCode }
          : null;
        const { hasOffer, durationLabel, isFreeTrial } = summarizeIntroOffer(introOffer);
        // A missing map entry is Apple/RevenueCat's own documented "treat
        // as UNKNOWN" case (see checkIntroEligibility's own header) —
        // labelled distinctly here so it's never misread as a literal
        // "INELIGIBLE" or "not configured" result.
        const eligibility = productId
          ? (introEligibility?.[productId] ?? 'no entry returned (treat as UNKNOWN)')
          : 'product not loaded';
        return (
          <div key={label} className="border-t border-white/10 pt-2 space-y-0.5">
            <p className="text-on-surface font-semibold">{label}</p>
            <p>Product ID: {productId ?? 'not loaded'}</p>
            <p>
              Intro offer:{' '}
              {hasOffer
                ? `${durationLabel ?? '(unrecognised length)'} ${isFreeTrial ? 'free trial' : 'paid intro price'}`
                : 'none configured on this product'}
            </p>
            <p>Eligibility: {eligibility}</p>
          </div>
        );
      })}
      {lastError && (
        <p className="text-red-400 pt-2 border-t border-white/10">Eligibility query error: {lastError}</p>
      )}
    </div>
  );
};
