// useNativeRestore.js — ASC-16/E-113 DEV-only restore-failure diagnostics.
// Captures the SDK's own current App User ID, the expected scoped App
// User ID, the app's own login-readiness snapshot, and a sanitised SDK
// error code - never a credential, receipt, or token, and never visible
// on PROD. Source-level checks, same convention as useNativeRestore.test.js
// (no DOM/renderer available in this Vitest environment).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hookSource = readFileSync(fileURLToPath(new URL('./useNativeRestore.js', import.meta.url)), 'utf-8');
const adapterSource = readFileSync(fileURLToPath(new URL('../lib/revenueCatAdapter.js', import.meta.url)), 'utf-8');

const diagFnBody = () => hookSource.match(/const describeDevRestoreFailure = async \([^)]*\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
const restoreBody = () => hookSource.match(/const restore = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('useNativeRestore — DEV restore-failure diagnostics are gated and wired correctly', () => {
  it('describeDevRestoreFailure returns early (empty string) when not IS_DEV_BACKEND', () => {
    const body = diagFnBody();
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(!IS_DEV_BACKEND\) return '';/);
  });

  it('captures all four required signals: SDK app user id, expected scoped id, identity status snapshot, and the sanitised code', () => {
    const body = diagFnBody();
    expect(body).toMatch(/getRevenueCatAppUserIdForDiagnostics\(\)/);
    expect(body).toMatch(/getExpectedScopedAppUserIdForDiagnostics\(forUserId\)/);
    expect(body).toMatch(/getRevenueCatIdentityStatus\(\)/);
    expect(body).toMatch(/code=\$\{code \|\| 'none'\}/);
  });

  it('both failure branches of restore() append the DEV diagnostic to the on-screen error, after the real outcome handling', () => {
    const body = restoreBody();
    expect(body).toMatch(/outcome === 'receipt_already_in_use'[\s\S]*?describeDevRestoreFailure\(forUserId, result\.code\)/);
    expect(body).toMatch(/That purchase is already linked to a different account\.\$\{diag\}/);
    expect(body).toMatch(/We couldn't restore purchases\. Please try again\."\}\$\{diag\}/);
  });

  it('the diagnostic never reads confirmationInput-style field values, passwords, receipts, or tokens - only ids, a status enum, and a short code', () => {
    const body = diagFnBody();
    expect(body).not.toMatch(/\breceipt\b/i);
    expect(body).not.toMatch(/\btoken\b/i);
    expect(body).not.toMatch(/\bpassword\b/i);
    expect(body).not.toMatch(/\.message\b/);
  });
});

describe('revenueCatAdapter.js — diagnostic helpers never affect the real restore outcome and never leak a receipt/token', () => {
  it('getRevenueCatAppUserIdForDiagnostics only ever returns appUserID or null, never throws', () => {
    const body = adapterSource.match(/export const getRevenueCatAppUserIdForDiagnostics = async \(\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/return appUserID \?\? null;/);
    expect(body).toMatch(/catch \(error\) \{/);
  });

  it('getExpectedScopedAppUserIdForDiagnostics is a pure function reusing the real buildScopedAppUserId, never a separate/drifting computation', () => {
    const body = adapterSource.match(/export const getExpectedScopedAppUserIdForDiagnostics = \([^)]*\) =>[\s\S]*?;/)?.[0] ?? '';
    expect(body).toMatch(/buildScopedAppUserId\(OWN_PROJECT_REF, supabaseUserId\)/);
  });

  it("restoreRevenueCatPurchases' new `code` field is additive - outcome is still the authoritative result, unchanged by this addition", () => {
    const body = adapterSource.match(/export const restoreRevenueCatPurchases = async \(\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).toMatch(/outcome: 'receipt_already_in_use', code:/);
    expect(body).toMatch(/outcome: 'failed', message, code/);
  });
});
