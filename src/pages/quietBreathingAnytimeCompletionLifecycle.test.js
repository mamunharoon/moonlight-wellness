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
  it('the completion-detecting interval callback is the ONE place that detects completion and synchronously stops itself, stops music, picks the Anytime greeting (only when journeyTone === \'anytime\'), and sets isCompleted', () => {
    const standaloneEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!standalone\) return;\s*\n\s*if \(!hasBegun \|\| earlyEnded \|\| isCompleted \|\| endConfirmOpen\) return;[\s\S]*?\n\s*\}, \[standalone, hasBegun, earlyEnded, isCompleted, endConfirmOpen, journeyTone\]\);/)?.[0] ?? '';
    expect(standaloneEffect).not.toBe('');
    expect(standaloneEffect).toMatch(/current\.tick\(\)/);
    const completedBranch = standaloneEffect.match(/if \(completed\) \{([\s\S]*?)setIsCompleted\(true\);\s*\n\s*\}/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
    expect(completedBranch).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(completedBranch).toMatch(/if \(journeyTone === 'anytime'\) \{\s*\n\s*setCompletionGreeting\(getCompletionGreeting\(\{ journey: 'anytime', practice: 'breathing' \}\)\);\s*\n\s*\}/);
  });

  it('the effect never runs while !standalone, and refuses to (re)start once isCompleted or the Back/End-early dialog is open', () => {
    expect(source).toMatch(/if \(!standalone\) return;\s*\n\s*if \(!hasBegun \|\| earlyEnded \|\| isCompleted \|\| endConfirmOpen\) return;/);
  });

  it('a fresh createBreathingSession is only ever created from countdown.onComplete (the one true "start a fresh session" entry point) - never re-created by the interval effect itself', () => {
    const standaloneEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!standalone\) return;\s*\n\s*if \(!hasBegun \|\| earlyEnded \|\| isCompleted \|\| endConfirmOpen\) return;[\s\S]*?\n\s*\}, \[standalone, hasBegun, earlyEnded, isCompleted, endConfirmOpen, journeyTone\]\);/)?.[0] ?? '';
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

  it('the completed panel (Anytime tone only) renders the held completionGreeting value directly as the heading - never calls getCompletionGreeting again in JSX', () => {
    expect(completedPanel).not.toBe('');
    expect(completedPanel).toMatch(/journeyTone === 'anytime' \? completionGreeting : 'Breathing complete'/);
    expect(completedPanel).not.toMatch(/getCompletionGreeting\(/);
  });
});

describe('QuietBreathing.jsx (standalone, Anytime) — mint completed/check visual, "Breathing Completed" label, never shown for early exit or non-Anytime tones', () => {
  it('the mint badge and "Breathing Completed" label are gated on isCompleted && journeyTone === \'anytime\' - never rendered for earlyEnded or a non-Anytime completion', () => {
    expect(completedPanel).toMatch(/isCompleted && journeyTone === 'anytime' \? \(\s*\n\s*<div key="badge" className="w-20 h-20 rounded-full bg-tertiary\/10 border border-tertiary-tint\/25 shadow-mint-glow flex items-center justify-center mx-auto">/);
    expect(completedPanel).toMatch(/\{isCompleted && journeyTone === 'anytime' && \(\s*\n\s*<span className="font-label-sm text-xs text-tertiary uppercase tracking-widest font-bold">Breathing Completed<\/span>/);
  });

  it('never uses Morning gold or Evening periwinkle tokens - only tertiary/mint', () => {
    expect(completedPanel).not.toMatch(/morning-accent|evening-accent/);
  });
});

describe('QuietBreathing.jsx (standalone, Anytime) — Choose Another Reset restores the exact prior recommendation; Return Home clears temporary context', () => {
  it('"Choose Another Reset" calls exitPracticeToHome with the preserved anytimeResetDestination (need+duration restored via the existing allowlisted query-param mechanism) - never auto-starts a new exercise', () => {
    // Completion-transition-tuning pass — these actions now render as
    // their own sibling, gated on the RAW isCompleted || earlyEnded
    // (immediate, never delayed behind CompletionReveal's own hold+
    // exit-fade+stagger sequence) - see that sibling block's own doc
    // comment. No longer inside completedPanel's own narrower slice.
    expect(source).toMatch(/\{\(isCompleted \|\| earlyEnded\) && \(/);
    expect(source).toMatch(/onClick=\{\(\) => exitPracticeToHome\(navigate, anytimeResetDestination\)\}/);
    expect(source).toMatch(/<span>Choose Another Reset<\/span>/);
    expect(source).toMatch(/onClick=\{\(\) => exitPracticeToHome\(navigate, '\/'\)\}[\s\S]*?Return Home/);
  });

  it('anytimeResetDestination preserves needId/durationId via the same allowlisted ?need=&duration= shape AnytimeReset.jsx itself uses for its own post-sign-in restore - never a generic/bare destination when anytimeOrigin', () => {
    expect(source).toMatch(/const anytimeOrigin = Boolean\(location\.state\?\.anytimeNeed && location\.state\?\.anytimeDuration\);/);
    expect(source).toMatch(/const anytimeResetDestination = anytimeOrigin\s*\n\s*\? `\/anytime-reset\?need=\$\{encodeURIComponent\(location\.state\.anytimeNeed\)\}&duration=\$\{encodeURIComponent\(location\.state\.anytimeDuration\)\}`\s*\n\s*: '\/anytime-reset';/);
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
  it('a direct standalone visit (journeyTone resolves to something other than \'anytime\', or anytimeOrigin is false) still shows the original Done/Breathe again pair and the plain getBreathingAcknowledgement string - completely untouched by this pass\'s Anytime-specific additions', () => {
    expect(source).toMatch(/journeyTone !== 'anytime' \? \(/);
    expect(source).toMatch(/<span>Done<\/span>/);
    expect(source).toMatch(/onClick=\{handleBreatheAgain\}[\s\S]{0,400}Breathe again/);
  });
});

describe('QuietBreathing.jsx — timer cleanup on unmount', () => {
  it('a dedicated unmount effect stops the interval', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => stopBreathingInterval\(\), \[\]\);/);
  });
});
