// Standalone Breathe completion redesign — found live: at /breathe-standalone
// (QuietBreathing.jsx's `standalone` prop), "Continue" was tappable at any
// time during the active exercise, and both it and "Skip" converged on the
// exact same immediate, silent navigate('/') via handleAdvance - no
// distinct completion state existed at all.
//
// Fix (standalone only - /quiet-breathing's non-standalone branch, and
// every embedded Morning/Evening breathing screen, are untouched):
//   - While active: no Continue button. A single "End early" action cleans
//     up (stops music, navigates Home) without ever claiming completion.
//   - On genuine natural completion (secondsLeft reaches 0): a distinct
//     "Breathing complete" screen - "Take a moment to notice how you
//     feel.", primary "Done" -> Home, secondary "Breathe again" -> this
//     same screen's own setup (not a direct restart).
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./QuietBreathing.jsx', import.meta.url)), 'utf-8');
const standaloneStart = source.indexOf('if (standalone) {');
const nonStandaloneStart = source.indexOf('\n  return (\n    <EveningSceneShell');
const standaloneBlock = source.slice(standaloneStart, nonStandaloneStart);

// Anytime Breathing completion correction — supersedes the render-time-
// derived `isComplete` this whole file's own top doc comment describes:
// isComplete was still a render-time-DERIVED value (the same defect class
// Morning/Evening breathing had before their own fixes). Standalone now
// uses a pure, synchronous createBreathingSession controller (mirroring
// Breathe.jsx exactly - see quietBreathingAnytimeCompletionLifecycle.
// test.js for the full, dedicated coverage), with the explicit isCompleted
// state set inside its own completion-detecting interval callback.
// Non-standalone (Support) is completely unaffected - see its own
// dedicated describe block at the bottom of this file.
describe('QuietBreathing.jsx (standalone) — isCompleted is an explicit, authoritative state, never a render-time-derived guess', () => {
  it('isCompleted is real React state, not derived from secondsLeft on every render', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
    expect(source).not.toMatch(/const isComplete = standalone && hasBegun && secondsLeft <= 0;/);
  });

  it('the standalone completion-detecting interval callback stops itself and any playing music synchronously, in the same step that sets isCompleted', () => {
    const standaloneEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!standalone\) return;\s*\n\s*if \(!hasBegun \|\| earlyEnded \|\| isCompleted \|\| endConfirmOpen\) return;[\s\S]*?\n\s*\}, \[standalone, hasBegun, earlyEnded, isCompleted, endConfirmOpen, journeyTone\]\);/)?.[0] ?? '';
    expect(standaloneEffect).not.toBe('');
    const completedBranch = standaloneEffect.match(/if \(completed\) \{([\s\S]*?)setIsCompleted\(true\);\s*\n\s*\}/)?.[1] ?? '';
    expect(completedBranch).not.toBe('');
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
    expect(completedBranch).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
  });

  it('the non-standalone (Support) interval effect still navigates directly at secondsLeft <= 0 - completely unaffected by the standalone-only rewrite', () => {
    const nonStandaloneEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(standalone\) return;\s*\n\s*if \(awaitingMusicChoice\) return;[\s\S]*?\n\s*\}, \[[^\]]*\]\);/)?.[0] ?? '';
    expect(nonStandaloneEffect).toMatch(/if \(secondsLeft <= 0\) \{\s*\n\s*navigate\(completionRoute\);\s*\n\s*return;\s*\n\s*\}/);
  });
});

describe('QuietBreathing.jsx (standalone) — active phase: no Continue, only "End early", never claims completion', () => {
  // Early-end result correction — found live: this handler used to stop
  // music and navigate(backFallback) directly, with zero confirmation.
  // It now opens the same confirm dialog Back uses (endConfirmSource
  // 'button'), and only actually stops the session once confirmed - see
  // standaloneBreathe.test.js's dedicated "Early-end result correction"
  // describe block for the full confirm-through-to-result-panel coverage.
  it('handleEndEarly captures whether music was playing and opens the shared confirm dialog (tagged as the "button" source) rather than acting immediately - it never touches isCompleted', () => {
    const body = source.match(/const handleEndEarly = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    expect(body).toMatch(/setEndConfirmSource\('button'\);/);
    expect(body).toMatch(/setEndConfirmOpen\(true\);/);
    expect(body).not.toMatch(/isCompleted/);
  });

  it('the active-phase render (hasBegun, not complete, not earlyEnded) has exactly one button, "End early", and no "Continue"/"Skip" pair', () => {
    const activePhase = standaloneBlock.slice(standaloneBlock.indexOf("Just breathe. There is nowhere else to be."));
    const firstButtonsBlock = activePhase.slice(0, activePhase.indexOf('Explore guided breathing sessions'));
    expect(firstButtonsBlock).toMatch(/onClick=\{handleEndEarly\}/);
    expect(firstButtonsBlock).toMatch(/End early/);
    expect(firstButtonsBlock).not.toMatch(/>Continue</);
    expect(firstButtonsBlock).not.toMatch(/handleAdvance/);
  });
});

describe('QuietBreathing.jsx (standalone) — natural completion: distinct "Breathing complete" screen', () => {
  // The result-panel ternary now also covers earlyEnded (see the
  // dedicated "Early-end result correction" describe block in
  // standaloneBreathe.test.js) - this file keeps its focus on the
  // genuine natural-completion path, which is otherwise unchanged.
  it('isCompleted (or earlyEnded) renders before the !hasBegun/active ternary, with the exact required natural-completion heading, and an honest, journey-aware acknowledgement (mobile correction #4) for non-Anytime tones rather than a hardcoded string', () => {
    expect(standaloneBlock).toMatch(/\{showCompletionPanel \? \(/);
    expect(standaloneBlock).toMatch(/Breathing complete/);
    expect(standaloneBlock).toMatch(/getBreathingAcknowledgement\(journeyTone\)/);
    expect(standaloneBlock).not.toMatch(/Take a moment to notice how you feel\./);
  });

  it('primary "Done" navigates to Home ("/"), secondary "Breathe again" calls handleBreatheAgain', () => {
    // Completion-transition-tuning pass — these actions now render as
    // their own sibling, gated on the RAW isCompleted || earlyEnded
    // (immediate, never delayed behind CompletionReveal's own hold+
    // exit-fade+stagger sequence), so they're checked against the wider
    // standaloneBlock rather than the narrower CompletionReveal-only
    // completionBlock slice.
    // Context-aware Breathing/Meditation theming — Done routes through
    // the centralized exitPracticeToHome helper (clears the captured
    // practice journey tone, then navigates) - see practiceJourneyContext.js.
    expect(standaloneBlock).toMatch(/\{\(isCompleted \|\| earlyEnded\) && \(/);
    expect(standaloneBlock).toMatch(/onClick=\{\(\) => exitPracticeToHome\(navigate, '\/'\)\}[\s\S]*?Done/);
    expect(standaloneBlock).toMatch(/onClick=\{handleBreatheAgain\}[\s\S]*?Breathe again/);
  });

  it('handleBreatheAgain resets the double-tap guard, hasBegun, earlyEnded, isCompleted and completionGreeting - returning to this screen\'s own setup, not a direct restart', () => {
    const body = source.match(/const handleBreatheAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
    expect(body).toMatch(/setHasBegun\(false\);/);
    expect(body).toMatch(/setEarlyEnded\(false\);/);
    expect(body).toMatch(/setIsCompleted\(false\);/);
    expect(body).toMatch(/setCompletionGreeting\(null\);/);
  });

  it('InteractiveAmbientMusic hides its toggle once complete too, alongside the existing pre-start hide', () => {
    expect(standaloneBlock).toMatch(/hideToggle=\{!hasBegun \|\| isCompleted\}/);
  });
});

describe('QuietBreathing.jsx — non-standalone (Support) branch is completely untouched', () => {
  const nonStandaloneBlock = source.slice(nonStandaloneStart);

  it('still uses the original handleAdvance for both Continue and Skip - no End early/isComplete concept here', () => {
    const advanceCalls = nonStandaloneBlock.match(/onClick=\{handleAdvance\}/g) ?? [];
    expect(advanceCalls.length).toBe(2);
    expect(nonStandaloneBlock).not.toMatch(/isComplete|handleEndEarly|handleBreatheAgain/);
  });

  it('handleAdvance itself is unchanged - a plain navigate(completionRoute), still used by non-standalone', () => {
    expect(source).toMatch(/const handleAdvance = \(\) => \{\s*\n\s*navigate\(completionRoute\);\s*\n\s*\};/);
  });
});
