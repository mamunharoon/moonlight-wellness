// Account-deletion confirmation field — iOS keyboard fix. Found live on
// PROD (owner report + screenshots, 24-Oct-2026): the field accepted
// focus (visible focus ring) but the on-screen keyboard never appeared,
// making it look permanently disabled. Source-level checks, same
// convention as DeleteAccount.immediateDeletion.test.js (no DOM
// rendering available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DeleteAccount.jsx', import.meta.url)), 'utf-8');

describe('DeleteAccount.jsx — confirmation-phrase field re-focuses once writable (iOS keyboard fix)', () => {
  it('a ref is declared and attached to the real confirmation input, not a second, parallel element', () => {
    expect(source).toMatch(/const confirmFieldRef = useRef\(null\);/);
    expect(source).toMatch(/id="confirmPhrase"\s*\n\s*ref=\{confirmFieldRef\}/);
  });

  it('an effect re-focuses the field once confirmFieldReady actually commits - not inside the onFocus handler itself, which is too early for iOS to reconsider keyboard visibility against the new (post-render) readOnly state', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!confirmFieldReady\) return;[\s\S]*?\n {2}\}, \[confirmFieldReady\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/el\.focus\(\);/);
  });

  it('the re-focus is guarded by document.activeElement, so it can never steal focus from somewhere else the user has already moved to', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!confirmFieldReady\) return;[\s\S]*?\n {2}\}, \[confirmFieldReady\]\);/)?.[0] ?? '';
    expect(effectBody).toMatch(/document\.activeElement === el/);
  });

  it('the onFocus handler itself is unchanged - still only sets confirmFieldReady, the actual readOnly-removal mechanism Chrome-autofill protection relies on is untouched by this fix', () => {
    expect(source).toMatch(/onFocus=\{\(\) => setConfirmFieldReady\(true\)\}/);
    expect(source).toMatch(/readOnly=\{!confirmFieldReady\}/);
  });

  it('the password reauth field on the earlier step is unaffected - this fix is scoped to the confirmation-phrase field only, never the real password input', () => {
    const reauthInputBlock = source.slice(source.indexOf('id="reauthPassword"'), source.indexOf('id="reauthPassword"') + 400);
    expect(reauthInputBlock).not.toMatch(/confirmFieldRef|confirmFieldReady/);
  });
});
