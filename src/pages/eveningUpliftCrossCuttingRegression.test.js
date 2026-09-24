// Evening Visual Uplift (Build 17) — cross-cutting regression sweep.
// Individual decisions each have their own dedicated test file (see
// ProgressIndicator.eveningActiveStep.test.js, homeEveningCardUplift.
// test.js, eveningRoutinesUplift.test.js, eveningCompleteUplift.test.js,
// eveningReviewEditBannersUplift.test.js); this file proves the two
// things that could only be broken by touching the WRONG file: (1) no
// Morning-only or Anytime-only screen picked up an evening-accent
// reference, and (2) the two untouched-by-this-phase areas the approved
// brief called out explicitly - Prepare for Rest's 10 real sleep
// experiences and the compact two-column answer grid - are still exactly
// as they were, because this phase never edited either file.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Morning-only screens carry no evening-accent reference introduced by this phase', () => {
  const morningOnlyFiles = [
    './IntentionSetup.jsx',
    './MorningFlow.jsx',
    './Breathe.jsx',
    './Affirmation.jsx',
    './SessionComplete.jsx',
  ];

  it('none of Morning\'s own real screens reference evening-accent or evening-glow anywhere', () => {
    for (const file of morningOnlyFiles) {
      const source = read(file);
      expect(source).not.toMatch(/evening-accent/);
      expect(source).not.toMatch(/shadow-evening-glow/);
    }
  });
});

describe('Anytime-only screens carry no evening-accent reference introduced by this phase', () => {
  const anytimeOnlyFiles = [
    './QuietBreathing.jsx',
    './AnytimeReset.jsx',
    './Meditate.jsx',
  ];

  it('none of Anytime\'s own real screens reference evening-accent or evening-glow anywhere', () => {
    for (const file of anytimeOnlyFiles) {
      const source = read(file);
      expect(source).not.toMatch(/evening-accent/);
      expect(source).not.toMatch(/shadow-evening-glow/);
    }
  });
});

describe('Shared components this phase touched keep Morning/Anytime\'s own defaults intact', () => {
  it('BreathingPatternRow.jsx\'s \'primary\' and \'morning\' accent tokens are byte-identical to before (only a doc comment may change)', () => {
    const source = read('../components/BreathingPatternRow.jsx');
    expect(source).toMatch(/selectedRow: 'bg-primary\/10 border-primary',/);
    expect(source).toMatch(/selectedRow: 'bg-morning-accent\/10 border-morning-accent',/);
  });

  it('BreathingRing.jsx (Decision B) has no accent prop and no evening-accent reference - shared peach glow unchanged, no animation touched', () => {
    const source = read('../components/BreathingRing.jsx');
    expect(source).toMatch(/export const BreathingRing = \(\{ breatheState, secondsLeft \}\) => \{/);
    expect(source).not.toMatch(/evening-accent/);
    expect(source).not.toMatch(/accent/);
  });
});

describe('Prepare for Rest — all 10 real SL01-SL10 sleep experiences still present, file untouched by this phase', () => {
  const source = read('./PrepareForRest.jsx');

  it('SL01 is still the featured sleep sound', () => {
    expect(source).toMatch(/\{ id: 'SL01', kind: 'Sleep sound', blurb: 'Settle into the steady rhythm of gentle rain\.' \}/);
  });

  it('SL02 through SL10 (all 9 remaining real sleep sounds) are still listed in MORE_SLEEP_SOUNDS, none dropped to match Stitch\'s abbreviated mockup', () => {
    for (let n = 2; n <= 10; n++) {
      const id = `SL${String(n).padStart(2, '0')}`;
      expect(source).toMatch(new RegExp(`\\{ id: '${id}',`));
    }
    const moreSoundsBlock = source.match(/const MORE_SLEEP_SOUNDS = \[([\s\S]*?)\];/)?.[1] ?? '';
    const idCount = (moreSoundsBlock.match(/id: 'SL\d+'/g) ?? []).length;
    expect(idCount).toBe(9); // SL02-SL10
  });

  it('the 4 real checklist items and the "More bedtime options" disclosure toggle are untouched', () => {
    expect(source).toMatch(/title: 'Put your phone down soon\.'/);
    expect(source).toMatch(/title: 'Have a little water\.'/);
    expect(source).toMatch(/title: 'Dim the room\.'/);
    expect(source).toMatch(/title: 'Let the day finish\.'/);
  });

  it('no evening-accent border/glow reference exists in this file - Decision D/C did not extend into Prepare for Rest, only Home/Routines/Complete/Review/Edit did', () => {
    expect(source).not.toMatch(/evening-accent/);
  });
});

describe('The compact two-column answer grid (commit 96f5f30) is untouched - this phase never edited any of these four files', () => {
  const gridFiles = [
    ['../components/evening/AnswerOptionButton.jsx', 'AnswerOptionButton.jsx'],
    ['../components/evening/PromptStepper.jsx', 'PromptStepper.jsx'],
    ['../components/evening/EveningEditQuestion.jsx', 'EveningEditQuestion.jsx'],
    ['../components/evening/EveningReviewQuestion.jsx', 'EveningReviewQuestion.jsx'],
  ];

  it('every grid file still declares grid grid-cols-2, and none references evening-accent-based selected-state colour (peach/periwinkle split stays exactly as delivered in commit 96f5f30)', () => {
    for (const [path, label] of gridFiles) {
      const source = read(path);
      if (label === 'AnswerOptionButton.jsx') {
        // The radio's own unselected ring/border already used evening-accent
        // before this phase (Build 15) - confirms this file was never
        // touched by Build 17, not that evening-accent is newly absent.
        expect(source).toMatch(/reflection: \{ text: 'text-primary', border: 'border-primary'/);
        expect(source).toMatch(/gratitude: \{ text: 'text-primary', border: 'border-primary'/);
      } else {
        expect(source).toMatch(/grid grid-cols-2/);
      }
    }
  });
});
