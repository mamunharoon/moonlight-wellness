// Context-aware Meditation/Breathing theming consistency audit —
// PrepareToggleRow.jsx (Evening's Prepare for Rest checklist). Source-
// level regression guard (no DOM rendering in this repo's Vitest - see
// signOutIsolation.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./PrepareToggleRow.jsx', import.meta.url)), 'utf-8');

describe('PrepareToggleRow — the opacity-on-plain-hex-var bug, fixed', () => {
  it('never applies a /<n> opacity modifier directly to the plain-hex evening-accent token - only the alpha-safe -tint RGB-triplet token', () => {
    expect(source).not.toMatch(/'bg-evening-accent\/\d/);
    expect(source).not.toMatch(/border-evening-accent\/\d/);
    expect(source).toMatch(/bg-evening-accent-tint\/10/);
    expect(source).toMatch(/border-evening-accent-tint\/55/);
  });

  it('the selected border and switch track/knob still use the solid evening-accent token (no modifier needed there)', () => {
    expect(source).toMatch(/border-evening-accent shadow-\[inset/);
    expect(source).toMatch(/selected \? 'bg-evening-accent' : 'bg-evening-track-off'/);
  });
});

describe('PrepareToggleRow — the row icon is periwinkle, not generic peach', () => {
  it('uses text-evening-accent for the icon, matching every other selected-state colour on this same row (title, border, switch)', () => {
    expect(source).toMatch(/text-evening-accent text-2xl shrink-0/);
    expect(source).not.toMatch(/text-primary text-2xl shrink-0/);
  });
});

describe('PrepareToggleRow — focus ring is tone-consistent', () => {
  it('uses focus-visible:ring-evening-accent, not the generic peach ring-primary', () => {
    expect(source).toMatch(/focus-visible:ring-2 focus-visible:ring-evening-accent/);
  });
});

describe('PrepareToggleRow — everything not touched by this audit stays exactly as approved', () => {
  it('a real switch (role="switch"/aria-checked), never a checkbox or radio - multi-select semantics unchanged', () => {
    expect(source).toMatch(/role="switch"/);
    expect(source).toMatch(/aria-checked=\{selected\}/);
  });

  it('selected title text is bold evening-accent, unselected stays neutral - unchanged', () => {
    expect(source).toMatch(/selected \? 'text-evening-accent font-bold' : 'text-on-surface font-medium'/);
  });

  it('the knob still slides via translate-x, dark navy fill with an evening-accent ring - unchanged', () => {
    expect(source).toMatch(/selected \? 'translate-x-5' : 'translate-x-0'/);
    expect(source).toMatch(/bg-surface-container-lowest border border-evening-accent/);
  });

  it('the 56px minimum touch target is unchanged', () => {
    expect(source).toMatch(/min-h-\[56px\]/);
  });
});
