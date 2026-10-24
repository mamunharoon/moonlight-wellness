// Account-deletion confirmation field — physical-iOS keyboard
// investigation, round 3. The prior diagnostic round (8fe0c2a) wired a
// capture-phase pointerdown/touchstart listener onto the field's wrapper
// and onFocus/onBlur directly onto the real input, all firing setState
// synchronously inside the same touch-to-focus call stack iOS WebKit uses
// to decide keyboard visibility - so its one on-device success could not
// be ruled out as a side effect of its own instrumentation. This round's
// own regression guard: none of that wiring may return. Source-level
// checks, same convention as DeleteAccount.immediateDeletion.test.js (no
// DOM rendering available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DeleteAccount.jsx', import.meta.url)), 'utf-8');

const confirmInputBlock = () => {
  const start = source.indexOf('id="confirmPhrase"');
  return source.slice(start, start + 500);
};

const diagnosticsEffectBody = () =>
  source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!IS_DEV_BACKEND \|\| phase !== 'confirm'\)[\s\S]*?\n {2}\}, \[phase\]\);/)?.[0] ?? '';

describe('DeleteAccount.jsx — confirmation field itself carries no new handlers from the diagnostics', () => {
  it('the real confirmation input has no onFocus, onBlur, onPointerDown, or onTouchStart props', () => {
    const block = confirmInputBlock();
    expect(block).not.toMatch(/onFocus/);
    expect(block).not.toMatch(/onBlur/);
    expect(block).not.toMatch(/onPointerDown/);
    expect(block).not.toMatch(/onTouchStart/);
  });

  it('the field is still a normal, always-editable input (no readOnly anywhere in this block)', () => {
    expect(confirmInputBlock()).not.toMatch(/readOnly/);
  });

  it('no wrapping element around the confirm-phase form carries a capture-phase or pointer/touch listener', () => {
    const start = source.indexOf("if (phase === 'confirm' || phase === 'submitting')");
    const end = source.indexOf("if (phase === 'done')");
    const block = source.slice(start, end);
    expect(block).not.toMatch(/Capture=/);
    expect(block).not.toMatch(/onPointerDown=/);
    expect(block).not.toMatch(/onTouchStart=/);
  });
});

describe('DeleteAccount.jsx — diagnostics observe from outside the touch/focus call stack', () => {
  it('the diagnostics effect is gated on IS_DEV_BACKEND and only runs during the confirm phase', () => {
    const body = diagnosticsEffectBody();
    expect(body).not.toBe('');
  });

  it('focus is sampled via a polling interval reading document.activeElement, never via an event handler', () => {
    const body = diagnosticsEffectBody();
    expect(body).toMatch(/window\.setInterval\(/);
    expect(body).toMatch(/document\.activeElement\?\.id === 'confirmPhrase'/);
  });

  it('keyboard visibility is sampled via visualViewport resize, an independent browser signal', () => {
    const body = diagnosticsEffectBody();
    expect(body).toMatch(/window\.visualViewport/);
    expect(body).toMatch(/addEventListener\('resize', onViewportResize\)/);
  });

  it('both listeners are torn down on cleanup', () => {
    const body = diagnosticsEffectBody();
    expect(body).toMatch(/removeEventListener\('resize', onViewportResize\)/);
    expect(body).toMatch(/window\.clearInterval\(pollId\)/);
  });
});

describe('DeleteAccount.jsx — diagnostics never log a value, password, or session data', () => {
  it('pushDiagEvent calls never pass confirmationInput, password, or user data as an argument', () => {
    const calls = source.match(/pushDiagEvent\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).not.toMatch(/confirmationInput(?!\.length)/);
      expect(call).not.toMatch(/\bpassword\b/);
      expect(call).not.toMatch(/\buser\b/);
    }
  });

  it('the entry signal logs only the typed length, from the existing onChange handler', () => {
    const start = source.indexOf('const handleConfirmationChange');
    const block = source.slice(start, start + 600);
    expect(block).toMatch(/pushDiagEvent\('entry', `length \$\{next\.length\}`\)/);
  });

  it('the on-screen readout is absent on PROD (gated on IS_DEV_BACKEND, same convention as DevBuildIndicator)', () => {
    const confirmStart = source.indexOf("if (phase === 'confirm' || phase === 'submitting')");
    const doneStart = source.indexOf("if (phase === 'done')");
    const block = source.slice(confirmStart, doneStart);
    expect(block).toMatch(/\{IS_DEV_BACKEND && \(/);
  });
});
