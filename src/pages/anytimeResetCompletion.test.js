// Anytime Reset completion fix — found live: when the recommended media
// reached its real natural end, the screen just silently closed back to
// the ordinary "Recommended for you" state, identical to closing it early
// - no distinct completion state existed, so natural end and early close
// were indistinguishable.
//
// Fix: BetaVideoModal gains a new, optional onEnded callback (additive -
// every other caller omits it and is unaffected), fired only from the
// real native `ended` event, alongside its own existing hasEnded state.
// AnytimeReset.jsx uses it to set a derived-from-nothing-else isComplete
// flag, shows a distinct "Reset complete" screen only when it's true,
// keeps Choose another/Change need/Change time available there too, and
// resets isComplete whenever the recommendation criteria change (need,
// duration, chosen alternative). Closing the modal early (handleVideoClose)
// never touches isComplete - the ordinary "Recommended for you" state is
// always what an early close falls through to. No DOM/component rendering
// is available in this repo's Vitest - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const modalSource = read('../components/BetaVideoModal.jsx');
const source = read('./AnytimeReset.jsx');

describe('BetaVideoModal.jsx — new onEnded callback, additive', () => {
  it('accepts an optional onEnded prop, defaulting to undefined', () => {
    expect(modalSource).toMatch(/export const BetaVideoModal = \(\{ entry, onClose, showBetaBadge = false, onEnded \}\) => \{/);
  });

  it('calls onEnded from the real native `ended` event handler, alongside the existing setHasEnded(true) - never from onClose', () => {
    const body = modalSource.match(/const handleEnded = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).toMatch(/setHasEnded\(true\);/);
    expect(body).toMatch(/onEnded\?\.\(\);/);
    const closeBody = modalSource.match(/const handleClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(closeBody).not.toMatch(/onEnded/);
  });
});

describe('AnytimeReset.jsx — isComplete is set only by genuine natural end, never by closing', () => {
  it('BetaVideoModal is passed onEnded={() => setIsComplete(true)}, and handleVideoClose (early/manual close) never references isComplete at all', () => {
    expect(source).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{handleVideoClose\} onEnded=\{\(\) => setIsComplete\(true\)\} \/>/);
    const closeBody = source.match(/const handleVideoClose = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(closeBody).not.toMatch(/isComplete/);
  });

  it('isComplete starts false and is reset to false by every action that changes the recommendation (need, duration, chosen alternative, change-need, change-time)', () => {
    expect(source).toMatch(/const \[isComplete, setIsComplete\] = useState\(false\);/);
    for (const handler of ['handleSelectNeed', 'handleSelectDuration', 'handleChangeTime', 'handleChangeNeed', 'handleChooseAnother']) {
      const body = source.match(new RegExp(`const ${handler} = \\([^)]*\\) => \\{[\\s\\S]*?\\n {2}\\};`))?.[0] ?? '';
      expect(body).toMatch(/setIsComplete\(false\);/);
    }
  });
});

describe('AnytimeReset.jsx — distinct "Reset complete" screen, exact required copy and actions', () => {
  const recommendStep = source.slice(source.indexOf("step === 'recommend' &&"));

  it('the heading/subtext switch to the exact required copy when isComplete', () => {
    expect(recommendStep).toMatch(/\{isComplete \? 'Reset complete' : 'Recommended for you'\}/);
    expect(recommendStep).toMatch(/Take a moment to notice how you feel\./);
  });

  it('primary "Done" navigates Home, secondary "Play again" calls handlePlayAgain - rendered only when isComplete, replacing the ordinary RecommendationCard', () => {
    const completionBlock = recommendStep.slice(recommendStep.indexOf('{isComplete ? ('), recommendStep.indexOf(') : current ? ('));
    expect(completionBlock).toMatch(/onClick=\{\(\) => navigate\('\/'\)\}[\s\S]*?Done/);
    expect(completionBlock).toMatch(/onClick=\{handlePlayAgain\}[\s\S]*?Play again/);
  });

  it('handlePlayAgain clears isComplete first, then reuses the existing guest/auth-verified handleBegin to reopen the same recommended item', () => {
    const body = source.match(/const handlePlayAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setIsComplete\(false\);/);
    expect(body).toMatch(/handleBegin\(\);/);
  });

  it('Choose another remains available in the completion state too (per spec), gated the same way as the ordinary state - only when more than one item exists', () => {
    expect(recommendStep).toMatch(/\{isComplete && items\.length > 1 && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{handleChooseAnother\}/);
  });

  it('Change need / Change time render unconditionally in this step, so they remain available in the completion state exactly as in the ordinary state', () => {
    const changeButtonsBlock = recommendStep.slice(recommendStep.lastIndexOf('<div className="flex gap-2">'));
    expect(changeButtonsBlock).toMatch(/onClick=\{handleChangeNeed\}/);
    expect(changeButtonsBlock).toMatch(/onClick=\{handleChangeTime\}/);
  });
});
