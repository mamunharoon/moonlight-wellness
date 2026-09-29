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

  // Anytime visual-choice uplift (Part 2) - the honest "About 1-10 minutes"
  // duration line is removed entirely per this pass's own explicit
  // instruction; the four tiles below already make the real practice
  // durations legible without a separate summary line.
  it('no longer shows a separate "About 1-10 minutes" duration line', () => {
    const code = cardBlock.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/About 1-10 minutes/);
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

  // Anytime visual-choice uplift (Part 2) — reverses Phase 9's own
  // "reintroduce connectors" decision for this row specifically: these
  // four cues are independent alternatives, never a required order, so a
  // connector implying a sequence between them was always misleading. Zero
  // connectors now (not replaced with ">" markers either) - a real,
  // equally-sized tile grid using the same strong visual language
  // MorningJourneyPathway.jsx/EveningJourneyPathway.jsx already established
  // for Morning/Evening's own genuinely sequential pathway.
  it('renders a real grid of four equally-sized tiles (grid-cols-4), with zero connectors of any kind between them', () => {
    expect(cardBlock).toMatch(/grid grid-cols-4 gap-1/);
    expect(cardBlock).not.toMatch(/idx < cues\.length - 1/);
    expect(cardBlock).not.toMatch(/<JourneyConnector/);
    expect(cardBlock).not.toMatch(/chevron_right/);
  });

  it('each tile is a bordered, rounded-2xl mint tile with a large, clamp-scaled icon (never clipped or tiny from 320-430px) and a wrapping, non-truncated label', () => {
    expect(cardBlock).toMatch(/rounded-2xl border border-tertiary-tint\/25 bg-tertiary-tint\/5/);
    expect(cardBlock).toMatch(/width: 'clamp\(/);
    expect(cardBlock).toMatch(/fontSize: 'clamp\(/);
    expect(cardBlock).toMatch(/text-xs leading-tight text-center break-words/);
  });

  it('each tile is purely decorative and never a tap target - aria-hidden, not wrapped in a <Link>/<button> (the grid itself, not the "Start Anytime Reset" CTA that follows it in the same card)', () => {
    expect(cardBlock).toMatch(/<div key=\{cue\.label\} className="min-w-0" aria-hidden="true">/);
    const gridBlock = cardBlock.match(/<div className="grid grid-cols-4 gap-1"[\s\S]*?\n {10}<\/div>/)?.[0] ?? '';
    expect(gridBlock).not.toBe('');
    expect(gridBlock).not.toMatch(/<Link|<button|onClick/);
  });

  it('the tiles never carry a completed/skipped/current outcome badge - these four remain example choices, never mandatory sequential stages (no StageOutcomeBadge/status semantics anywhere in this row)', () => {
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
