// Account-deletion confirmation field — iOS keyboard fix, take 2. The
// readOnly-until-focus mechanism (plus a re-focus-on-ready useEffect) was
// found NOT to open the on-screen keyboard on real iOS hardware (owner
// report, DEV B61, 24-Oct-2026) despite passing its own source-level
// tests — this file's own prior version. Replaced entirely: the real
// field is now a normal, always-editable input from first render (no
// readOnly toggle, no ref, no re-focus effect), so nothing iOS-specific
// happens to it. Chrome-autofill protection is now provided by a pair of
// off-screen decoy username/password fields ahead of the real one in the
// form, instead of the field's own readOnly state. Source-level checks,
// same convention as DeleteAccount.immediateDeletion.test.js (no DOM
// rendering available in this repo's Vitest) — note per owner instruction:
// these checks confirm the code's SHAPE only; they are not, on their own,
// evidence that the keyboard actually opens on a real device.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DeleteAccount.jsx', import.meta.url)), 'utf-8');

const confirmInputBlock = () => {
  const start = source.indexOf('id="confirmPhrase"');
  return source.slice(start, start + 600);
};

describe('DeleteAccount.jsx — confirmation-phrase field is always editable (no readOnly toggle)', () => {
  it('the real confirmation input is never readOnly, and any onFocus present is DEV-diagnostic-only, never a readiness gate', () => {
    const block = confirmInputBlock();
    expect(block).not.toMatch(/readOnly/);
    // onFocus/onBlur may exist for the DEV-only tap diagnostics (see the
    // dedicated diagnostics test file) but must never toggle a
    // readiness/readOnly state the way the old mechanism did.
    expect(block).not.toMatch(/setConfirmFieldReady/);
  });

  it('the old readOnly-until-focus state, ref, and re-focus effect are entirely gone', () => {
    expect(source).not.toMatch(/confirmFieldReady/);
    expect(source).not.toMatch(/confirmFieldRef/);
  });

  it('the real field keeps its other protections: autoComplete off, no autocapitalize/correct/spellcheck, paste blocked', () => {
    const block = confirmInputBlock();
    expect(block).toMatch(/autoComplete="off"/);
    expect(block).toMatch(/autoCapitalize="off"/);
    expect(block).toMatch(/autoCorrect="off"/);
    expect(block).toMatch(/spellCheck=\{false\}/);
    expect(block).toMatch(/onPaste=\{\(e\) => e\.preventDefault\(\)\}/);
  });
});

describe('DeleteAccount.jsx — autofill decoy fields absorb Chrome\'s password-autofill offer instead', () => {
  const decoyBlock = () => {
    const start = source.indexOf('Autofill decoy');
    const end = source.indexOf('id="confirmPhrase"');
    return source.slice(start, end);
  };

  it('a decoy username and a decoy current-password field exist, ahead of the real confirmation field in the form', () => {
    const block = decoyBlock();
    expect(block).toMatch(/autoComplete="username"/);
    expect(block).toMatch(/autoComplete="current-password"/);
    const confirmIndex = source.indexOf('id="confirmPhrase"');
    const decoyIndex = source.indexOf('Autofill decoy');
    expect(decoyIndex).toBeGreaterThan(-1);
    expect(decoyIndex).toBeLessThan(confirmIndex);
  });

  it('the decoys are unreachable by keyboard navigation and hidden from assistive tech', () => {
    const block = decoyBlock();
    expect(block).toMatch(/tabIndex=\{-1\}/);
    expect(block).toMatch(/aria-hidden="true"/);
  });

  it('the decoys are positioned off-screen via layout, not display:none/visibility:hidden (which Chrome\'s autofill heuristic skips as targets)', () => {
    const block = decoyBlock();
    const styleAttr = block.match(/style=\{\{[^}]*\}\}/)?.[0] ?? '';
    expect(styleAttr).not.toBe('');
    expect(styleAttr).not.toMatch(/display:\s*['"]?none/);
    expect(styleAttr).not.toMatch(/visibility:\s*['"]?hidden/);
    expect(styleAttr).toMatch(/position:\s*'absolute'/);
  });
});

describe('DeleteAccount.jsx — exact-phrase validation and deletion safeguards are unaffected by this fix', () => {
  it('phraseMatches still compares the raw input to CONFIRMATION_PHRASE, and gates the submit button', () => {
    expect(source).toMatch(/const phraseMatches = confirmationInput === CONFIRMATION_PHRASE;/);
    expect(source).toMatch(/disabled=\{!phraseMatches\}/);
  });

  it('handleConfirmationChange still guards against the real password landing in this field', () => {
    const start = source.indexOf('const handleConfirmationChange');
    const block = source.slice(start, start + 300);
    expect(block).toMatch(/if \(password && next === password\) return;/);
  });

  it('the password reauth field on the earlier step is unaffected - this fix is scoped to the confirmation-phrase field only, never the real password input', () => {
    const reauthInputBlock = source.slice(source.indexOf('id="reauthPassword"'), source.indexOf('id="reauthPassword"') + 400);
    expect(reauthInputBlock).not.toMatch(/confirmFieldRef|confirmFieldReady/);
  });
});
