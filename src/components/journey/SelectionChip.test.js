// Build 15 Phase B — SelectionChip.jsx regression guard. Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SelectionChip.jsx', import.meta.url)), 'utf-8');

describe('SelectionChip.jsx — presentation only, caller owns data/handler', () => {
  it('holds no state - selection is entirely driven by the `selected` prop, click entirely by `onClick`', () => {
    expect(source).not.toMatch(/useState|useEffect/);
  });

  it('exposes selection via aria-pressed, matching the real WAI-ARIA pattern for a toggle button', () => {
    expect(source).toMatch(/aria-pressed=\{selected\}/);
  });

  it('carries the 44px minimum touch target', () => {
    expect(source).toMatch(/min-h-\[44px\]/);
  });

  it('carries a visible focus-visible ring', () => {
    expect(source).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });
});

describe('SelectionChip.jsx — selected state through 4 channels, never colour alone', () => {
  it('selected fill/border colour changes', () => {
    expect(source).toMatch(/selected\s*\n\s*\? 'bg-primary-container\/25 border-primary/);
  });

  it('selected font-weight changes (font-bold), not just colour', () => {
    expect(source).toMatch(/selected \? 'text-primary font-bold' : 'text-on-surface font-semibold'/);
  });

  it('selected state adds a real check_circle glyph, a shape change independent of colour perception', () => {
    expect(source).toMatch(/\{selected && \(/);
    expect(source).toMatch(/check_circle/);
  });
});

describe('SelectionChip.jsx — icons are Material Symbols, never emoji', () => {
  it('the icon prop renders through material-symbols-outlined, and the icon itself is aria-hidden (decorative only - the label is the real accessible content)', () => {
    expect(source).toMatch(/material-symbols-outlined text-xl[\s\S]{0,100}aria-hidden="true"/);
  });

  it('no emoji literal appears anywhere in this file (typographic punctuation in prose comments, e.g. em-dash, is not an emoji and is excluded)', () => {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    // eslint-disable-next-line no-control-regex
    const hasNonAscii = /[^\x00-\x7F]/.test(withoutComments.replace(/[’…—–“”‘]/g, ''));
    expect(hasNonAscii).toBe(false);
  });
});
