// Journey Embedding — step-numbering correction regression guard.
//
// An earlier revision of this feature excluded 'meditate'/'meditation'
// from MORNING_DISPLAY_STEP_NUMBERS/EVENING_DISPLAY_STEP_NUMBERS on
// mistaken "optional therefore uncounted" reasoning. The actual exclusion
// criterion for these maps was always "pre-entry (alarm) or terminal
// (Morning's own complete)" - never "skippable" (stretch/breathe/
// affirmation/reflection/gratitude/breathing were always all skippable
// AND always all counted). This file proves the corrected numbering
// end-to-end: the registry constants, every per-screen visible label,
// and Home's own resume-banner computation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MORNING_DISPLAY_STEP_NUMBERS,
  MORNING_DISPLAY_STEP_COUNT,
  EVENING_DISPLAY_STEP_NUMBERS,
  EVENING_DISPLAY_STEP_COUNT
} from './sessionConstants';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Corrected registry constants', () => {
  it('Morning: Intend=1, Stretch=2, Breathe=3, Meditate=4, Affirm=5, out of 5 total', () => {
    expect(MORNING_DISPLAY_STEP_NUMBERS).toEqual({ intention: 1, stretch: 2, breathe: 3, meditate: 4, affirmation: 5 });
    expect(MORNING_DISPLAY_STEP_COUNT).toBe(5);
  });

  it('Evening: WindDown=1, Reflect=2, Gratitude=3, Breathe=4, Meditate=5, Rest=6, Done=7, out of 7 total', () => {
    expect(EVENING_DISPLAY_STEP_NUMBERS).toEqual({
      windDown: 1,
      reflection: 2,
      gratitude: 3,
      breathing: 4,
      meditation: 5,
      sleepPreparation: 6,
      completion: 7
    });
    expect(EVENING_DISPLAY_STEP_COUNT).toBe(7);
  });
});

describe('Every Evening screen\'s own visible "Step X of 7" label', () => {
  it('Wind Down = Step 1 of 7', () => {
    expect(read('../pages/EveningWindDown.jsx')).toMatch(/Step 1 of 7/);
  });
  it('Reflection = Step 2 of 7', () => {
    expect(read('../pages/Reflection.jsx')).toMatch(/Step 2 of 7/);
  });
  it('Gratitude = Step 3 of 7', () => {
    expect(read('../pages/Gratitude.jsx')).toMatch(/Step 3 of 7/);
  });
  it('Evening Breathing = Step 4 of 7', () => {
    expect(read('../pages/EveningBreathing.jsx')).toMatch(/Step 4 of 7/);
  });
  it('Evening Meditation displays Step 5 of 7', () => {
    expect(read('../pages/EveningMeditate.jsx')).toMatch(/Step 5 of 7/);
  });
  it('Prepare for Rest displays Step 6 of 7', () => {
    expect(read('../pages/PrepareForRest.jsx')).toMatch(/Step 6 of 7/);
  });
  it('Evening Complete displays Step 7 of 7', () => {
    expect(read('../pages/EveningComplete.jsx')).toMatch(/Step 7 of 7/);
  });

  it('none of the seven Evening screens still shows a stale "of 6" total', () => {
    for (const path of [
      '../pages/EveningWindDown.jsx',
      '../pages/Reflection.jsx',
      '../pages/Gratitude.jsx',
      '../pages/EveningBreathing.jsx',
      '../pages/EveningMeditate.jsx',
      '../pages/PrepareForRest.jsx',
      '../pages/EveningComplete.jsx'
    ]) {
      const codeOnly = read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(codeOnly).not.toMatch(/Step \d of 6/);
    }
  });
});

describe('Morning screens\' own visible "Step X of 5" labels use correct counts', () => {
  it('Intention = Step 1 of 5 (was Step 1 of 4 before Meditate was counted)', () => {
    const codeOnly = read('../pages/IntentionSetup.jsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).toMatch(/Step 1 of 5/);
    expect(codeOnly).not.toMatch(/Step \d of 4/);
  });

  it('Affirmation carries no stale "Step 4 of 4" reference in real code (its doc comment now correctly says Step 5 of 5 in prose)', () => {
    const source = read('../pages/Affirmation.jsx');
    expect(source).toMatch(/Step 5 of 5/);
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/Step \d of 4/);
  });
});

describe('Home.jsx\'s resume-banner computation (resolveStepLabel) produces the corrected numbers for a session paused at each step', () => {
  // Home.jsx's resolveStepLabel is not separately exported - proven here by
  // re-deriving its exact documented behaviour directly from the corrected
  // constants it reads (Home.jsx: `MORNING_DISPLAY_STEP_NUMBERS[stepId]` /
  // `Step ${num} of ${MORNING_DISPLAY_STEP_COUNT}`), matching Home.jsx's own
  // source-level test convention (see Home.routineState.test.js's note).
  const resolveMorningLabel = (stepId) => {
    const num = MORNING_DISPLAY_STEP_NUMBERS[stepId];
    return num ? `Step ${num} of ${MORNING_DISPLAY_STEP_COUNT}` : '';
  };
  const resolveEveningLabel = (stepId) => {
    const num = EVENING_DISPLAY_STEP_NUMBERS[stepId];
    return num ? `Step ${num} of ${EVENING_DISPLAY_STEP_COUNT}` : '';
  };

  it('Morning: paused at meditate -> "Step 4 of 5"; paused at affirmation -> "Step 5 of 5"', () => {
    expect(resolveMorningLabel('meditate')).toBe('Step 4 of 5');
    expect(resolveMorningLabel('affirmation')).toBe('Step 5 of 5');
  });

  it('Evening: paused at meditation -> "Step 5 of 7"; paused at sleepPreparation -> "Step 6 of 7"; paused at completion -> "Step 7 of 7"', () => {
    expect(resolveEveningLabel('meditation')).toBe('Step 5 of 7');
    expect(resolveEveningLabel('sleepPreparation')).toBe('Step 6 of 7');
    expect(resolveEveningLabel('completion')).toBe('Step 7 of 7');
  });

  it('Home.jsx itself still computes this the documented way (source-level proof the real function matches the re-derivation above)', () => {
    const homeSource = read('../pages/Home.jsx');
    expect(homeSource).toMatch(/const num = MORNING_DISPLAY_STEP_NUMBERS\[stepId\];\s*\n\s*return num \? `Step \$\{num\} of \$\{MORNING_DISPLAY_STEP_COUNT\}` : '';/);
    expect(homeSource).toMatch(/const num = EVENING_DISPLAY_STEP_NUMBERS\[stepId\];\s*\n\s*return num \? `Step \$\{num\} of \$\{EVENING_DISPLAY_STEP_COUNT\}` : '';/);
  });
});
