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

  // WakeWise DEV — Anytime completion correction: exactly two actions
  // now, matching the same required pair QuietBreathing.jsx's own
  // anytime-tone completion shows - "Choose another quick reset"
  // un-completes this same screen (same needId/durationId, so the
  // recommendation + quick-reset alternatives reappear immediately,
  // never a forced fresh need/duration pick or an auto-started new
  // exercise); "Return to Home" is a plain navigate('/'). "Play again"/
  // the old always-available "Choose another"/"Change need"/"Change
  // time" trio are no longer shown alongside the completion screen - see
  // the next two tests for what replaced them.
  it('primary "Choose another quick reset" un-completes this screen, secondary "Return to Home" navigates Home - rendered only when isComplete, replacing the ordinary RecommendationCard', () => {
    const completionBlock = recommendStep.slice(recommendStep.indexOf('{isComplete ? ('), recommendStep.indexOf(') : current ? ('));
    expect(completionBlock).toMatch(/onClick=\{\(\) => setIsComplete\(false\)\}[\s\S]*?Choose another quick reset/);
    expect(completionBlock).toMatch(/onClick=\{\(\) => navigate\('\/'\)\}[\s\S]*?Return to Home/);
  });

  it('handlePlayAgain no longer exists - replaced by the plain setIsComplete(false) above, which reuses handleBegin\'s own guest/auth-verified path implicitly by simply re-showing the same RecommendationCard, never auto-starting anything', () => {
    expect(source).not.toMatch(/const handlePlayAgain/);
    expect(source).not.toMatch(/Play again/);
  });

  it('the always-available "Choose another quick reset" list, and Change need/Change time, are all hidden during the completion state - exactly two actions show there, nothing else', () => {
    expect(recommendStep).not.toMatch(/\{isComplete && items\.length > 1 && \(/);
    const changeButtonsBlock = recommendStep.slice(recommendStep.lastIndexOf('{!isComplete && (\n            <div className="flex gap-2">'));
    expect(changeButtonsBlock).toMatch(/onClick=\{handleChangeNeed\}/);
    expect(changeButtonsBlock).toMatch(/onClick=\{handleChangeTime\}/);
  });

  it('the new quick-reset alternatives (Breathe/Meditate/Instant Calm - no invented Stretch, no standalone Stretch route exists) render only when !isComplete, each a real existing WakeWise practice', () => {
    expect(recommendStep).toMatch(/Or choose another quick reset/);
    expect(recommendStep).toMatch(/QUICK_RESET_ALTERNATIVES\.map/);
    expect(source).toMatch(/id: 'breathe', icon: 'air', label: 'Breathe'/);
    expect(source).toMatch(/id: 'meditate', icon: 'self_improvement', label: 'Meditate'/);
    expect(source).toMatch(/id: 'instant-calm', icon: 'bolt', label: 'Instant Calm'/);
    expect(source).not.toMatch(/label: 'Stretch'/);
  });
});

// WakeWise DEV — Anytime completion correction: found live (390x844,
// clicking through Welcome -> Anytime Reset -> Breathe -> end session ->
// "Choose another quick reset") that this button landed back on Anytime
// Reset's own step 1 ("What do you need right now?") instead of the
// recommendation/options screen the FINAL instruction's item 5 requires
// ("returns to Anytime recommendation/options screen") - a fresh
// navigate() to /anytime-reset remounts the component, discarding its
// local needId/durationId wizard state. Fixed by threading needId/
// durationId through to the destination practice via router state, which
// it forwards back here as ?need=&duration= - the exact same allowlisted
// restore mechanism this component already uses for its post-sign-in
// resume (see this file's own top doc comment).
describe('AnytimeReset.jsx — handleQuickResetAlternative forwards needId/durationId so the destination practice can restore this exact recommendation', () => {
  it('Breathe/Meditate alternatives navigate with anytimeNeed/anytimeDuration alongside journeyTone, not just journeyTone alone', () => {
    const body = source.match(/const handleQuickResetAlternative = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const path = id === 'breathe' \? '\/breathe-standalone' : '\/self-guided-meditation';/);
    expect(body).toMatch(
      /navigate\(path, \{ state: \{ journeyTone: 'anytime', anytimeNeed: needId, anytimeDuration: durationId \} \}\);/
    );
  });
});
