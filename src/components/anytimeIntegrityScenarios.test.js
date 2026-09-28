// Phase 9 — Truthful Journey Outcomes (Part 10): the required Anytime
// 12-scenario checklist. Anytime is a decision pathway (Need -> Time ->
// Reset), never a fixed routine, so there is no full_routine event or
// whole-journey score to gate - these scenarios instead prove decision-
// pathway integrity (AnytimePathway.jsx) and closing-handoff origin
// isolation (anytimeOrigin.js/AnytimeClosingHandoff.jsx), consolidating
// what AnytimePathway.test.js/AnytimeClosingHandoff.test.js/
// anytimeOrigin.test.js (Phase 8) already prove real-execution/source-
// level, plus genuinely new coverage (scenario 7, 11, 12) this pass adds.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveAnytimeOrigin } from '../lib/anytimeOrigin';
import { ANYTIME_RESET_NEEDS, ANYTIME_RESET_DURATIONS } from '../lib/mediaCatalog';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const anytimePathwaySource = read('./AnytimePathway.jsx');
const anytimeResetSource = read('../pages/AnytimeReset.jsx');

describe('Anytime — required 12 scenarios', () => {
  it('1. Need selection alone -> Need shows selected (needSelected=true derived from a real needId), Time/Reset do not', () => {
    // AnytimeReset.jsx wires needSelected={Boolean(needId)}/timeSelected={Boolean(durationId)} - real values, not step position.
    expect(anytimeResetSource).toMatch(/needSelected=\{Boolean\(needId\)\}/);
    expect(anytimePathwaySource).toMatch(/const isSelected = \{ need: needSelected, time: timeSelected, reset: false \};/);
  });

  it('2. Time selection after Need -> both selected, Reset never', () => {
    expect(anytimeResetSource).toMatch(/timeSelected=\{Boolean\(durationId\)\}/);
    // reset is hardcoded false in isSelected - structurally can never become true regardless of any prop.
    expect(anytimePathwaySource).not.toMatch(/reset:\s*(needSelected|timeSelected|Boolean)/);
  });

  it('3. Reaching a Reset recommendation (viewing it) without starting it -> Reset not checked - viewing is not completing (no prop path exists that could check it)', () => {
    expect(anytimePathwaySource).not.toMatch(/reset:\s*true/);
    expect(anytimePathwaySource).toMatch(/reset: false/);
  });

  it('4/5/6. Reset only ever gets the mint "current" ring while genuinely the active step (currentStageId), never a completion badge for starting/exiting/abandoning a timer - AnytimePathway has no concept of Reset completion at all, by construction', () => {
    expect(anytimePathwaySource).toMatch(/const isCurrent = stage\.id === currentStageId;/);
    // The only badge glyph in this file is the Need/Time "selected" check - Reset (isSelected.reset === false) can never render it.
    const badgeBlock = anytimePathwaySource.match(/\{selected && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(badgeBlock).not.toBe('');
    expect(anytimePathwaySource).not.toMatch(/resetCompleted|reset.*completed|completed.*reset/i);
  });

  it('7. Individual practice completion via Anytime\'s self-guided timer Meditation is NOT currently wired to recordPracticeCompletion (a pre-existing gap, not introduced by Phase 9) - documented honestly rather than assumed; the only meditation completion writer is the separate Library-driven video path (Meditate.jsx, journey: "direct")', () => {
    const morningMeditate = read('../pages/MorningMeditate.jsx');
    const eveningMeditate = read('../pages/EveningMeditate.jsx');
    const selfGuided = read('../pages/SelfGuidedMeditation.jsx');
    for (const source of [morningMeditate, eveningMeditate, selfGuided]) {
      expect(source).not.toMatch(/recordPracticeCompletion/);
    }
    const meditateVideoSource = read('../pages/Meditate.jsx');
    expect(meditateVideoSource).toMatch(/recordPracticeCompletion/);
    expect(meditateVideoSource).toMatch(/journey: 'direct'/);
  });

  it('7b. No Anytime-reachable path ever writes practiceType "full_routine" - grep confirms it appears only in SessionComplete.jsx/EveningComplete.jsx (Morning/Evening routines)', () => {
    const fullRoutineSites = ['../pages/SessionComplete.jsx', '../pages/EveningComplete.jsx'].map(read);
    for (const source of fullRoutineSites) expect(source).toMatch(/practiceType: 'full_routine'/);
    for (const source of [anytimeResetSource, anytimePathwaySource, read('../pages/Meditate.jsx')]) {
      expect(source).not.toMatch(/full_routine/);
    }
  });

  it('8. Genuine Anytime-wizard origin (resolveAnytimeOrigin true for every real need/duration pair) resolves to the Anytime closing destination', () => {
    for (const need of ANYTIME_RESET_NEEDS) {
      for (const duration of ANYTIME_RESET_DURATIONS) {
        const result = resolveAnytimeOrigin({ anytimeNeed: need.id, anytimeDuration: duration.id });
        expect(result.anytimeOrigin).toBe(true);
      }
    }
  });

  it('9. Home-direct launch (no router state at all) never resolves a genuine Anytime origin - origin isolation preserved', () => {
    for (const state of [null, undefined, {}]) {
      expect(resolveAnytimeOrigin(state).anytimeOrigin).toBe(false);
    }
  });

  it('10. No percentage/100%/wellbeing-score anywhere in the Anytime decision pathway or closing handoff source', () => {
    const closingHandoffSource = read('../components/AnytimeClosingHandoff.jsx');
    for (const source of [anytimePathwaySource, closingHandoffSource, anytimeResetSource]) {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/\d+%/);
    }
  });

  it('11. No whole-routine "you completed everything" scoring is ever computed for Anytime - no isFullyCompleted/computeStageStatus import, no aggregate score of any kind', () => {
    for (const source of [anytimePathwaySource, anytimeResetSource, read('../components/AnytimeClosingHandoff.jsx')]) {
      expect(source).not.toMatch(/isFullyCompleted|computeStageStatus/);
    }
  });

  it('12. Home\'s Anytime preview-row connectors never gain badges regardless of any Breathe/Meditate session state elsewhere - the row is built from a static literal array, not from any live session/stepOutcomes value', () => {
    const homeSource = read('../pages/Home.jsx');
    const cueBlockMatch = homeSource.match(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">([\s\S]*?)<\/div>\s*\n\s*<Link/);
    const cueBlock = cueBlockMatch[1];
    expect(cueBlock).not.toMatch(/state\.stepOutcomes|stageStatus|StageOutcomeBadge/);
  });
});
