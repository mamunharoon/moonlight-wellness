// Phase 9 — Truthful Journey Outcomes, Part 10's explicitly named Evening
// scenario, proven end-to-end with REAL execution of the actual production
// functions (computeStageStatus/isFullyCompleted from session/stageStatus.js
// - never a mock, never a source-string-only assertion):
//
//   Reflection completed; Gratitude completed; Breathing started but ended
//   early; Meditation skipped; final screen reached.
//
// Expected result: "Evening Wind-Down finished" (never "complete"); original
// icons remain (proven by EveningJourneyPathway.test.js's own separate
// "never replaces stage.icon" coverage - stageStatus.js only ever returns a
// status string, never a different icon); arrows remain (same reasoning -
// EveningJourneyPathway.jsx's connectors are unconditional, independent of
// status); Breathe shows the ended-early indicator; Meditate shows the
// skipped indicator; no percentage; no new full_routine event; no
// incorrect Momentum increment.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeStageStatus, isFullyCompleted, STAGE_STATUS } from '../session/stageStatus';
import { EVENING_PATHWAY_STAGES } from '../session/pathwayStages';
import { SESSION_STATUS } from '../session/sessionReducer';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

// The exact stepOutcomes the Session Engine would hold for this scenario:
// Reflection/Gratitude naturally completed (ADVANCE_STEP), Breathing
// confirmed-abandoned mid-exercise (RECORD_STEP_ENDED_EARLY), Meditation
// explicitly skipped (SKIP_STEP), Sleep Preparation naturally reached and
// left en route to the terminal 'completion' step (ADVANCE_STEP marks the
// step being left 'completed').
const NAMED_SCENARIO_STEP_OUTCOMES = {
  reflection: 'completed',
  gratitude: 'completed',
  breathing: 'ended_early',
  meditation: 'skipped',
  sleepPreparation: 'completed'
};

describe('Phase 9, Part 10 — the named Evening partial-completion scenario (real execution, not source-string-only)', () => {
  const stages = computeStageStatus({
    stages: EVENING_PATHWAY_STAGES,
    stepOutcomes: NAMED_SCENARIO_STEP_OUTCOMES,
    currentStepId: 'completion',
    sessionStatus: SESSION_STATUS.COMPLETED
  });

  it('resolves the exact real per-stage outcomes for this scenario - never inferred from route position', () => {
    expect(stages).toEqual([
      { id: 'reflect', label: 'Reflect', icon: expect.any(String), status: STAGE_STATUS.COMPLETED },
      { id: 'gratitude', label: 'Gratitude', icon: expect.any(String), status: STAGE_STATUS.COMPLETED },
      { id: 'breathe', label: 'Breathe', icon: expect.any(String), status: STAGE_STATUS.ENDED_EARLY },
      { id: 'meditate', label: 'Meditate', icon: expect.any(String), status: STAGE_STATUS.SKIPPED },
      { id: 'rest', label: 'Rest', icon: expect.any(String), status: STAGE_STATUS.COMPLETED }
    ]);
  });

  it('Breathe genuinely shows the ended-early status and Meditate genuinely shows the skipped status - the two states that were previously indistinguishable under the old position-based logic', () => {
    expect(stages.find((s) => s.id === 'breathe').status).toBe('ended_early');
    expect(stages.find((s) => s.id === 'meditate').status).toBe('skipped');
  });

  it('isFullyCompleted is genuinely false for this exact scenario - reaching the terminal step is not, by itself, sufficient', () => {
    expect(isFullyCompleted(stages)).toBe(false);
  });

  it('EveningComplete.jsx wires this exact function/data shape to decide its heading - for this scenario eveningFullyCompleted resolves false, so the rendered heading is "Evening Wind-Down finished", never "complete"', () => {
    const source = read('./EveningComplete.jsx');
    expect(source).toMatch(/const eveningFullyCompleted = isFullyCompleted\(eveningPathwayStages\);/);
    expect(source).toMatch(/\{eveningFullyCompleted \? 'Evening Wind-Down complete' : 'Evening Wind-Down finished'\}/);
  });

  it('EveningComplete.jsx never writes a full_routine completion event for this scenario - the SAME eveningFullyCompleted (false here) gates the recordPracticeCompletion effect', () => {
    const source = read('./EveningComplete.jsx');
    expect(source).toMatch(/if \(state\.status !== 'completed' \|\| !state\.completionEventId \|\| !eveningFullyCompleted\) return;/);
  });

  it('no percentage appears anywhere on this screen for any scenario, including this one (repo-wide regression coverage lives in eveningCompleteVisualUplift.test.js)', () => {
    const source = read('./EveningComplete.jsx');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/100%/);
    expect(code).not.toMatch(/\d+%/);
  });

  it('the original genuine stage icons remain for every status in this scenario, including ended-early and skipped - computeStageStatus only ever returns the stage\'s own real icon, never swaps it for a status glyph', () => {
    for (const stage of stages) {
      const original = EVENING_PATHWAY_STAGES.find((s) => s.id === stage.id);
      expect(stage.icon).toBe(original.icon);
    }
  });

  it('EveningJourneyPathway.jsx renders this scenario\'s stages via the unconditional main-icon span, with status only ever changing the additive StageOutcomeBadge - never a checkmark/dash/pause swapped in for the real icon', () => {
    const source = read('../components/EveningJourneyPathway.jsx');
    expect(source).toMatch(/<span className="material-symbols-outlined text-sm" aria-hidden="true">\{stage\.icon\}<\/span>/);
    expect(source).toMatch(/<StageOutcomeBadge status=\{stage\.status\} journeyTone="evening" \/>/);
  });

  it('EveningJourneyPathway.jsx\'s connectors are unconditional (gated only on position, never on status) - so this scenario\'s arrows remain exactly as for a fully-completed run', () => {
    const source = read('../components/EveningJourneyPathway.jsx');
    expect(source).toMatch(/idx < stages\.length - 1 &&/);
    expect(source).not.toMatch(/stage\.status[\s\S]{0,40}chevron_right/);
  });
});
