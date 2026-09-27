// Product-wide outcome-aware encouragement audit and completion (mobile
// corrections batch). Physical-iPhone testing found the Phase 2 outcome
// model existed as a tested utility but was not consistently rendered -
// e.g. a naturally completed Breathing session showed no acknowledgement
// (see breathingSequentialCompletionLifecycle.test.js/outcomeMessages.test.js
// for that fix). This file covers the remaining confirmed gaps: Grounding/
// StressRelease/Support's shared SupportComplete.jsx terminal screen never
// distinguished completed/skipped/ended-early, and SelfGuidedMeditationComplete.jsx
// duplicated a fixed string instead of reusing the shared model. Source-level
// regression guard (no DOM rendering in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('SupportComplete.jsx — outcome-aware, reusing the shared Phase 2 model (never a second outcome architecture)', () => {
  const source = read('./SupportComplete.jsx');

  it('imports the shared OUTCOME/JOURNEY/getOutcomeMessage, not a new model', () => {
    expect(source).toMatch(/import \{ OUTCOME, JOURNEY, getOutcomeMessage \} from '\.\.\/lib\/outcomeMessages';/);
  });

  it('derives the outcome from router state, defaulting to completed for any caller that has not been updated (preserves prior behaviour exactly)', () => {
    expect(source).toMatch(/const outcome = location\.state\?\.outcome === 'skipped' \|\| location\.state\?\.outcome === 'ended_early'/);
  });

  it('skipped and ended_early each resolve through getOutcomeMessage with JOURNEY.ANYTIME - never claim completion', () => {
    expect(source).toMatch(/getOutcomeMessage\(OUTCOME\.SKIPPED, JOURNEY\.ANYTIME, today\)/);
    expect(source).toMatch(/getOutcomeMessage\(OUTCOME\.ENDED_EARLY, JOURNEY\.ANYTIME, today\)/);
  });

  it('the completed case keeps its own already-on-tone bespoke copy (not swapped for the generic rotating set) - deliberate, not an oversight', () => {
    expect(source).toMatch(/headline: 'You made it through this moment\.', body: 'Be gentle with yourself\.'/);
  });

  it('renders the derived headline/body, not a hardcoded string', () => {
    expect(source).toMatch(/<h1 className="font-serif italic text-3xl text-on-surface">\{headline\}<\/h1>/);
    expect(source).toMatch(/\{body\}/);
  });
});

describe('Grounding.jsx — Skip now honestly distinct from finishing (previously byte-identical navigation)', () => {
  const source = read('./Grounding.jsx');

  it('Skip passes outcome: "skipped" to SupportComplete via router state', () => {
    const fn = source.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/navigate\('\/support-complete', \{ state: \{ outcome: 'skipped' \} \}\);/);
  });

  it('finishing the last prompt (handleNext) still navigates with no outcome state - defaults to completed', () => {
    const fn = source.match(/const handleNext = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/navigate\('\/support-complete'\);/);
    expect(fn).not.toMatch(/outcome/);
  });
});

describe('Support.jsx — the "Instant Calm" video path (and every other video option) now distinguishes a genuine natural end from an early close', () => {
  const source = read('./Support.jsx');

  // WakeWise guided-media completion phase — the videoEndedNaturally flag
  // and its unconditional navigate('/support-complete', ...) are gone: a
  // genuine natural end is now acknowledged entirely inside BetaVideoModal's
  // own shared completion overlay (completionContext, journey: 'anytime' -
  // Support.jsx's own already-explicit tone); an early close now correctly
  // just closes the modal and returns to this exact recommendation view.
  // SupportComplete.jsx itself is untouched (still tested above) - only
  // unreachable from this particular video-close flow now (Grounding.jsx's
  // own separate, non-video exercise still routes there).
  it('no more videoEndedNaturally tracking or navigation to /support-complete from a video close', () => {
    expect(source).not.toMatch(/videoEndedNaturally/);
    expect(source).not.toMatch(/handleVideoClose[\s\S]{0,40}\/support-complete/);
  });

  it('handleVideoClose is now a plain, one-line close - no outcome branching of its own (that lives in BetaVideoModal)', () => {
    expect(source).toMatch(/const handleVideoClose = \(\) => setOpenVideoId\(null\);/);
  });

  it('BetaVideoModal carries completionContext with the anytime tone this page already uses, and both actions are real, valid destinations', () => {
    expect(source).toMatch(/completionContext=\{\{\s*\n\s*journey: 'anytime',/);
    const block = source.match(/completionContext=\{\{[\s\S]*?\n\s*\}\}/)?.[0] ?? '';
    expect(block).toMatch(/onPrimaryAction: \(\) => \{\s*\n\s*if \(mapping\.options\.length > 1\) handleChooseAnother\(\);\s*\n\s*setOpenVideoId\(null\);\s*\n\s*\},/);
    expect(block).toMatch(/onSecondaryAction: \(\) => \{\s*\n\s*setOpenVideoId\(null\);\s*\n\s*navigate\('\/'\);\s*\n\s*\}/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — natural-completion-only screen now reuses the shared model instead of a fixed hand-written string', () => {
  const source = read('./SelfGuidedMeditationComplete.jsx');

  it('derives headline/body from getOutcomeMessage(OUTCOME.COMPLETED, journeyTone, today)', () => {
    expect(source).toMatch(/getOutcomeMessage\(OUTCOME\.COMPLETED, journeyTone, today\)/);
  });

  it('never writes a completion flag (unchanged - this feature has no persisted history in this release, per the file\'s own doc comment)', () => {
    expect(source).not.toMatch(/localStorage\.setItem/);
  });
});

describe('SessionComplete.jsx — Morning full-completion daily flag now verifies state.status, not just route reachability', () => {
  const source = read('./SessionComplete.jsx');

  it('the write is gated by state.status === \'completed\' AND the existing same-day dedupe - mirrors EveningComplete.jsx\'s own mount-effect guard', () => {
    expect(source).toMatch(/if \(state\.status === 'completed' && shouldWriteCompletionDate\(localStorage\.getItem\(morningDoneKey\), attributionDateKey\)\) \{/);
  });
});

describe('Known, documented exclusions (not invented outcomes) — verified during the audit, left unchanged with reasoning', () => {
  it('MorningFlow.jsx (Stretch) has no outcome-message call - a quick multi-select setup+countdown step with no standalone completion surface of its own, same precedent as Affirmation.jsx', () => {
    const source = read('./MorningFlow.jsx');
    expect(source).not.toMatch(/getOutcomeMessage/);
  });

  it('Affirmation.jsx has no outcome-message call - a pure read-then-continue screen with no timer/natural-completion moment distinct from "tapped Continue"', () => {
    const source = read('./Affirmation.jsx');
    expect(source).not.toMatch(/getOutcomeMessage/);
  });

  it('PanicMode.jsx has no outcome screen - a stateless entry/framing screen with no timer and no completion concept of its own (hands off to Grounding)', () => {
    const source = read('./PanicMode.jsx');
    expect(source).not.toMatch(/getOutcomeMessage/);
  });
});
