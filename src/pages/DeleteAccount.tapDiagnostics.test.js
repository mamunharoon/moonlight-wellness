// DEV-only tap/focus diagnostics for the confirmation-phrase field
// (physical-iOS keyboard investigation, B61/B62). Added to answer three
// questions a real device can show that static code reading can't: does
// a tap on this field actually reach it (vs. some other element
// intercepting it), does it gain focus, and does it immediately lose
// focus. Source-level checks, same convention as this file's siblings
// (no DOM rendering available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DeleteAccount.jsx', import.meta.url)), 'utf-8');

describe('DeleteAccount.jsx — tap/focus diagnostics are DEV-only and never touch PROD', () => {
  it('every diagnostic listener is gated behind IS_DEV_BACKEND, undefined (no listener at all) otherwise', () => {
    expect(source).toMatch(/onPointerDownCapture=\{IS_DEV_BACKEND \? \(e\) => logTapDiagnostic\('pointerdown', e\.target\) : undefined\}/);
    expect(source).toMatch(/onTouchStartCapture=\{IS_DEV_BACKEND \? \(e\) => logTapDiagnostic\('touchstart', e\.target\) : undefined\}/);
    expect(source).toMatch(/onFocus=\{IS_DEV_BACKEND \? \(e\) => logTapDiagnostic\('focus', e\.target\) : undefined\}/);
    expect(source).toMatch(/onBlur=\{IS_DEV_BACKEND \? \(e\) => logTapDiagnostic\('blur', e\.target\) : undefined\}/);
  });

  it('the visible diagnostic panel only renders when IS_DEV_BACKEND is true', () => {
    expect(source).toMatch(/\{IS_DEV_BACKEND && \(/);
    expect(source).toMatch(/DEV diag — confirmPhrase tap\/focus log/);
  });

  it('IS_DEV_BACKEND is imported from buildInfo.js, the same flag DevBuildIndicator already uses to stay DEV-only', () => {
    expect(source).toMatch(/import \{ IS_DEV_BACKEND \} from '\.\.\/lib\/buildInfo';/);
  });
});

describe('DeleteAccount.jsx — the diagnostic log never records a field value, password, or session data', () => {
  const logFnBody = () => {
    const start = source.indexOf('const logTapDiagnostic');
    // Fixed generous length rather than searching for the next "};" —
    // the function body itself contains an earlier "};" (the `entry`
    // object literal statement), which would truncate the slice short
    // of the function's real end.
    return source.slice(start, start + 500);
  };

  it('logTapDiagnostic never reads .value, password, or confirmationInput', () => {
    const body = logFnBody();
    expect(body).not.toMatch(/\.value/);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/confirmationInput/);
  });

  it('describeDiagTarget only reads tagName/id/className, never a form value', () => {
    const start = source.indexOf('const describeDiagTarget');
    const end = source.indexOf('};', start);
    const body = source.slice(start, end);
    expect(body).toMatch(/tagName/);
    expect(body).not.toMatch(/\.value/);
  });

  it('the only DOM state captured for a logged target is disabled/readOnly booleans, scoped to the real confirmPhrase input by id', () => {
    const body = logFnBody();
    expect(body).toMatch(/node\.id === 'confirmPhrase'/);
    expect(body).toMatch(/entry\.disabled = node\.disabled;/);
    expect(body).toMatch(/entry\.readOnly = node\.readOnly;/);
  });

  it('nothing in the diagnostic path calls console.log/console.error or makes a network request — it only ever calls setTapDiagnostics (in-memory React state, rendered on-screen)', () => {
    const body = logFnBody();
    expect(body).not.toMatch(/console\.(log|error|warn|info)/);
    expect(body).not.toMatch(/fetch\(|supabase\./);
    expect(body).toMatch(/setTapDiagnostics/);
  });
});

describe('DeleteAccount.jsx — diagnostics do not affect validation, reauthentication, or the deletion call chain', () => {
  it('phraseMatches and the submit button gating are unaffected', () => {
    expect(source).toMatch(/const phraseMatches = confirmationInput === CONFIRMATION_PHRASE;/);
    expect(source).toMatch(/disabled=\{!phraseMatches\}/);
  });

  it('handleConfirmationChange and handleSubmit are unchanged by this addition', () => {
    expect(source).toMatch(/if \(password && next === password\) return;/);
    expect(source).toMatch(/await deleteAccountNow\(\{ password, confirmationPhrase: confirmationInput \}\);/);
  });
});
