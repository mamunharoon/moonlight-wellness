/* eslint-disable no-unused-vars */
// WakeWise Phase 2B — DEV-only RevenueCat purchase/restore sandbox test
// surface (readiness-gap item 6).
//
// PURPOSE: lets a real device (Apple sandbox tester / Google license
// tester) exercise configureRevenueCat/logIn/getPackage/purchasePackage/
// restoreRevenueCatPurchases/getRevenueCatEntitlementSnapshot end-to-end
// against a real RevenueCat sandbox, so Task 4's sandbox test plan can
// actually be run — without wiring any of this into the real purchase UI
// (Subscription.jsx is completely untouched by this file) and without
// changing what any user can access: this page calls the SAME adapter
// functions revenueCatAdapter.js already exposes, and — exactly like
// every one of those functions' own documented discipline — a 'purchased'
// or 'restored' outcome shown here is NEVER treated as entitlement by
// this app; entitlements.js/canUseAudio and friends are not imported,
// read, or affected by anything on this page.
//
// HOW THIS STAYS OUT OF PRODUCTION (two independent layers, not one):
//   1. Reachability: this route is registered in App.jsx exactly like the
//      existing SessionEnginePreview/SessionRegistryPreview debug routes
//      (unlinked from any nav menu — reachable only by typing the exact
//      URL). That alone is the same protection those two pages already
//      rely on, and by itself would NOT be enough here, because this page
//      calls a real purchase SDK.
//   2. Build-time kill switch: every control on this page additionally
//      requires import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST to
//      be the literal string 'true'. Vite inlines import.meta.env values
//      at BUILD time, not runtime — so a build where this var is unset
//      (every build codemagic.yaml's existing "WakeWise iOS TestFlight"
//      workflow produces today; grep that file, the var is not present)
//      compiles this check to a permanent `false`, and the page renders
//      only the "not available in this build" message below, calling
//      nothing. To actually use this page, the var must be set at BUILD
//      time — either a local `vite build`/`npm run dev` with a
//      `.env.local` override (never distributed via TestFlight/the App
//      Store), or a Codemagic run explicitly intended as internal-QA-only.
//      Whenever a real App-Store-bound release workflow is created, this
//      variable must never be added to its environment.
// EXPLICIT-SELECTION ENFORCEMENT (readiness-gap review): this page's own
// annual-purchase control does NOT call purchasePackage()/rely on
// RevenueCat's Android defaultOption for the annual product — that is
// inspection-only via describeDefaultAnnualSelection() below, never what
// this page actually purchases. The tester explicitly picks an intended
// tier ('base' | 'trial' | 'founder') from the selector, and
// purchaseGoogleAnnualTierExplicit() (revenueCatAdapter.js) resolves that
// EXACT SubscriptionOption and REJECTS (purchases nothing, reports
// {outcome:'mismatch'|'not_found'}) if it cannot structurally verify the
// resolved option matches the intended tier — see that function's own
// header for why this is enforcement, not just the inspection
// describeDefaultAnnualSelection() alone provides. iOS has no equivalent
// risk (Apple's founder mechanism is offer-code redemption, a completely
// separate call, never a package purchase) so purchasePackage() is used
// directly there.
import { useState } from 'react';
import { isAndroid } from '../lib/platform';
import {
  isRevenueCatSupported,
  isRevenueCatConfiguredThisSession,
  getPackage,
  describeDefaultAnnualSelection,
  purchasePackage,
  purchaseGoogleAnnualTierExplicit,
  getAppleFounderOfferModel,
  redeemAppleFounderOfferCode,
  getGoogleFounderOfferModel,
  getGoogleFounderSubscriptionOption,
  restoreRevenueCatPurchases,
  getRevenueCatEntitlementSnapshot
} from '../lib/revenueCatAdapter';

const SANDBOX_TEST_ENABLED = import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST === 'true';

const Row = ({ label, onRun, result }) => (
  <div style={{ borderBottom: '1px solid #333', padding: '12px 0' }}>
    <button type="button" onClick={onRun} style={{ marginBottom: 8 }}>{label}</button>
    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#111', color: '#0f0', padding: 8 }}>
      {result === undefined ? '(not run yet)' : JSON.stringify(result, null, 2)}
    </pre>
  </div>
);

const SandboxTestPanel = () => {
  const [results, setResults] = useState({});
  const [annualPackage, setAnnualPackage] = useState(null);
  const [intendedTier, setIntendedTier] = useState('base');

  const run = (key, fn) => async () => {
    try {
      const value = await fn();
      if (key === 'getAnnualPackage') setAnnualPackage(value);
      setResults((prev) => ({ ...prev, [key]: value }));
    } catch (error) {
      setResults((prev) => ({ ...prev, [key]: { threw: error?.message ?? 'unknown error' } }));
    }
  };

  const purchaseAnnualPlatformSafe = async () => {
    if (isAndroid()) {
      // NEVER purchasePackage()/defaultOption here — explicit resolution +
      // rejection-on-mismatch only. See this file's own header.
      if (!annualPackage) return { outcome: 'unavailable', reason: 'call "Get annual package" first' };
      return purchaseGoogleAnnualTierExplicit(annualPackage, intendedTier);
    }
    // iOS: no defaultOption ambiguity — a plain package purchase is safe.
    // The founder tier on iOS is never purchased this way at all (offer-
    // code redemption instead, its own button below); requesting
    // intendedTier 'founder'/'trial' here on iOS is a test-harness misuse,
    // not a real selection this platform offers — reported, not silently
    // purchased as something else.
    if (intendedTier !== 'base') {
      return { outcome: 'unavailable', reason: 'iOS annual purchase is always the base product — founder/trial are offer-code/RevenueCat-managed, not selected here' };
    }
    return purchasePackage(annualPackage ?? (await getPackage('annual')));
  };

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h1>RevenueCat sandbox test surface (DEV only)</h1>
      <p>
        isRevenueCatSupported: {String(isRevenueCatSupported())} · isRevenueCatConfiguredThisSession:{' '}
        {String(isRevenueCatConfiguredThisSession())}
      </p>
      <p style={{ color: '#c60' }}>
        Configure/logIn already happen automatically on sign-in via App.jsx's RevenueCatIdentityHandler —
        this page never calls configureRevenueCat/logInRevenueCat itself, so identity is always the real
        signed-in Supabase user, exactly like the real app.
      </p>

      <Row label="Get monthly package" onRun={run('getMonthlyPackage', () => getPackage('monthly'))} result={results.getMonthlyPackage} />
      <Row label="Get annual package" onRun={run('getAnnualPackage', () => getPackage('annual'))} result={results.getAnnualPackage} />
      <Row
        label="Describe default annual selection (read-only diagnostic only — the purchase button below never uses this)"
        onRun={run('describeDefaultAnnualSelection', () => describeDefaultAnnualSelection(annualPackage))}
        result={results.describeDefaultAnnualSelection}
      />
      <Row
        label="Purchase monthly package"
        onRun={run('purchaseMonthly', async () => purchasePackage(await getPackage('monthly')))}
        result={results.purchaseMonthly}
      />

      <div style={{ borderBottom: '1px solid #333', padding: '12px 0' }}>
        <label>
          Intended annual tier (explicitly selected — never auto-chosen):{' '}
          <select value={intendedTier} onChange={(event) => setIntendedTier(event.target.value)}>
            <option value="base">base (ordinary, no offer)</option>
            <option value="trial">trial (annual-trial-7-days)</option>
            <option value="founder">founder (founder-first-year)</option>
          </select>
        </label>
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={run('purchaseAnnualExplicit', purchaseAnnualPlatformSafe)}>
            Purchase annual — explicit tier (rejects on mismatch, never relies on defaultOption)
          </button>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#111', color: '#0f0', padding: 8, marginTop: 8 }}>
          {results.purchaseAnnualExplicit === undefined ? '(not run yet)' : JSON.stringify(results.purchaseAnnualExplicit, null, 2)}
        </pre>
      </div>

      <Row label="Get Apple founder offer model" onRun={run('appleFounderModel', () => getAppleFounderOfferModel())} result={results.appleFounderModel} />
      <Row label="Redeem Apple founder offer code (presents OS sheet)" onRun={run('redeemAppleFounder', () => redeemAppleFounderOfferCode())} result={results.redeemAppleFounder} />
      <Row label="Get Google founder offer model" onRun={run('googleFounderModel', () => getGoogleFounderOfferModel())} result={results.googleFounderModel} />
      <Row
        label="Get Google founder subscription option (read-only inspection — does not purchase)"
        onRun={run('googleFounderOption', () => getGoogleFounderSubscriptionOption())}
        result={results.googleFounderOption}
      />
      <Row label="Restore purchases" onRun={run('restore', () => restoreRevenueCatPurchases())} result={results.restore} />
      <Row
        label="Get RevenueCat entitlement snapshot (client-side only — never the real access decision)"
        onRun={run('snapshot', () => getRevenueCatEntitlementSnapshot())}
        result={results.snapshot}
      />
    </div>
  );
};

export const SubscriptionSandboxTest = () => {
  if (!SANDBOX_TEST_ENABLED) {
    return <div style={{ padding: 16 }}>Not available in this build.</div>;
  }
  return <SandboxTestPanel />;
};
