// WakeWise Phase 1 correction — the Settings "Reduced motion" switch's own
// visible pill measured 48x28px (w-12 h-7), under the 44px tap-target
// minimum on its shorter axis - the real interactive <button> WAS that
// pill, with no larger surrounding hit area. Source-level regression guard,
// matching this repo's established convention (see
// musicPreferenceToggleTapTarget.test.js's own note) - no DOM rendering is
// available in this repo's Vitest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Settings.jsx', import.meta.url)), 'utf-8');

describe('Settings.jsx — Reduced motion switch: real <button> is a 44px+ tap target; the visible pill stays exactly 48x28', () => {
  const buttonBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*role="switch"\s*\n\s*aria-checked=\{reducedMotion\}[\s\S]*?\n {12}<\/button>/)?.[0] ?? '';

  it('locates the Reduced motion switch button block', () => {
    expect(buttonBlock).not.toBe('');
  });

  it('the real <button> no longer carries w-12 h-7 itself - that sizing moved to a decorative inner span', () => {
    const openTagEnd = buttonBlock.indexOf('>');
    const buttonOwnAttrs = buttonBlock.slice(0, openTagEnd);
    expect(buttonOwnAttrs).not.toMatch(/w-12 h-7/);
  });

  it('the button grows its own real tap box via symmetric py-2 padding (28 + 8 + 8 = 44px), matched by a -my-2 negative margin so the row\'s layout height is unaffected', () => {
    expect(buttonBlock).toMatch(/className="shrink-0 rounded-full -my-2 py-2 focus-visible:ring-2/);
  });

  it('the visible pill itself is still exactly w-12 h-7 (48x28px) - "do not make the visual switch disproportionately large" - and is purely decorative (aria-hidden)', () => {
    expect(buttonBlock).toMatch(/<span\s*\n\s*aria-hidden="true"\s*\n\s*className=\{`block w-12 h-7 rounded-full transition-colors relative/);
  });

  it('role="switch"/aria-checked/aria-label/onClick and the on/off colour + knob translate logic are all preserved verbatim on the real button, just relocated', () => {
    expect(buttonBlock).toMatch(/role="switch"/);
    expect(buttonBlock).toMatch(/aria-checked=\{reducedMotion\}/);
    expect(buttonBlock).toMatch(/aria-label="Reduced motion"/);
    expect(buttonBlock).toMatch(/onClick=\{handleToggleReducedMotion\}/);
    expect(buttonBlock).toMatch(/reducedMotion \? 'bg-primary' : 'bg-white\/10'/);
    expect(buttonBlock).toMatch(/reducedMotion \? 'translate-x-5' : 'translate-x-0'/);
  });
});
