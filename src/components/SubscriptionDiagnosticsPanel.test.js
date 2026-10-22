// DEV subscription diagnostics panel (2026-10-23, ST-38 trial
// investigation) — source-level checks (this repo's Vitest has no DOM
// rendering capability; see libraryCategoryNavigation.test.js's own
// header comment for the established precedent).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SubscriptionDiagnosticsPanel.jsx', import.meta.url)), 'utf-8');
// Comments (including this file's own safety-discipline header, which
// names "key"/"token"/"receipt" to explain what it does NOT expose) must
// not trip the no-sensitive-data check below — only real code matters.
const codeOnly = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('gated DEV-only, same as DevBuildIndicator — never renders in a production-backend build', () => {
  it('imports IS_DEV_BACKEND from buildInfo.js and returns null before rendering anything when it is false', () => {
    expect(source).toMatch(/import \{ BUILD_COMMIT, IS_DEV_BACKEND \} from '\.\.\/lib\/buildInfo';/);
    expect(source).toMatch(/if \(!IS_DEV_BACKEND\) return null;/);
  });
});

describe('exposes no key, token, receipt, or personal data', () => {
  it('never references any credential/token/receipt-shaped identifier', () => {
    expect(codeOnly).not.toMatch(/apiKey|API_KEY|token|receipt|password|secret/i);
  });

  it('only ever reads product identifiers, build commit, intro-offer duration, and the literal eligibility string - no price amount, no customer info object', () => {
    expect(source).not.toMatch(/CustomerInfo|customerInfo/);
    expect(source).not.toMatch(/formatExplicitCurrencyAmount|priceString/);
  });
});

describe('UNKNOWN and INELIGIBLE are shown as distinct, literal values - never inferred, never collapsed', () => {
  it('reads the eligibility string directly from the map, with a distinctly-labelled (not "INELIGIBLE") fallback for a missing entry', () => {
    expect(source).toMatch(/introEligibility\?\.\[productId\] \?\? 'no entry returned \(treat as UNKNOWN\)'/);
  });

  it('does not contain any logic that substitutes one status for another (e.g. treating UNKNOWN as INELIGIBLE or vice versa)', () => {
    expect(source).not.toMatch(/=== 'UNKNOWN'[\s\S]{0,40}'INELIGIBLE'/);
    expect(source).not.toMatch(/=== 'INELIGIBLE'[\s\S]{0,40}'UNKNOWN'/);
  });
});

describe('reads only state its caller already fetched - no new network/SDK call of its own', () => {
  it('does not call getOfferings, getPackage, or checkIntroEligibility itself - only the already-exported error-reader', () => {
    expect(source).not.toMatch(/getOfferings\(|getPackage\(|checkIntroEligibility\(/);
    expect(source).toMatch(/import \{ getLastIntroEligibilityError \} from '\.\.\/lib\/revenueCatAdapter';/);
  });
});

describe('mounted on the native paywall, not the entitlement/purchase logic', () => {
  it('Subscription.jsx imports and renders SubscriptionDiagnosticsPanel with the already-fetched package/eligibility state', () => {
    const subscriptionSource = readFileSync(fileURLToPath(new URL('../pages/Subscription.jsx', import.meta.url)), 'utf-8');
    expect(subscriptionSource).toMatch(/import \{ SubscriptionDiagnosticsPanel \} from '\.\.\/components\/SubscriptionDiagnosticsPanel';/);
    expect(subscriptionSource).toMatch(/<SubscriptionDiagnosticsPanel\s*\n\s*monthlyPackage=\{monthlyPackage\}\s*\n\s*annualPackage=\{annualPackage\}\s*\n\s*introEligibility=\{introEligibility\}\s*\n\s*\/>/);
  });
});
