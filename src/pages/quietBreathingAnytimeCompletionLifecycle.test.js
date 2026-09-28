// Anytime Breathing completion correction — reuses Breathe.jsx's approved,
// physical-iPhone-tested architecture for QuietBreathing.jsx's standalone
// mode (/breathe-standalone). Previous behaviour: `isComplete` was a
// render-time-DERIVED value (standalone && hasBegun && secondsLeft <= 0),
// and Back/"End early" opened a confirm dialog whose underlying timer/
// music never actually paused while it was open. Fix: a pure, synchronous
// createBreathingSession controller (breathingSession.js - already
// journey-agnostic and real-execution tested, see breathingSession.
// test.js) driven by ONE real interval, whose own callback is the single
// place that detects the final tick AND synchronously stops itself, stops
// music, picks the completion greeting (Anytime tone only), and flips the
// explicit isCompleted state; the dialog now genuinely pauses the timer/
// music via endConfirmOpen. Non-standalone (Support's embedded usage) is
// completely unaffected - see standaloneBreatheCompletion.test.js's own
// dedicated "non-standalone is completely untouched" describe block.
//
// Source-level checks only (no DOM rendering available in this repo's
// Vitest), matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./QuietBreathing.jsx');
const completedPanelStart = source.indexOf('{showCompletionPanel ? (');
const completedPanelEnd = source.indexOf(') : countdown.isActive ? (');
const completedPanel = source.slice(completedPanelStart, completedPanelEnd);

describe('QuietBreathing.jsx (standalone, Anytime) — completion is an explicit, authoritative state', () => {
  it('the completion-detecting interval callback is the ONE place that detects completion and synchronously stops itself, stops music, picks the Anytime greeting (only when anytimeOrigin - Part 11 entry-context isolation, never the merely-cosmetic journeyTone), and sets isCompleted', () => {
    const standaloneEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!standalone\) return;\s*\n\s*if \(!hasBegun \|\| earlyEnded \|\| isCompleted \|\| endConfirmOpen\) return;[\s\S]*?\n\s*\}, \[standalone, hasBegun, earlyEnded, isCompleted, endConfirmOpen, anytimeOrigin\]\);/)?.[0] ?? '';
    expect(standaloneEffect).not.toBe('');
    expect(standaloneEffect).toMatch(/current\.tick\(\)/);
    const completedBranch = standaloneEffect.match(/if \(completed\) \{([\s\S]*?)setIsCompleted\(true\);\s*\n\s*\}/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
    expect(completedBranch).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(completedBranch).toMatch(/if \(anytimeOrigin\) \{\s*\n\s*setCompletionGreeting\(getCompletionGreeting\(\{ journey: 'anytime', practice: 'breathing' \}\)\);\s*\n\s*\}/);
  });

  it('the effect never runs while !standalone, and refuses to (re)start once isCompleted or the Back/End-early dialog is open', () => {
    expect(source).toMatch(/if \(!standalone\) return;\s*\n\s*if \(!hasBegun \|\| earlyEnded \|\| isCompleted \|\| endConfirmOpen\) return;/);
  });

  it('a fresh createBreathingSession is only ever created from countdown.onComplete (the one true "start a fresh session" entry point) - never re-created by the interval effect itself', () => {
    const standaloneEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!standalone\) return;\s*\n\s*if \(!hasBegun \|\| earlyEnded \|\| isCompleted \|\| endConfirmOpen\) return;[\s\S]*?\n\s*\}, \[standalone, hasBegun, earlyEnded, isCompleted, endConfirmOpen, anytimeOrigin\]\);/)?.[0] ?? '';
    expect(standaloneEffect).not.toMatch(/createBreathingSession/);
    const countdownBlock = source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(countdownBlock).toMatch(/sessionRef\.current = createBreathingSession\(\{ pattern: activePattern, resolveBreathPhase \}\);\s*\n\s*sessionRef\.current\.begin\(\);/);
  });

  it('non-standalone (Support) never touches sessionRef/isCompleted at all - its own effect is a completely separate, unrelated block', () => {
    const nonStandaloneEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(standalone\) return;\s*\n\s*if \(awaitingMusicChoice\) return;[\s\S]*?\n\s*\}, \[[^\]]*\]\);/)?.[0] ?? '';
    expect(nonStandaloneEffect).not.toMatch(/sessionRef|isCompleted/);
  });
});

describe('QuietBreathing.jsx (standalone, Anytime) — completion greeting is picked exactly once per completion, held stable, never re-picked on re-render', () => {
  it('completionGreeting is React state, set only from the shared getCompletionGreeting({journey: \'anytime\', practice: \'breathing\'}) API when journeyTone is genuinely anytime', () => {
    expect(source).toMatch(/const \[completionGreeting, setCompletionGreeting\] = useState\(null\);/);
    const setterCalls = source.match(/setCompletionGreeting\([^)]*\)/g) ?? [];
    expect(setterCalls.filter((c) => c.includes("getCompletionGreeting({ journey: 'anytime', practice: 'breathing' })")).length).toBe(1);
    // Resets to null: a fresh Begin (countdown.onComplete) and Breathe
    // again - never a third, render-time call.
    expect(setterCalls.filter((c) => c.includes('null')).length).toBe(2);
  });

  it('Anytime Visual Flow and Closing Handoff uplift (Part 9/Part 11) — the completed panel renders the held completionGreeting via the shared AnytimeClosingHandoffMessage, gated on the explicit anytimeOrigin marker (never journeyTone), and never calls getCompletionGreeting again in JSX', () => {
    expect(completedPanel).not.toBe('');
    expect(completedPanel).toMatch(/isCompleted && anytimeOrigin \? \(/);
    expect(completedPanel).toMatch(/<AnytimeClosingHandoffMessage active=\{showCompletionPanel\} greeting=\{completionGreeting\} \/>/);
    expect(completedPanel).not.toMatch(/getCompletionGreeting\(/);
  });
});

describe('QuietBreathing.jsx (standalone, Anytime) — mint completed/check visual, "RESET COMPLETE" eyebrow, never shown for early exit or non-Anytime tones', () => {
  // Anytime Visual Flow and Closing Handoff uplift (Part 9) — the mint
  // badge/eyebrow markup itself now lives once, shared, in
  // AnytimeClosingHandoff.jsx (see anytimeClosingHandoff.test.js) rather
  // than being duplicated inline here. This file only proves the GATE is
  // correct: genuinely anytimeOrigin only, never a non-anytimeOrigin
  // standalone visit or a genuine early exit (earlyEnded is a completely
  // separate branch of the same outer ternary, never reaching
  // AnytimeClosingHandoffMessage at all).
  it('the shared closing handoff message is only ever reached via isCompleted && anytimeOrigin - a genuine early exit (earlyEnded) always falls to the plain CompletionReveal branch instead', () => {
    expect(completedPanel).toMatch(/isCompleted && anytimeOrigin \? \(/);
    const nonHandoffBranch = completedPanel.slice(completedPanel.indexOf(') : ('));
    expect(nonHandoffBranch).toMatch(/earlyEnded \? 'Session ended early' : 'Breathing complete'/);
    expect(nonHandoffBranch).not.toMatch(/AnytimeClosingHandoffMessage/);
  });

  it('never uses Morning gold or Evening periwinkle tokens anywhere in this panel - only tertiary/mint (via the shared handoff) or the plain non-Anytime treatment', () => {
    expect(completedPanel).not.toMatch(/morning-accent|evening-accent/);
  });
});

describe('QuietBreathing.jsx (standalone, Anytime) — Choose Another Reset restores the exact prior recommendation; Continue My Day clears temporary context', () => {
  it('a genuine completion (isCompleted && anytimeOrigin) passes the shared AnytimeClosingHandoffActions its own onContinueMyDay/onChooseAnotherReset handlers, both routed through exitPracticeToHome - never auto-starting a new exercise', () => {
    // Completion-transition-tuning pass — these actions now render as
    // their own sibling, gated on the RAW isCompleted || earlyEnded
    // (immediate, never delayed behind CompletionReveal's own hold+
    // exit-fade+stagger sequence) - see that sibling block's own doc
    // comment. No longer inside completedPanel's own narrower slice.
    expect(source).toMatch(/\{\(isCompleted \|\| earlyEnded\) && \(/);
    expect(source).toMatch(/<AnytimeClosingHandoffActions\s*\n\s*onContinueMyDay=\{\(\) => exitPracticeToHome\(navigate, '\/'\)\}\s*\n\s*onChooseAnotherReset=\{\(\) => exitPracticeToHome\(navigate, anytimeResetDestination\)\}/);
    // The shared component itself (AnytimeClosingHandoff.jsx) owns the
    // real "Continue My Day"/"Choose Another Reset" button labels - see
    // anytimeClosingHandoff.test.js for that coverage.
  });

  it('the earlyEnded && anytimeOrigin branch (a genuine early exit, not a completion) still renders its own inline "Choose Another Reset"/"Continue My Day" pair, routed through exitPracticeToHome the same way', () => {
    expect(source).toMatch(/\) : earlyEnded && anytimeOrigin \? \(/);
    const earlyEndedBlock = source.slice(source.indexOf(') : earlyEnded && anytimeOrigin ? ('), source.indexOf(') : (', source.indexOf(') : earlyEnded && anytimeOrigin ? (')));
    expect(earlyEndedBlock).toMatch(/onClick=\{\(\) => exitPracticeToHome\(navigate, anytimeResetDestination\)\}/);
    expect(earlyEndedBlock).toMatch(/<span>Choose Another Reset<\/span>/);
    expect(earlyEndedBlock).toMatch(/onClick=\{\(\) => exitPracticeToHome\(navigate, '\/'\)\}/);
    expect(earlyEndedBlock).toMatch(/Continue My Day/);
  });

  it('anytimeOrigin/anytimeResetDestination are now resolved via the shared, allowlist-validated resolveAnytimeOrigin helper (lib/anytimeOrigin.js) - never a generic/bare destination when genuinely anytimeOrigin (Anytime Visual Flow and Closing Handoff uplift, Part 11)', () => {
    expect(source).toMatch(/import \{ resolveAnytimeOrigin \} from '\.\.\/lib\/anytimeOrigin';/);
    expect(source).toMatch(/const \{ anytimeOrigin, anytimeNeed, anytimeDuration, anytimeResetDestination \} = resolveAnytimeOrigin\(location\.state\);/);
  });
});

describe('QuietBreathing.jsx (standalone) — ended-early never records completion or shows the completed visual', () => {
  it('handleEndEarly never touches isCompleted/completionGreeting/getCompletionGreeting - structurally incapable of showing "Breathing Completed"', () => {
    const fn = source.match(/const handleEndEarly = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted|completionGreeting|getCompletionGreeting/);
  });

  it('handleConfirmEndSession (both Back and End-early confirm) never touches completionGreeting - stopping the session records nothing, regardless of source', () => {
    const fn = source.match(/const handleConfirmEndSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/completionGreeting|getCompletionGreeting/);
  });

  it('the earlyEnded panel keeps its exact existing honest wording, never the mint badge or "Breathing Completed" (Preserve any existing honest "Session ended early" behaviour)', () => {
    expect(completedPanel).toMatch(/\{earlyEnded \? 'Session ended early' : /);
    expect(completedPanel).toMatch(/Your \{activePattern\.label\} session ended before the timer finished\./);
  });
});

describe('QuietBreathing.jsx (standalone) — Back/End-early confirmation now genuinely pauses the timer/music while open (previously disclosed gap, fixed this pass), mirroring Breathe.jsx\'s exact severity/pattern', () => {
  it('handleBackFromActive captures whether music was playing, guards against re-opening, and only opens the dialog - never resets hasBegun/isCompleted or stops music itself', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/if \(endConfirmOpen\) return false;/);
    expect(fn).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    expect(fn).toMatch(/setEndConfirmSource\('back'\);/);
    expect(fn).toMatch(/setEndConfirmOpen\(true\);/);
    expect(fn).not.toMatch(/setHasBegun\(false\);|musicPlayerRef\.current\?\.stop\(\);/);
  });

  it('handleEndEarly also captures whether music was playing before opening the same shared dialog (tagged as the "button" source)', () => {
    const fn = source.match(/const handleEndEarly = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    expect(fn).toMatch(/setEndConfirmSource\('button'\);/);
  });

  it('keepBreathing resumes without resetting anything, restoring music only if it was genuinely playing before the dialog opened', () => {
    const fn = source.match(/const keepBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/setEndConfirmOpen\(false\);/);
    expect(fn).toMatch(/if \(wasMusicPlayingRef\.current\) \{/);
    expect(fn).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
  });

  it('InteractiveAmbientMusic (standalone) is suspended while the dialog is open, and hides its toggle once complete', () => {
    const standaloneReturn = source.slice(source.indexOf('if (standalone) {'), source.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(standaloneReturn).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}\s*\n\s*suspended=\{endConfirmOpen\}\s*\n\s*hideToggle=\{!hasBegun \|\| isCompleted\}\s*\n\s*\/>/);
  });

  it('a mildDestructive ConfirmDialog is wired to handleConfirmEndSession/keepBreathing, using "Leave Exercise" (renamed from "End Session" to match Morning/Evening\'s exact wording)', () => {
    const dialogBlock = source.match(/<ConfirmDialog\s*\n\s*open=\{endConfirmOpen\}[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).not.toBe('');
    expect(dialogBlock).toMatch(/title="End this breathing session\?"/);
    expect(dialogBlock).toMatch(/confirmLabel="Leave Exercise"/);
    expect(dialogBlock).toMatch(/cancelLabel="Keep Breathing"/);
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).toMatch(/onConfirm=\{handleConfirmEndSession\}/);
    expect(dialogBlock).toMatch(/onDismiss=\{keepBreathing\}/);
  });
});

describe('QuietBreathing.jsx (standalone) — starting another practice creates a fresh session', () => {
  it('handleBreatheAgain resets isCompleted/completionGreeting alongside the existing hasBegun/earlyEnded/secondsLeft/breatheState reset - a second pattern this visit never inherits a stale completed state', () => {
    const fn = source.match(/const handleBreatheAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/setIsCompleted\(false\);/);
    expect(fn).toMatch(/setCompletionGreeting\(null\);/);
  });

  it('every real Begin (countdown.onComplete) always creates a BRAND NEW controller - never reuses a previous instance across patterns/visits', () => {
    const countdownBlock = source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(countdownBlock).toMatch(/sessionRef\.current = createBreathingSession\(\{ pattern: activePattern, resolveBreathPhase \}\);/);
  });
});

describe('QuietBreathing.jsx — Home/direct launch (no Anytime origin) is unaffected', () => {
  it('a direct standalone visit (anytimeOrigin false - Part 11 entry-context isolation) still shows the original Done/Breathe again pair and the plain getBreathingAcknowledgement string - the final, unconditional else branch of the isCompleted && anytimeOrigin / earlyEnded && anytimeOrigin ternary chain, completely untouched by this pass\'s Anytime-specific additions', () => {
    expect(source).toMatch(/isCompleted && anytimeOrigin \? \(/);
    expect(source).toMatch(/\) : earlyEnded && anytimeOrigin \? \(/);
    expect(source).toMatch(/<span>Done<\/span>/);
    expect(source).toMatch(/onClick=\{handleBreatheAgain\}[\s\S]{0,400}Breathe again/);
  });
});

describe('QuietBreathing.jsx — timer cleanup on unmount', () => {
  it('a dedicated unmount effect stops the interval', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => stopBreathingInterval\(\), \[\]\);/);
  });
});
