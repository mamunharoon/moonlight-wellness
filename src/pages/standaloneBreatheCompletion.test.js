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

describe('QuietBreathing.jsx (standalone) — isComplete is a plain derived value, never its own state', () => {
  it('isComplete = standalone && hasBegun && secondsLeft <= 0 - true only during a genuinely active standalone run that has reached 0', () => {
    expect(source).toMatch(/const isComplete = standalone && hasBegun && secondsLeft <= 0;/);
    expect(source).not.toMatch(/const \[isComplete, setIsComplete\]/);
  });

  it('a dedicated effect stops any playing music exactly once isComplete becomes true - no setState in this effect (avoids the set-state-in-effect lint violation the naive version hit)', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(isComplete\) musicPlayerRef\.current\?\.stop\(\);\s*\n\s*\}, \[isComplete\]\);/);
    expect(body).not.toBeNull();
  });

  it('the countdown effect no longer navigates for standalone at secondsLeft <= 0 - only non-standalone (Support) still navigates to completionRoute', () => {
    const body = source.match(/if \(secondsLeft <= 0\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(body).toMatch(/if \(!standalone\) navigate\(completionRoute\);/);
  });
});

describe('QuietBreathing.jsx (standalone) — active phase: no Continue, only "End early", never claims completion', () => {
  it('handleEndEarly stops music and navigates to backFallback (Home for standalone) - it never touches isComplete', () => {
    const body = source.match(/const handleEndEarly = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(body).toMatch(/navigate\(backFallback\);/);
    expect(body).not.toMatch(/isComplete/);
  });

  it('the active-phase render (hasBegun, not complete) has exactly one button, "End early", and no "Continue"/"Skip" pair', () => {
    const activePhase = standaloneBlock.slice(standaloneBlock.indexOf("Just breathe. There is nowhere else to be."));
    const firstButtonsBlock = activePhase.slice(0, activePhase.indexOf('Explore guided breathing sessions'));
    expect(firstButtonsBlock).toMatch(/onClick=\{handleEndEarly\}/);
    expect(firstButtonsBlock).toMatch(/End early/);
    expect(firstButtonsBlock).not.toMatch(/>Continue</);
    expect(firstButtonsBlock).not.toMatch(/handleAdvance/);
  });
});

describe('QuietBreathing.jsx (standalone) — natural completion: distinct "Breathing complete" screen', () => {
  it('isComplete renders before the !hasBegun/active ternary, with the exact required heading/subtext', () => {
    expect(standaloneBlock).toMatch(/\{isComplete \? \(/);
    expect(standaloneBlock).toMatch(/Breathing complete/);
    expect(standaloneBlock).toMatch(/Take a moment to notice how you feel\./);
  });

  it('primary "Done" navigates to Home ("/"), secondary "Breathe again" calls handleBreatheAgain', () => {
    const completionBlock = standaloneBlock.slice(standaloneBlock.indexOf('{isComplete ? ('), standaloneBlock.indexOf(') : !hasBegun ? ('));
    expect(completionBlock).toMatch(/onClick=\{\(\) => navigate\('\/'\)\}[\s\S]*?Done/);
    expect(completionBlock).toMatch(/onClick=\{handleBreatheAgain\}[\s\S]*?Breathe again/);
  });

  it('handleBreatheAgain resets the double-tap guard and hasBegun - returning to this screen\'s own setup, not a direct restart (isComplete falls back to false automatically once hasBegun is false, since it is a derived value)', () => {
    const body = source.match(/const handleBreatheAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
    expect(body).toMatch(/setHasBegun\(false\);/);
  });

  it('InteractiveAmbientMusic hides its toggle once complete too, alongside the existing pre-start hide', () => {
    expect(standaloneBlock).toMatch(/hideToggle=\{!hasBegun \|\| isComplete\}/);
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
