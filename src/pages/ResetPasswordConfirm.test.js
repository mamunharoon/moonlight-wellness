// Click-to-confirm reset landing page — structural/regression tests.
//
// Source-level check, same convention as ResetPassword.nativeRecoveryRace.test.js /
// ResetPassword.passwordPolicy.test.js (no DOM rendering available in this
// repo's Vitest — environment: 'node', see vite.config.js).
//
// The property this page exists to guarantee — "loading the confirmation
// page leaves the token unused" — is proven two ways:
//   1. Behaviorally, against the real parse function: calling it (what a
//      mount/render does) never touches supabase.auth.verifyOtp — see
//      resetPasswordConfirm.test.js's own "never calls ... parsing is
//      pure" case, which this suite re-confirms isn't bypassed by this
//      file's wiring.
//   2. Structurally here: confirmPasswordReset (the only function that
//      calls verifyOtp) appears nowhere except inside handleContinue,
//      which itself is wired only to the button's onClick — never to a
//      useEffect/useMemo/render-time call.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ResetPasswordConfirm.jsx', import.meta.url)), 'utf-8');

const handleContinueBody = () =>
  source.match(/const handleContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('ResetPasswordConfirm — token is never redeemed on mount, only on an explicit tap', () => {
  it('parseResetConfirmParams runs at mount time (useMemo, keyed on location.search) — pure, no Supabase call', () => {
    expect(source).toMatch(/const params = useMemo\(\(\) => parseResetConfirmParams\(location\.search\), \[location\.search\]\);/);
  });

  it('the initial status is derived synchronously from params alone — never starts "confirming"', () => {
    expect(source).toMatch(/useState\(\(\) => \(params \? 'ready' : 'invalid'\)\)/);
  });

  it('confirmPasswordReset (the only function that calls verifyOtp) is invoked only inside handleContinue', () => {
    const callSites = source.split('confirmPasswordReset(').length - 1;
    // Exactly one actual call — the "confirmPasswordReset" identifier may
    // also appear in the import and doc comment, but "confirmPasswordReset("
    // (an invocation) must appear exactly once, inside handleContinue.
    expect(callSites).toBe(1);
    expect(handleContinueBody()).toMatch(/const ok = await confirmPasswordReset\(params\);/);
  });

  it('there is no useEffect/useMemo/top-level call to confirmPasswordReset — only handleContinue calls it', () => {
    const outsideHandleContinue = source.replace(handleContinueBody(), '');
    expect(outsideHandleContinue).not.toMatch(/confirmPasswordReset\(/);
  });

  it('handleContinue is a no-op unless status is already "ready" — a second tap while confirming cannot re-redeem', () => {
    expect(handleContinueBody()).toMatch(/if \(status !== 'ready' \|\| !params\) return;/);
  });

  it('the Continue button is disabled while confirming, preventing a double-tap double-call', () => {
    expect(source).toMatch(/disabled=\{status === 'confirming'\}/);
  });
});

describe('ResetPasswordConfirm — explicit confirmation hands off to the existing password form', () => {
  it('on a successful verify, navigates to /reset-password with the same recoveryVerified state the native flow uses', () => {
    expect(handleContinueBody()).toMatch(
      /navigate\('\/reset-password', \{ replace: true, state: \{ recoveryVerified: true \} \}\);/
    );
  });

  it('on a failed verify, falls back to the invalid state instead of navigating anywhere', () => {
    const body = handleContinueBody();
    const okCheckIndex = body.indexOf("if (ok) {");
    const invalidSetIndex = body.indexOf("setStatus('invalid');");
    expect(okCheckIndex).toBeGreaterThan(-1);
    expect(invalidSetIndex).toBeGreaterThan(okCheckIndex);
  });

  it('an invalid/missing link shows the same "invalid or expired" messaging as /reset-password, never a half-built form', () => {
    expect(source).toMatch(/This reset link is invalid or has expired\. Please request a new one\./);
  });
});
