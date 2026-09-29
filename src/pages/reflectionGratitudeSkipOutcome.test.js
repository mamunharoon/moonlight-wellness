// Evening Reflection/Gratitude navigation-blocker fix (Phase 13) —
// Session-Engine truthful-outcome regression coverage. Real per-file
// source assertions, matching this repo's own established pattern for
// Reflection/Gratitude/PromptStepper (see reflectionGratitudeTapFirst.
// test.js's identical style) - no DOM renderer is available in this
// Vitest environment (`environment: 'node'`).
//
// Root cause fixed here: sessionDefinitions.js marks 'reflection'/
// 'gratitude' `skippable: true` specifically "because PromptStepper's own
// Skip control is a real per-prompt affordance on this screen" - but
// PromptStepper's Skip button, on the LAST question, previously called
// the exact same onComplete(answers) as Continue, and Reflection.jsx/
// Gratitude.jsx's handleComplete always dispatched the Session Engine's
// own advanceStep() either way. A user who tapped Skip on every single
// Reflection/Gratitude question still had that whole step recorded
// 'completed', never 'skipped' - a real Truthful Journey Outcomes
// violation (Phase 9), and the exact opposite of every other skippable
// step in this app (Breathe.jsx/EveningBreathing.jsx's own Skip button
// calls the canonical skipStep(), never advanceStep()).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const promptStepperSource = read('../components/evening/PromptStepper.jsx');
const reflectionSource = read('./Reflection.jsx');
const gratitudeSource = read('./Gratitude.jsx');

describe('PromptStepper — Skip and Continue are distinguishable to the calling page on the last prompt', () => {
  it('handleNext (Continue) calls onComplete with { wasSkipped: false }', () => {
    const body = promptStepperSource.match(/const handleNext = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/onComplete\?\.\(answers, \{ wasSkipped: false \}\);/);
  });

  it('handleSkip calls onComplete with { wasSkipped: true }, still discarding the active prompt\'s own answer first', () => {
    const body = promptStepperSource.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/delete rest\[promptId\];/);
    expect(body).toMatch(/onComplete\?\.\(rest, \{ wasSkipped: true \}\);/);
  });

  it('non-last Next/Skip still both call the exact same onAdvance(activeIndex + 1) - only the LAST question distinguishes Skip from Continue', () => {
    const nextBody = promptStepperSource.match(/const handleNext = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const skipBody = promptStepperSource.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(nextBody).toMatch(/onAdvance\?\.\(activeIndex \+ 1\);/);
    expect(skipBody).toMatch(/onAdvance\?\.\(activeIndex \+ 1\);/);
  });
});

describe('Reflection.jsx/Gratitude.jsx — a genuine Skip on the final question dispatches the canonical skipStep(), never advanceStep()', () => {
  it('both destructure skipStep from useSession(), alongside the pre-existing advanceStep', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      expect(source).toMatch(/const \{ state, currentStep, advanceStep, skipStep \} = useSession\(\);/);
    }
  });

  it('handleComplete accepts the second { wasSkipped } argument, defaulting to false so a caller that omits it (none exist today, but matches PromptStepper\'s own additive-prop contract) behaves exactly like the pre-fix Continue-only path', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      expect(source).toMatch(/const handleComplete = \(answers, \{ wasSkipped = false \} = \{\}\) => \{/);
    }
  });

  it('the live-step branch dispatches skipStep() when wasSkipped, advanceStep() otherwise - never both, never neither', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      const body = source.match(/const handleComplete = \(answers, \{ wasSkipped = false \} = \{\}\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toBe('');
      expect(body).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === STEP_ID\) \{\s*\n\s*if \(wasSkipped\) \{\s*\n\s*skipStep\(\);\s*\n\s*\} else \{\s*\n\s*advanceStep\(\);\s*\n\s*\}\s*\n\s*\}/);
    }
  });

  it('navigation to the next screen is unconditional either way (Skip and Continue both still genuinely advance the route) - the fix only changes which Session Engine outcome is recorded, never blocks or duplicates the transition', () => {
    expect(reflectionSource).toMatch(/navigate\('\/gratitude'\);\s*\n {2}\};/);
    expect(gratitudeSource).toMatch(/navigate\('\/evening-breathing'\);\s*\n {2}\};/);
  });

  it('review-mode Continue/Skip still returns before ever reaching the wasSkipped branch - reviewing an earlier step never dispatches skipStep() or advanceStep()', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      const body = source.match(/const handleComplete = \(answers, \{ wasSkipped = false \} = \{\}\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      const reviewIdx = body.indexOf('if (isReviewMode)');
      const wasSkippedIdx = body.indexOf('if (wasSkipped)');
      expect(reviewIdx).toBeGreaterThan(-1);
      expect(wasSkippedIdx).toBeGreaterThan(reviewIdx);
    }
  });
});

describe('PromptStepper — the one genuine no-argument onComplete caller (StressRelease.jsx) is unaffected by the wasSkipped signature change', () => {
  it('StressRelease.jsx\'s handleComplete takes zero parameters and is passed directly as onComplete - JS silently ignores PromptStepper\'s two call-time arguments (answers, { wasSkipped }) for a callback that declares none, so this caller was never at risk from the additive second argument', () => {
    const stressReleaseSource = read('./StressRelease.jsx');
    expect(stressReleaseSource).toMatch(/const handleComplete = \(\) => \{/);
    expect(stressReleaseSource).toMatch(/onComplete=\{handleComplete\}/);
  });
});

describe('sessionDefinitions.js — reflection/gratitude were always meant to reach skipStep() from here', () => {
  it('both steps are skippable, and the registry\'s own comment already named PromptStepper\'s Skip control as the reason why', () => {
    const source = read('../session/sessionDefinitions.js');
    expect(source).toMatch(/skippable: true — PromptStepper's own Skip control is a real\s*\n\s*\/\/ per-prompt affordance on this screen/);
  });
});
