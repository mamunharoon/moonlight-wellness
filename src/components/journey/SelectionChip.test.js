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
  it('selected fill/border colour changes (default primary accent)', () => {
    expect(source).toMatch(/selected: 'bg-primary-container\/25 border-primary shadow-md shadow-primary\/10'/);
  });

  it('selected font-weight changes (font-bold), not just colour', () => {
    expect(source).toMatch(/label: 'text-primary font-bold'/);
    expect(source).toMatch(/\$\{selected \? tokens\.label : 'text-on-surface font-semibold'\}/);
  });

  it('selected state adds a real check_circle glyph, a shape change independent of colour perception', () => {
    expect(source).toMatch(/\{selected && \(/);
    expect(source).toMatch(/check_circle/);
  });
});

describe('SelectionChip.jsx — Anytime Reset Visual Uplift: accent is additive, default keeps every existing caller byte-for-byte unchanged', () => {
  it('accent defaults to primary - Meditate.jsx/ChangeIntention.jsx (neither passes accent) resolve the exact original peach tokens', () => {
    expect(source).toMatch(/accent = 'primary'/);
    expect(source).toMatch(/const tokens = CHIP_ACCENT\[accent\] \?\? CHIP_ACCENT\.primary;/);
  });

  it('the anytime accent swaps selected fill/border/check/icon/label to real mint tokens, only ever reached when a caller explicitly passes accent="anytime"', () => {
    expect(source).toMatch(/anytime: \{\s*\n\s*selected: 'bg-tertiary-tint\/20 border-tertiary shadow-md shadow-tertiary-tint\/20',\s*\n\s*badge: 'bg-tertiary text-on-tertiary',\s*\n\s*check: 'text-tertiary',\s*\n\s*icon: 'text-tertiary',\s*\n\s*label: 'text-tertiary font-bold'\s*\n\s*\}/);
  });

  // WakeWise Phase 2 (guided intention ladder).
  it('the morning accent swaps selected fill/border/check/icon/label to the already-approved morning-accent gold tokens, only ever reached when a caller explicitly passes accent="morning"', () => {
    expect(source).toMatch(/morning: \{\s*\n\s*selected: 'bg-morning-accent\/15 border-morning-accent shadow-md shadow-morning-accent\/10',\s*\n\s*badge: 'bg-morning-accent text-on-morning-accent',\s*\n\s*check: 'text-morning-accent',\s*\n\s*icon: 'text-morning-accent',\s*\n\s*label: 'text-morning-accent font-bold'\s*\n\s*\}/);
  });

  it('the unselected state is not part of the accent map at all - it stays the exact same glass-panel/on-surface-variant classes for every accent', () => {
    expect(source).toMatch(/: 'glass-panel border-white\/5 text-on-surface-variant hover:bg-white\/10'/);
    expect(source).not.toMatch(/CHIP_ACCENT\.[a-z]+\.unselected/);
  });
});

describe('SelectionChip.jsx — Build 15 Phase B remediation: roleLabel/large are additive, opt-in, and never affect the two existing callers (Anytime Reset/Meditate never pass either)', () => {
  it('roleLabel only renders when truthy - a caller that never passes it (every existing usage) renders no extra badge at all', () => {
    expect(source).toMatch(/\{roleLabel && \(/);
  });

  it('the role badge is a distinct, differently-positioned pill from the selected checkmark, so the two can never visually collide', () => {
    expect(source).toMatch(/absolute -top-2 left-1\/2 -translate-x-1\/2[\s\S]{0,200}\{roleLabel\}/);
    expect(source).toMatch(/absolute top-1\.5 right-1\.5[\s\S]{0,200}check_circle/);
  });

  it('large defaults to false, so every existing call site (no `large` prop passed) keeps the exact original compact p-4/min-h-[44px]/text-xs sizing', () => {
    expect(source).toMatch(/large = false/);
    expect(source).toMatch(/large \? 'p-5 min-h-\[72px\]' : 'p-4 min-h-\[44px\]'/);
    expect(source).toMatch(/\$\{large \? 'text-sm' : 'text-xs'\}/);
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
