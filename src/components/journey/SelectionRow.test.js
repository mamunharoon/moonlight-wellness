// Build 15 Phase B — SelectionRow.jsx regression guard. Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SelectionRow.jsx', import.meta.url)), 'utf-8');

describe('SelectionRow.jsx — presentation only, caller owns data/handler', () => {
  it('holds no state', () => {
    expect(source).not.toMatch(/useState|useEffect/);
  });

  it('exposes selection via aria-pressed', () => {
    expect(source).toMatch(/aria-pressed=\{selected\}/);
  });

  it('carries the 44px minimum touch target and a visible focus-visible ring', () => {
    expect(source).toMatch(/min-h-\[44px\]/);
    expect(source).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('the optional description renders only when provided, never an empty line', () => {
    expect(source).toMatch(/\{description && <span/);
  });
});

describe('SelectionRow.jsx — selected state through shape as well as colour', () => {
  it('the trailing icon itself swaps from chevron_right to check_circle on selection - not just a colour change', () => {
    expect(source).toMatch(/\{selected \? 'check_circle' : 'chevron_right'\}/);
  });

  it('selected border/background also changes', () => {
    expect(source).toMatch(/selected \? 'border-primary bg-primary-container\/20' : 'border-white\/10 hover:bg-white\/5'/);
  });
});
