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
  // WakeWise DEV — journey-aware primary action colour: 'morning's
  // selectedRow was later fixed to use the alpha-safe morning-accent-tint
  // token instead of a `/10` modifier directly on the plain-hex
  // morning-accent token (the same opacity-on-hex-var gap JourneyGlow.jsx's
  // own doc comment documents - the original value pinned here was
  // silently transparent). 'primary' is untouched, still byte-identical -
  // that identical pre-existing gap is left as a separately-scoped issue.
  // Context-aware Meditation/Breathing theming — the token object itself
  // moved to the shared journeyTone.js file (so Meditation's own
  // controls can reuse it too); BreathingPatternRow.jsx now imports it
  // rather than defining its own copy. Same values, same behaviour.
  it('the shared journeyTone.js \'primary\' accent token is byte-identical to before; \'morning\' still uses the alpha-safe tint fix', () => {
    const source = read('../lib/journeyTone.js');
    expect(source).toMatch(/selectedRow: 'bg-primary\/10 border-primary',/);
    expect(source).toMatch(/selectedRow: 'bg-morning-accent-tint\/10 border-morning-accent',/);
  });

  // Context-aware Meditation/Breathing theming — BreathingRing.jsx now
  // has a real, additive journeyTone prop (default 'primary', the
  // original peach/coral look byte-identical to before) - see
  // BreathingRing.test.js for its own full coverage. This "Decision B"
  // guard is retargeted to what it always actually protected: the
  // default (no journeyTone passed) stays the exact original peach
  // gradient/glow, and the animation timing is untouched.
  it('BreathingRing.jsx defaults to the original peach gradient/glow (journeyTone="primary") when omitted, and the animation timing is unchanged', () => {
    const source = read('../components/BreathingRing.jsx');
    expect(source).toMatch(/journeyTone = 'primary'/);
    expect(source).toMatch(/orb: 'bg-gradient-to-br from-\[#954835\] to-\[#ff9d85\] shadow-primary\/10'/);
    expect(source).toMatch(/duration-\[4000ms\]/);
  });
});

describe('Prepare for Rest — all 10 real SL01-SL10 sleep experiences still present', () => {
  const source = read('./PrepareForRest.jsx');

  // Build 16 physical-iPhone correction (F10) legitimately restructured
  // this file's bedtime-media data (SLEEP_SOUNDS/GUIDED_VIDEOS replace the
  // former FEATURED_GUIDANCE/MORE_SLEEP_SOUNDS split - see
  // prepareForRest.test.js's own dedicated F10 coverage for the full
  // before/after). This block still guards the one thing it was written
  // to guard: no real sleep sound was ever dropped.
  it('SL01 is still a real, present sleep sound', () => {
    expect(source).toMatch(/\{ id: 'SL01', blurb: 'Settle into the steady rhythm of gentle rain\.' \}/);
  });

  it('SL02 through SL10 (all 9 remaining real sleep sounds) are still listed in SLEEP_SOUNDS, none dropped to match Stitch\'s abbreviated mockup', () => {
    for (let n = 2; n <= 10; n++) {
      const id = `SL${String(n).padStart(2, '0')}`;
      expect(source).toMatch(new RegExp(`\\{ id: '${id}',`));
    }
    const soundsBlock = source.match(/const SLEEP_SOUNDS = \[([\s\S]*?)\];/)?.[1] ?? '';
    const idCount = (soundsBlock.match(/id: 'SL\d+'/g) ?? []).length;
    expect(idCount).toBe(10); // SL01-SL10, all in one flat list now
  });

  it('the 4 real checklist items are untouched', () => {
    expect(source).toMatch(/title: 'Put your phone down soon\.'/);
    expect(source).toMatch(/title: 'Have a little water\.'/);
    expect(source).toMatch(/title: 'Dim the room\.'/);
    expect(source).toMatch(/title: 'Let the day finish\.'/);
  });

  it('no evening-accent border/glow reference exists in this file - Decision D/C did not extend into Prepare for Rest, only Home/Routines/Complete/Review/Edit did', () => {
    expect(source).not.toMatch(/evening-accent/);
  });
});

describe('The compact two-column answer grid (commit 96f5f30) is untouched by Build 17 - this describe block\'s own name refers to THAT phase; the LATER Evening journey-theme correction genuinely did edit AnswerOptionButton.jsx/PromptStepper.jsx (see AnswerOptionButton.test.js/reflectionGratitudeTapFirst.test.js for that phase\'s own full coverage) - grid structure itself is still untouched by either phase', () => {
  const gridContainerFiles = [
    '../components/evening/PromptStepper.jsx',
    '../components/evening/EveningEditQuestion.jsx',
    '../components/evening/EveningReviewQuestion.jsx',
  ];

  it('every grid CONTAINER file (the three callers, not AnswerOptionButton.jsx itself - it renders one card, never the container) still declares grid grid-cols-2', () => {
    for (const path of gridContainerFiles) {
      expect(read(path)).toMatch(/grid grid-cols-2/);
    }
  });

  // Evening journey-theme correction — AnswerOptionButton.jsx's old
  // ACCENT_TOKENS (peach for BOTH 'reflection' and 'gratitude', with a
  // hardcoded evening-accent unselected state regardless of accent) is
  // gone, replaced by journeyTone.js's shared token map (see
  // AnswerOptionButton.test.js for the full new-behaviour coverage). This
  // reverses what this describe block used to pin as permanently
  // unchanged.
  it('AnswerOptionButton.jsx now resolves colour from the shared journeyTone.js map, not a local peach-only ACCENT_TOKENS object', () => {
    const source = read('../components/evening/AnswerOptionButton.jsx');
    expect(source).toMatch(/import \{ getJourneyToneTokens \} from '\.\.\/\.\.\/lib\/journeyTone';/);
    expect(source).not.toMatch(/reflection: \{ text: 'text-primary', border: 'border-primary'/);
    expect(source).not.toMatch(/gratitude: \{ text: 'text-primary', border: 'border-primary'/);
  });
});
