// Embedded breathing Continue-lock/Skip-semantics fix — found live on
// Evening: "Continue was tappable with 50 seconds still remaining, and
// doing so marked the step as completed." Confirmed the identical defect
// also existed on Morning's Breathe.jsx (not Evening-only).
//
// Fix, both files: Continue is now hidden/disabled until the countdown
// genuinely reaches 0 (hasFinished); the timer effect stops instead of
// auto-navigating at 0, so a real tap is what records completion and
// advances. Skip is the one early-exit action available at any time, and
// now calls the Session Engine's own canonical, separately-validated
// skipStep() (validated against currentStep.skippable and 'playing'
// status by the reducer itself) instead of sharing Continue's
// completion-mirror path — so it can never be recorded as completing the
// step. No DOM/component rendering is available in this repo's Vitest -
// source-level checks, matching every other regression guard in this
// codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const breatheSource = read('./Breathe.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');
const sessionContextSource = read('../context/SessionContext.jsx');
const sessionReducerSource = read('../session/sessionReducer.js');

describe('Session Engine — skipStep is a real, separately-validated canonical action (not reused by this fix, pre-existing)', () => {
  it('SessionContext exposes skipStep, dispatching SKIP_STEP', () => {
    expect(sessionContextSource).toMatch(/const skipStep = useCallback\(\(\) => dispatch\(\{ type: SESSION_ACTION_TYPES\.SKIP_STEP \}\), \[\]\);/);
  });

  it('the reducer validates SKIP_STEP against \'playing\' status and currentStep.skippable, rejecting otherwise - genuinely distinct from a plain ADVANCE_STEP', () => {
    const body = sessionReducerSource.match(/case SESSION_ACTION_TYPES\.SKIP_STEP: \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(body).toMatch(/if \(state\.status !== SESSION_STATUS\.PLAYING\)/);
    expect(body).toMatch(/if \(!currentStep\?\.skippable\)/);
  });
});

describe.each([
  ['Breathe.jsx (Morning)', breatheSource, 'morning-flow', "'/morning-meditate'"],
  ['EveningBreathing.jsx (Evening)', eveningBreathingSource, undefined, "'/evening-meditate'"]
])('%s', (name, source, _unused, nextRoute) => {
  it('imports skipStep from useSession alongside advanceStep', () => {
    expect(source).toMatch(/useSession\(\)/);
    expect(source).toMatch(/skipStep/);
  });

  it('derives/reaches a completion signal without ever auto-navigating at the boundary - both files now use the explicit isCompleted state, driven by createBreathingSession (Morning breathing completion correction, then Evening Breathing completion correction)', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
    expect(source).not.toMatch(/const hasFinished = secondsLeft <= 0;/);
  });

  it('the countdown effect stops (no interval, no navigation) once completion is reached - it no longer auto-navigates at 0', () => {
    expect(source).not.toMatch(new RegExp(`if \\(secondsLeft <= 0\\) \\{\\s*\\n[\\s\\S]{0,200}navigate\\(${nextRoute}\\);`));
    // Both files' Back/early-exit corrections also added backConfirmOpen
    // to this same guard.
    expect(source).toMatch(/\|\| isCompleted \|\| backConfirmOpen\) return;/);
  });

  it('Skip calls skipStep(), never the completion-mirror/advanceStep path', () => {
    const skipBody = source.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(skipBody).toMatch(new RegExp(`navigate\\(${nextRoute}\\);`));
    expect(skipBody).toMatch(/skipStep\(\);/);
    expect(skipBody).not.toMatch(/advanceStep|mirror\w*Ref/);
  });

  it('Continue (handleComplete) is a genuinely separate handler from Skip, still using the completion-mirror/advanceStep path - only reachable once isCompleted, per the render gate below', () => {
    const completeBody = source.match(/const handleComplete = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(completeBody).toMatch(new RegExp(`navigate\\(${nextRoute}\\);`));
    expect(completeBody).toMatch(/mirror\w*Ref\.current\(\);/);
    expect(completeBody).not.toMatch(/skipStep/);
  });
});

describe('Breathe.jsx (Morning) — render gate', () => {
  it('Continue to Meditate is rendered only within the isCompleted branch of the completed-panel ternary (previously !isInterrupted alone - the exact reported defect; then hasFinished && !isInterrupted; now the explicit isCompleted state - see breathingCompletionLifecycle.test.js for the full completion-panel coverage)', () => {
    const completedBranch = breatheSource.match(/\{isCompleted \? \(([\s\S]*?)\n\s*\) : \(/)?.[1] ?? '';
    expect(completedBranch).not.toBe('');
    expect(completedBranch).toMatch(/onClick=\{handleComplete\}/);
    expect(completedBranch).toMatch(/Continue to Meditate/);
  });
});

describe('EveningBreathing.jsx (Evening) — render gate', () => {
  it('Continue to Meditate is rendered only within the isCompleted branch of the bottom-action ternary (previously hasFinished && !manuallyPaused alone - the exact reported defect; now the explicit isCompleted state - see eveningBreathingCompletionLifecycle.test.js for the full completion-panel coverage)', () => {
    const gated = eveningBreathingSource.match(/\{isCompleted \? \([\s\S]*?\n\s*\) : \(/)?.[0] ?? '';
    expect(gated).not.toBe('');
    expect(gated).toMatch(/onClick=\{handleComplete\}/);
  });

  it('the pre-start Skip button (before Begin is ever tapped) also uses handleSkip, not handleComplete', () => {
    const beginButtonIndex = eveningBreathingSource.indexOf('<span>Begin Breathing</span>');
    expect(beginButtonIndex).toBeGreaterThan(-1);
    // Widened from 400: Evening journey UX correction wraps this button in
    // an explanatory comment + `{!isReviewMode && (...)}` before the
    // onClick itself.
    const preStartBlock = eveningBreathingSource.slice(beginButtonIndex, beginButtonIndex + 800);
    expect(preStartBlock).toMatch(/onClick=\{handleSkip\}/);
  });
});
