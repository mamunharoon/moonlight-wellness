// Build 15 — "Today's Rhythm" three-card selector (Morning/Anytime/
// Evening) regression guard. Complements Home.greeting.test.js (selector
// wiring/styling), Home.touchTargets.test.js (44px+ hit areas), and
// anytimeResetHomeEntry.test.js (Anytime's own routing). Source-level
// checks only - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const homeSource = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

const selectorBlock = (() => {
  const start = homeSource.indexOf('{/* 1. Build 15 — "Today\'s Rhythm" selector.');
  const end = homeSource.indexOf('Build 10 remediation', start);
  return start > -1 && end > -1 ? homeSource.slice(start, end) : '';
})();

describe('Today\'s Rhythm — all three cards always render together', () => {
  it('the selector block was found and contains three role="tab" buttons, none conditionally rendered', () => {
    expect(selectorBlock.length).toBeGreaterThan(0);
    const tabButtons = selectorBlock.match(/role="tab"/g) ?? [];
    expect(tabButtons).toHaveLength(3);
    // None of the three tab buttons sit behind a guard like
    // {someCondition && (<button role="tab" ...) - they are always
    // present, only their aria-selected/visual state ever changes.
    expect(selectorBlock).not.toMatch(/&&\s*\(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*role="tab"/);
  });

  it('the eyebrow heading reads "Today\'s Rhythm", a neutral label - never a numeric completion count or streak', () => {
    expect(selectorBlock).toMatch(/Today's Rhythm/);
    // "Step N of M" is legitimate, pre-existing routine-progress copy
    // used elsewhere in this file (resolveStepLabel) - the fabrication
    // this guards against is a completion COUNT like "3 of 7 days", which
    // never existed here and must not be introduced by this selector.
    expect(selectorBlock).not.toMatch(/\d+ of \d+ (routines|days|rituals|sessions)/);
    expect(selectorBlock).not.toMatch(/[Ss]treak/);
  });
});

describe('Today\'s Rhythm — selecting a card only changes state, never navigates', () => {
  it('all three onClick handlers call setSelectedPeriod, none call navigate directly', () => {
    const clickHandlers = [...selectorBlock.matchAll(/onClick=\{([^}]+)\}/g)].map((m) => m[1]);
    expect(clickHandlers.length).toBe(3);
    for (const handler of clickHandlers) {
      expect(handler).toMatch(/^\(\) => setSelectedPeriod\('(morning|anytime|evening)'\)$/);
    }
  });
});

describe('Today\'s Rhythm — default selection prioritizes an active routine over the clock', () => {
  it('defaultPeriod checks morningCardState/eveningCardState === "in-progress" before any timeState branch', () => {
    const defaultPeriodBody = homeSource.match(/const defaultPeriod = \(\(\) => \{([\s\S]*?)\}\)\(\);/)?.[1] ?? '';
    const inProgressMorningIdx = defaultPeriodBody.indexOf("morningCardState === 'in-progress'");
    const inProgressEveningIdx = defaultPeriodBody.indexOf("eveningCardState === 'in-progress'");
    const firstTimeStateIdx = defaultPeriodBody.indexOf('timeState ===');
    expect(inProgressMorningIdx).toBeGreaterThanOrEqual(0);
    expect(inProgressEveningIdx).toBeGreaterThanOrEqual(0);
    expect(firstTimeStateIdx).toBeGreaterThan(inProgressEveningIdx);
  });

  it('a completed Morning during morning hours defers the default to Anytime rather than re-suggesting a finished routine', () => {
    const defaultPeriodBody = homeSource.match(/const defaultPeriod = \(\(\) => \{([\s\S]*?)\}\)\(\);/)?.[1] ?? '';
    expect(defaultPeriodBody).toMatch(/morningCardState === 'completed' \? 'anytime' : 'morning'/);
  });
});

describe('Today\'s Rhythm — Anytime detail card is honest, non-tracked content', () => {
  const anytimeStart = homeSource.indexOf("{activePeriod === 'anytime' && (");
  const anytimeEnd = homeSource.indexOf('{/* 6. Active intentions', anytimeStart);
  const anytimeBlock = anytimeStart > -1 && anytimeEnd > -1 ? homeSource.slice(anytimeStart, anytimeEnd) : '';

  it('the Anytime card block was found', () => {
    expect(anytimeBlock.length).toBeGreaterThan(0);
  });

  it('uses the truthful "Available anytime" framing, not a fabricated not-started/in-progress/completed state machine (no such tracking exists for Anytime Reset)', () => {
    expect(anytimeBlock).toMatch(/Available anytime/);
    expect(anytimeBlock).not.toMatch(/anytimeCardState/);
  });

  it('invents no Stitch-only content: no streak badge, no fabricated duration/track name, no "RECOMMENDED FOR YOU" banner', () => {
    expect(anytimeBlock).not.toMatch(/[Ss]treak/);
    expect(anytimeBlock).not.toMatch(/RECOMMENDED FOR YOU/);
    expect(anytimeBlock).not.toMatch(/Calm Dawn Acoustic/);
  });
});

describe('Today\'s Rhythm — no fabricated Stitch content anywhere in Home.jsx', () => {
  it('never introduces a streak counter, badge, or numeric completion count like "3 of 7 days" (confirmed absent from this codebase in the Phase 1 investigation; distinct from the legitimate pre-existing "Step N of M" progress labels)', () => {
    expect(homeSource).not.toMatch(/\d+-Day Streak/);
    expect(homeSource).not.toMatch(/\d+ of \d+ (routines|days|rituals|sessions)/);
  });

  it('never introduces the fabricated "Guided Journal"/"Focus Sounds" tiles or "RECOMMENDED FOR YOU" content from the Stitch reference', () => {
    expect(homeSource).not.toMatch(/Guided Journal/);
    expect(homeSource).not.toMatch(/Focus Sounds/);
    expect(homeSource).not.toMatch(/RECOMMENDED FOR YOU/);
  });
});
