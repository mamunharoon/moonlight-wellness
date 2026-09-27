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

  it('adds a real videoEndedNaturally flag, set only by BetaVideoModal\'s onEnded - mirrors AnytimeReset.jsx\'s own proven pattern for the identical gap', () => {
    expect(source).toMatch(/const \[videoEndedNaturally, setVideoEndedNaturally\] = useState\(false\);/);
    expect(source).toMatch(/onEnded=\{\(\) => setVideoEndedNaturally\(true\)\}/);
  });

  it('handleVideoClose passes the real outcome through router state and resets the flag for the next video', () => {
    const fn = source.match(/const handleVideoClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/outcome: videoEndedNaturally \? 'completed' : 'ended_early'/);
    expect(fn).toMatch(/setVideoEndedNaturally\(false\);/);
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
