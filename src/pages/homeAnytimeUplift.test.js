// Anytime Reset Visual Uplift (Phase 2, approved decisions A/B) —
// regression guard for Home.jsx's Today's Rhythm Anytime pill/card.
// Source-level checks, matching this codebase's established pattern.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const homeSource = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

describe('Home.jsx — Anytime rhythm pill is mint only when Anytime is active (decision A)', () => {
  const anytimeTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('anytime'\)\}[\s\S]{0,600}/)?.[0] ?? '';

  it('the active-state ternary resolves to real tertiary/on-tertiary tokens, never the generic primary peach (Home Visual Uplift: shadow-sm -> shadow-mint-glow, the existing named mint glow)', () => {
    expect(anytimeTab).toMatch(/activePeriod === 'anytime'\s*\n\s*\? 'bg-tertiary text-on-tertiary border-tertiary shadow-mint-glow'/);
  });

  it('the inactive state is unchanged - the same neutral bg-white/5 treatment every tab shares when not selected', () => {
    expect(anytimeTab).toMatch(/: 'bg-white\/5 text-on-surface-variant\/60 border-transparent hover:bg-white\/10'/);
  });

  it('the focus-visible ring matches the mint identity', () => {
    expect(anytimeTab).toMatch(/focus-visible:ring-2 focus-visible:ring-tertiary/);
  });
});

describe('Home.jsx — Morning and Evening rhythm pills are untouched by the Anytime mint change', () => {
  it('Morning stays gold (morning-accent), Evening stays periwinkle (evening-accent) - unaffected by the Anytime edit', () => {
    expect(homeSource).toMatch(/bg-morning-accent text-on-morning-accent border-morning-accent shadow-morning-glow/);
    expect(homeSource).toMatch(/bg-evening-accent text-on-evening-accent border-evening-accent shadow-evening-glow/);
    expect(homeSource).toMatch(/focus-visible:ring-2 focus-visible:ring-morning-accent/);
    expect(homeSource).toMatch(/focus-visible:ring-2 focus-visible:ring-evening-accent/);
  });
});

describe('Home.jsx — Anytime detail card uses mint accents with an unchanged peach CTA (decision B)', () => {
  const anytimeStart = homeSource.indexOf("{activePeriod === 'anytime' && (");
  const anytimeEnd = homeSource.indexOf('{/* 6. Active intentions', anytimeStart);
  const anytimeBlock = anytimeStart > -1 && anytimeEnd > -1 ? homeSource.slice(anytimeStart, anytimeEnd) : '';

  it('the card block was found', () => {
    expect(anytimeBlock.length).toBeGreaterThan(0);
  });

  it('the container carries a mint border and shadow-mint-glow, via the alpha-safe tertiary-tint token (not a broken tertiary/NN opacity class)', () => {
    expect(anytimeBlock).toMatch(/border-tertiary-tint\/40 shadow-mint-glow/);
  });

  it('the card background reuses the new tertiary-tint token, no longer Morning\'s own morning-tint', () => {
    expect(anytimeBlock).toMatch(/backgroundColor: 'rgb\(var\(--color-tertiary-tint\) \/ 0\.05\)'/);
    expect(anytimeBlock).not.toMatch(/--color-morning-tint/);
  });

  it('the "Available anytime" badge is mint, via tertiary-tint for its opacity-modified fill/border and plain tertiary for its (unmodified) text colour', () => {
    expect(anytimeBlock).toMatch(/bg-tertiary-tint\/15 border border-tertiary-tint\/30 text-tertiary/);
  });

  // WakeWise DEV — journey-aware primary action colour: the later
  // approved journey-colour pass explicitly reversed this phase's own
  // original "the peach CTA stays untouched" decision - "Start Anytime
  // Reset" now resolves to the shared journey-action helper with
  // journey='anytime' (bg-tertiary text-on-tertiary), matching the same
  // mint identity as the rest of this card.
  it('the "Start Anytime Reset" CTA resolves to the shared journey-action helper with journey=\'anytime\' (mint, not peach)', () => {
    expect(anytimeBlock).toMatch(/getJourneyPrimaryActionClasses\('anytime'\)/);
    expect(anytimeBlock).not.toMatch(/bg-primary text-on-primary/);
  });

  it('copy, navigation, and the honest "Available anytime" framing are unchanged - no completion state introduced', () => {
    expect(anytimeBlock).toMatch(/Available anytime/);
    expect(anytimeBlock).toMatch(/Take a moment to reset/);
    expect(anytimeBlock).toMatch(/to="\/anytime-reset"/);
    expect(anytimeBlock).not.toMatch(/anytimeCardState|anytimeCompletionKey|getAnytimeCompletionKey/);
  });
});

describe('Home.jsx — Morning and Evening detail cards are untouched by the Anytime mint change', () => {
  it('Morning\'s own cards keep border-morning-accent/shadow-morning-glow, Evening\'s keep border-evening-accent/shadow-evening-glow', () => {
    expect(homeSource).toMatch(/border-morning-accent\/30 shadow-morning-glow/);
    expect(homeSource).toMatch(/border-evening-accent\/25 shadow-evening-glow/);
  });
});
