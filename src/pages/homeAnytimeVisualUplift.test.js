// Anytime Visual Flow and Closing Handoff uplift (Part 3) — Home.jsx's
// Anytime card. No DOM rendering available in this repo's Vitest -
// source-level checks, matching this codebase's own established
// precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JOURNEY_STAGE_ICONS } from '../session/journeyIcons';

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
  it('shows all four real practices as compact icon+label cues, in that order', () => {
    const breatheIdx = cardBlock.indexOf("label: 'Breathe'");
    const meditateIdx = cardBlock.indexOf("label: 'Meditate'");
    const instantCalmIdx = cardBlock.indexOf("label: 'Instant Calm'");
    const exploreIdx = cardBlock.indexOf("label: 'Explore'");
    expect(breatheIdx).toBeGreaterThan(-1);
    expect(meditateIdx).toBeGreaterThan(breatheIdx);
    expect(instantCalmIdx).toBeGreaterThan(meditateIdx);
    expect(exploreIdx).toBeGreaterThan(instantCalmIdx);
  });

  // Phase 9 — Truthful Journey Outcomes (Part 6b) explicitly reverses
  // Phase 8's own "no directional arrows" decision for this row: three
  // small decorative connectors now sit between the four cues, using the
  // shared JourneyConnector (a real line + arrowhead) every other pathway
  // (MorningJourneyPathway.jsx/EveningJourneyPathway.jsx/AnytimePathway.jsx)
  // already renders — a physical-iPhone correction replaced the original
  // isolated chevron_right glyph, which had no visible connecting line.
  it('renders one connector between every adjacent pair of cues (idx < cues.length - 1), which - since the four cues are rendered via .map() - resolves at runtime to exactly 3 connectors: one fewer than the number of cues, never one before the first or after the last', () => {
    expect(cardBlock).toMatch(/\{idx < cues\.length - 1 && \(/);
    expect(cardBlock).toMatch(/<JourneyConnector journeyTone="anytime" className="mt-\[12\.5px\]" \/>/);
    expect(cardBlock).not.toMatch(/chevron_right/);
  });

  it('the connectors are purely decorative and never a tap target - aria-hidden (via JourneyConnector itself and the enclosing per-cue span), not wrapped in a <Link>/<button>', () => {
    const connectorBlock = cardBlock.match(/<JourneyConnector journeyTone="anytime" className="mt-\[12\.5px\]" \/>/)?.[0] ?? '';
    expect(connectorBlock).not.toBe('');
    expect(connectorBlock).not.toMatch(/<Link|<button|onClick/);
  });

  it('the connectors never carry a completed/skipped/current outcome badge - these four cues remain example choices, never mandatory sequential stages (no StageOutcomeBadge/status semantics anywhere in this row)', () => {
    expect(cardBlock).not.toMatch(/StageOutcomeBadge|stage\.status|isFullyCompleted/);
  });

  it('the cue row is purely decorative (aria-hidden per cue, including each connector) with one accessible group label naming all four practices - not four separate competing tap targets duplicating the "Or choose something quick" row below', () => {
    expect(cardBlock).toMatch(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore"/);
    expect(cardBlock).toMatch(/aria-hidden="true"/);
    expect(cardBlock).not.toMatch(/<Link[\s\S]*?Instant Calm/);
  });

  it('every cue icon is sourced from the shared canonical JOURNEY_STAGE_ICONS mapping, never a locally hardcoded Material Symbol', () => {
    expect(cardBlock).toMatch(/icon: JOURNEY_STAGE_ICONS\.breathe/);
    expect(cardBlock).toMatch(/icon: JOURNEY_STAGE_ICONS\.meditate/);
    expect(cardBlock).toMatch(/icon: JOURNEY_STAGE_ICONS\.instantCalm/);
    expect(cardBlock).toMatch(/icon: JOURNEY_STAGE_ICONS\.explore/);
  });

  it('the canonical mapping resolves the original real Material Symbol values for these cues - air/self_improvement/bolt/explore, unchanged by the refactor to a shared source', () => {
    expect(JOURNEY_STAGE_ICONS.breathe).toBe('air');
    expect(JOURNEY_STAGE_ICONS.meditate).toBe('self_improvement');
    expect(JOURNEY_STAGE_ICONS.instantCalm).toBe('bolt');
    expect(JOURNEY_STAGE_ICONS.explore).toBe('explore');
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
