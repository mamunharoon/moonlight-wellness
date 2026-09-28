// Anytime Visual Flow and Closing Handoff uplift (Part 3) — Home.jsx's
// Anytime card. No DOM rendering available in this repo's Vitest -
// source-level checks, matching this codebase's own established
// precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Home.jsx');

const cardBlock = (() => {
  const start = source.indexOf("{activePeriod === 'anytime' && (");
  const end = source.indexOf('6. Active intentions');
  return source.slice(start, end);
})();

describe('Home.jsx — Anytime card, approved concise copy', () => {
  it('the eyebrow renders "ANYTIME RESET" once uppercased by its own CSS class (source case is lowercase-mixed, matching this app\'s established pattern of uppercase via className rather than literal caps)', () => {
    expect(cardBlock).not.toBe('');
    expect(cardBlock).toMatch(/uppercase tracking-wider">\s*\n\s*Anytime Reset/);
  });

  it('the headline is the exact approved "Choose what fits your moment." - the former "Take a moment to reset" + longer paragraph are both gone from the real rendered markup (a doc comment may still mention the old copy in prose, explaining the change)', () => {
    const code = cardBlock.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).toMatch(/Choose what fits your moment\./);
    expect(code).not.toMatch(/Take a moment to reset/);
    expect(code).not.toMatch(/A short guided pause whenever you need one/);
  });

  it('shows an accurate duration range, computed from the same real practice durations AnytimeReset.jsx\'s own QUICK_RESET_ALTERNATIVES already state (Breathe ~1-2 min, Meditate 2/5/10 min, Instant Calm ~2 min) - never an invented figure', () => {
    expect(cardBlock).toMatch(/About 1-10 minutes/);
  });

  it('Start Anytime Reset is preserved exactly - same destination, same label, same primary styling', () => {
    expect(cardBlock).toMatch(/to="\/anytime-reset"/);
    expect(cardBlock).toMatch(/Start Anytime Reset/);
    expect(cardBlock).toMatch(/getJourneyPrimaryActionClasses\('anytime'\)/);
  });
});

describe('Home.jsx — Anytime card, compact visual cues (Breathe/Meditate/Instant Calm/Explore)', () => {
  it('shows all four real practices as compact icon+label cues, in that order, with no directional arrows between them', () => {
    const breatheIdx = cardBlock.indexOf("label: 'Breathe'");
    const meditateIdx = cardBlock.indexOf("label: 'Meditate'");
    const instantCalmIdx = cardBlock.indexOf("label: 'Instant Calm'");
    const exploreIdx = cardBlock.indexOf("label: 'Explore'");
    expect(breatheIdx).toBeGreaterThan(-1);
    expect(meditateIdx).toBeGreaterThan(breatheIdx);
    expect(instantCalmIdx).toBeGreaterThan(meditateIdx);
    expect(exploreIdx).toBeGreaterThan(instantCalmIdx);
    expect(cardBlock).not.toMatch(/arrow_forward|arrow_right|chevron_right/);
  });

  it('the cue row is purely decorative (aria-hidden per cue) with one accessible group label naming all four practices - not four separate competing tap targets duplicating the "Or choose something quick" row below', () => {
    expect(cardBlock).toMatch(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore"/);
    expect(cardBlock).toMatch(/aria-hidden="true"/);
    expect(cardBlock).not.toMatch(/<Link[\s\S]*?Instant Calm/);
  });

  it('every cue icon is a real Material Symbol, never an emoji', () => {
    expect(cardBlock).toMatch(/icon: 'air'/);
    expect(cardBlock).toMatch(/icon: 'self_improvement'/);
    expect(cardBlock).toMatch(/icon: 'bolt'/);
    expect(cardBlock).toMatch(/icon: 'explore'/);
  });

  it('uses only existing mint (tertiary) tokens for the cue icons - no raw hex, no new colour', () => {
    expect(cardBlock).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(cardBlock).toMatch(/bg-tertiary\/15 text-tertiary/);
  });
});

describe('Home.jsx — Anytime card does not duplicate the existing Breathe/Meditate quick-action tiles', () => {
  it('the "Or choose something quick" row below still independently offers Breathe and Meditate as real, tappable Home quick-action tiles - unaffected by this pass', () => {
    expect(source).toMatch(/to="\/breathe-standalone"/);
    expect(source).toMatch(/to="\/self-guided-meditation\?from=home"/);
  });
});
