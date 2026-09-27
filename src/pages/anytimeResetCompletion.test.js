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
  it('accepts an optional onEnded prop, defaulting to undefined (plus the later, equally additive completionContext = null - guided-media completion phase)', () => {
    expect(modalSource).toMatch(/export const BetaVideoModal = \(\{ entry, onClose, showBetaBadge = false, onEnded, completionContext = null \}\) => \{/);
  });

  it('calls onEnded from the real native `ended` event handler, alongside the existing setHasEnded(true) - never from onClose', () => {
    const body = modalSource.match(/const handleEnded = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).toMatch(/setHasEnded\(true\);/);
    expect(body).toMatch(/onEnded\?\.\(\);/);
    const closeBody = modalSource.match(/const handleClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(closeBody).not.toMatch(/onEnded/);
  });
});

describe('AnytimeReset.jsx — isComplete is set true only by genuine natural end, never by closing', () => {
  it('BetaVideoModal is passed onEnded={() => setIsComplete(true)}, and handleVideoClose (early/manual close) never itself sets isComplete TRUE - it only reads it to raise the honest justEndedEarly acknowledgement when NOT already complete (WakeWise Phase 2, B4), and (guided-media completion phase) always clears it back to false once the modal\'s own overlay has been dismissed either way', () => {
    expect(source).toMatch(/<BetaVideoModal\s*\n\s*entry=\{openVideo\}\s*\n\s*onClose=\{handleVideoClose\}\s*\n\s*onEnded=\{\(\) => setIsComplete\(true\)\}\s*\n\s*completionContext=\{\{\s*\n\s*journey: 'anytime',/);
    const closeBody = source.match(/const handleVideoClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(closeBody).not.toMatch(/setIsComplete\(true\)/);
    expect(closeBody).toMatch(/if \(!isComplete\) setJustEndedEarly\(true\);/);
    expect(closeBody).toMatch(/setIsComplete\(false\);/);
  });

  it('isComplete starts false and is reset to false by every action that changes the recommendation (need, duration, chosen alternative, change-need, change-time) - WakeWise Phase 2 (B5) renamed the old handleChooseAnother (a blind cycle) to handleToggleAlternatives/handleSelectAlternativeItem (a real progressive-disclosure toggle + direct selection, see anytimeResetEarlyExitAcknowledgement.test.js), both of which also reset isComplete', () => {
    expect(source).toMatch(/const \[isComplete, setIsComplete\] = useState\(false\);/);
    for (const handler of ['handleSelectNeed', 'handleSelectDuration', 'handleChangeTime', 'handleChangeNeed', 'handleSelectAlternativeItem']) {
      const body = source.match(new RegExp(`const ${handler} = \\([^)]*\\) => \\{[\\s\\S]*?\\n {2}\\};`))?.[0] ?? '';
      expect(body).toMatch(/setIsComplete\(false\);/);
    }
  });
});

describe('AnytimeReset.jsx — distinct "Reset complete" screen, exact required copy and actions', () => {
  // Bounded to end just before the openVideo/BetaVideoModal block (a
  // sibling render, not part of the recommend step's own JSX) so this
  // slice never accidentally picks up that block's own doc comments -
  // see the guided-media completion phase's own completionContext wiring
  // there instead, checked separately below.
  const recommendStep = source.slice(source.indexOf("step === 'recommend' &&"), source.indexOf('{openVideo && ('));

  // WakeWise guided-media completion phase — the isComplete-driven
  // headline/body branch and the distinct "Reset complete" screen it used
  // to render on this page are both gone: a genuine natural completion is
  // now acknowledged entirely inside BetaVideoModal's own shared overlay
  // (completionContext, journey: 'anytime' - see AnytimeReset.jsx's own
  // BetaVideoModal wiring and anytimeResetCompletion.test.js's sibling
  // describe block above). This headline now only ever distinguishes the
  // real early-close acknowledgement (justEndedEarly, unchanged) from the
  // ordinary "Recommended for you" state.
  it('the heading/subtext now only ever resolve the honest early-close acknowledgement (justEndedEarly) or the ordinary "Recommended for you" state - never a completed-branch of its own any more', () => {
    expect(recommendStep).toMatch(/\{outcomeMessage \? outcomeMessage\.headline : 'Recommended for you'\}/);
    expect(source).toMatch(/const outcomeMessage = justEndedEarly \? getOutcomeMessage\(OUTCOME\.ENDED_EARLY, JOURNEY\.ANYTIME, today\) : null;/);
    expect(source).not.toMatch(/OUTCOME\.COMPLETED/);
  });

  it('the recommend step never renders a second, page-level completion panel any more - it always falls straight to the RecommendationCard (or the no-match state); the actual completion acknowledgement is BetaVideoModal\'s own overlay\'s "Choose Another Session"/"Return Home" pair', () => {
    expect(recommendStep).toMatch(/\{current \? \(\s*\n\s*<RecommendationCard/);
    expect(recommendStep).not.toMatch(/isComplete \? \(/);
    const completionContextBlock = source.match(/completionContext=\{\{[\s\S]*?\n {10}\}\}/)?.[0] ?? '';
    expect(completionContextBlock).toMatch(/onPrimaryAction: \(\) => \{\s*\n\s*setIsComplete\(false\);\s*\n\s*setOpenVideoId\(null\);\s*\n\s*\},/);
    expect(completionContextBlock).toMatch(/onSecondaryAction: \(\) => \{\s*\n\s*setIsComplete\(false\);\s*\n\s*setOpenVideoId\(null\);\s*\n\s*navigate\('\/'\);\s*\n\s*\}/);
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
