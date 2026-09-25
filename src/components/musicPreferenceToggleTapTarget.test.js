// Acceptance-audit correction (Decision 2) — MusicPreferenceToggle's real
// switch measured a 48x28px tap box (w-12 h-7), under the 44px minimum on
// its shorter axis. Source-level regression guard, matching this repo's
// established convention (see musicPreferenceToggleContrast.test.js's own
// note) - no DOM rendering is available in this repo's Vitest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MusicPreferenceToggle.jsx', import.meta.url)), 'utf-8');

describe('MusicPreferenceToggle — real <button> is a 44px+ tap target; the visible pill stays exactly 48x28', () => {
  it('the real <button> no longer carries w-12 h-7 itself - that sizing moved to a decorative inner span', () => {
    const buttonBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*role="switch"[\s\S]*?\n {8}\/>\s*\n {6}<\/button>/)?.[0]
      ?? source.match(/<button[\s\S]*?<\/button>/)?.[0]
      ?? '';
    expect(buttonBlock).not.toBe('');
    const openTagEnd = buttonBlock.indexOf('>');
    const buttonOwnAttrs = buttonBlock.slice(0, openTagEnd);
    expect(buttonOwnAttrs).not.toMatch(/w-12 h-7/);
  });

  it('the button grows its own real tap box via symmetric py-2 padding (28 + 8 + 8 = 44px)', () => {
    expect(source).toMatch(/className=\{`shrink-0 rounded-full -my-2 py-2 focus-visible:ring-2/);
  });

  it('a matching -my-2 negative margin cancels the added padding, so the surrounding row\'s own layout height is unaffected', () => {
    expect(source).toMatch(/-my-2 py-2/);
  });

  it('the visible pill itself is still exactly w-12 h-7 (48x28px) - "do not make the visual switch disproportionately large"', () => {
    expect(source).toMatch(/className=\{`block w-12 h-7 rounded-full transition-colors relative/);
  });

  it('the pill is purely decorative (aria-hidden) - the real <button> is still what role="switch"/aria-checked/onClick live on', () => {
    const pillBlock = source.match(/<span\s*\n\s*aria-hidden="true"\s*\n\s*className=\{`block w-12 h-7[\s\S]*?\n {10}<\/span>\s*\n {8}<\/button>/)?.[0] ?? '';
    expect(pillBlock).not.toBe('');
    expect(source).toMatch(/role="switch"/);
    expect(source).toMatch(/aria-checked=\{isOn\}/);
    expect(source).toMatch(/onClick=\{onToggle\}/);
  });

  it('aria-label={label} still gives the switch a correct, complete accessible name - unaffected by the restructure', () => {
    expect(source).toMatch(/aria-label=\{label\}/);
  });

  it('the on/off track colour logic (tokens.track vs bg-outline) and knob translate/border logic are preserved verbatim, just relocated onto the inner spans', () => {
    expect(source).toMatch(/isOn \? tokens\.track : 'bg-outline'/);
    expect(source).toMatch(/isOn \? 'translate-x-5' : 'translate-x-0'/);
    expect(source).toMatch(/bg-surface-container-lowest border \$\{tokens\.knobBorder\}/);
  });
});
