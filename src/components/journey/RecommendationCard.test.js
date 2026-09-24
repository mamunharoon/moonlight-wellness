// Build 15 Phase B — RecommendationCard.jsx regression guard. Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./RecommendationCard.jsx', import.meta.url)), 'utf-8');

describe('RecommendationCard.jsx — shell only, every value and action is a prop', () => {
  it('holds no state and owns no recommendation logic of its own', () => {
    expect(source).not.toMatch(/useState|useEffect/);
  });

  it('title, duration, description and match reason all come from props, never hardcoded copy', () => {
    expect(source).toMatch(/\{title\}/);
    expect(source).toMatch(/\{durationLabel\}/);
    expect(source).toMatch(/\{description\}/);
    expect(source).toMatch(/Why this: \{matchReason\}/);
  });

  it('the "Closest match" badge only renders when the caller says this is a closest match, never invented', () => {
    expect(source).toMatch(/\{isClosestMatch && \(/);
  });
});

describe('RecommendationCard.jsx — Start button: page owns label, busy and disabled state', () => {
  it('startLabel and chooseAnotherLabel are required props (no default value), so each page keeps its own exact copy', () => {
    expect(source).toMatch(/startLabel,/);
    expect(source).not.toMatch(/startLabel = /);
    expect(source).toMatch(/chooseAnotherLabel/);
    expect(source).not.toMatch(/chooseAnotherLabel = /);
  });

  it('startDisabled and startBusy default to false, so a caller that never sets them (Meditate) gets its existing simpler behaviour unchanged', () => {
    expect(source).toMatch(/startDisabled = false/);
    expect(source).toMatch(/startBusy = false/);
  });

  it('the button is wired to disabled={startDisabled} and shows a busy label only when startBusy is true', () => {
    expect(source).toMatch(/disabled=\{startDisabled\}/);
    expect(source).toMatch(/\{startBusy \? 'Checking…' : startLabel\}/);
  });

  it('the Start button carries a visible focus-visible ring', () => {
    expect(source).toMatch(/onClick=\{onStart\}[\s\S]{0,300}focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('"Choose another" only renders when the caller says it should (showChooseAnother), not unconditionally', () => {
    expect(source).toMatch(/\{showChooseAnother && \(/);
    expect(source).toMatch(/onClick=\{onChooseAnother\}/);
  });
});

describe('RecommendationCard.jsx — Anytime Reset Visual Uplift: accent is additive, default keeps Meditate byte-for-byte unchanged', () => {
  it('accent defaults to primary, whose style is undefined - Meditate.jsx (which never passes accent) gets no inline style at all, exactly as before this phase', () => {
    expect(source).toMatch(/accent = 'primary'/);
    expect(source).toMatch(/primary: undefined,/);
  });

  it('the base className (glass-panel rounded-3xl p-5 space-y-3 border-white/10) is unconditional, not accent-gated', () => {
    expect(source).toMatch(/className=\{`glass-panel rounded-3xl p-5 space-y-3 border-white\/10 \$\{CARD_ACCENT_CLASS\[accent\] \?\? ''\}`\}/);
  });

  it('the anytime accent supplies a real mint borderColor via inline style (glass-panel\'s own border shorthand would otherwise silently override a Tailwind border-* class)', () => {
    expect(source).toMatch(/anytime: \{ borderColor: 'rgba\(127, 228, 208, 0\.35\)' \}/);
  });

  it('the anytime accent adds shadow-mint-glow, primary adds no extra class', () => {
    expect(source).toMatch(/primary: '',\s*\n\s*anytime: 'shadow-mint-glow'/);
  });

  it('the Start button className has no accent branching at all - it is always bg-primary, regardless of the card accent', () => {
    const buttonBlock = source.match(/onClick=\{onStart\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(buttonBlock).toMatch(/bg-primary text-on-primary/);
    expect(buttonBlock).not.toMatch(/accent/);
  });
});
