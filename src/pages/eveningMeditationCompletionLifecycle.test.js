// Evening Meditation completion correction — reuses MorningMeditate.jsx's
// approved, physical-iPhone-tested completion-panel architecture for
// Evening Meditation. Like Morning, Evening's own timer/controller
// (useMeditationSession.js - meditationSessionController.js underneath,
// proven/real-execution tested elsewhere) was ALREADY the authoritative,
// single-interval pattern - no new pure controller was needed here. The
// only change is intercepting its existing onComplete callback (which
// fires only AFTER cleanupSession()/setPhase('setup') have already run -
// see useMeditationSession.js's own doc comment) to show a dedicated
// completion panel instead of silently falling through to the ordinary
// setup screen.
//
// Source-level checks only (no DOM rendering available in this repo's
// Vitest), matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./EveningMeditate.jsx');

describe('EveningMeditate.jsx — completion is an explicit, authoritative state, checked before the render falls through to the ordinary setup screen', () => {
  it('isCompleted/completionGreeting are real React state, dedicated to this page', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
    expect(source).toMatch(/const \[completionGreeting, setCompletionGreeting\] = useState\(null\);/);
  });

  it('handleNaturalCompletion is the ONE place that picks the greeting and sets isCompleted - it never navigates or mirrors itself', () => {
    const fn = source.match(/const handleNaturalCompletion = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/setCompletionGreeting\(getCompletionGreeting\(\{ journey: 'evening', practice: 'meditation' \}\)\);/);
    expect(fn).toMatch(/setIsCompleted\(true\);/);
    expect(fn).not.toMatch(/mirrorMeditateExitRef|navigate\(/);
  });

  it('handleNaturalCompletion (not advanceToPrepareForRest) is wired as useMeditationSession\'s onComplete - the hook\'s own timer is the single source of truth for natural completion', () => {
    expect(source).toMatch(/const session = useMeditationSession\(\{\s*\n\s*initialStyleId: 'quiet',\s*\n\s*initialDurationId: '5min',\s*\n\s*initialSoundId: 'IM02',\s*\n\s*onComplete: handleNaturalCompletion\s*\n\s*\}\);/);
  });

  it('the isCompleted branch is checked (and returns) before the session.phase === \'active\' branch, since useMeditationSession.js has already flipped phase back to \'setup\' by the time onComplete fires', () => {
    const isCompletedIndex = source.indexOf('if (isCompleted) {');
    const activePhaseIndex = source.indexOf("if (session.phase === 'active' && session.snapshot) {");
    expect(isCompletedIndex).toBeGreaterThan(-1);
    expect(activePhaseIndex).toBeGreaterThan(-1);
    expect(isCompletedIndex).toBeLessThan(activePhaseIndex);
  });
});

describe('EveningMeditate.jsx — completion greeting is picked exactly once per completion, held stable, never re-picked on re-render', () => {
  it('completionGreeting is set only from the shared getCompletionGreeting({journey: \'evening\', practice: \'meditation\'}) API - never an independent, hand-rolled random array', () => {
    const setterCalls = source.match(/setCompletionGreeting\([^)]*\)/g) ?? [];
    // One real pick (handleNaturalCompletion) and one reset to null
    // (countdown.onComplete beginning a fresh run) - never a third,
    // render-time call.
    expect(setterCalls.filter((c) => c.includes("getCompletionGreeting({ journey: 'evening', practice: 'meditation' })")).length).toBe(1);
    expect(setterCalls.filter((c) => c.includes('null')).length).toBe(1);
  });

  it('the completed panel renders the held completionGreeting value directly - never calls getCompletionGreeting again in JSX', () => {
    const completedPanel = source.match(/if \(isCompleted\) \{([\s\S]*?)\n {2}\}\s*\n\s*\n {2}if \(session\.phase === 'active'/)?.[1] ?? '';
    expect(completedPanel).not.toBe('');
    expect(completedPanel).toMatch(/\{completionGreeting\}/);
    expect(completedPanel).not.toMatch(/getCompletionGreeting\(/);
  });
});

describe('EveningMeditate.jsx — dedicated completion panel is its own full-tree return branch, never overlaid on top of setup/active', () => {
  const completedPanel = source.match(/if \(isCompleted\) \{([\s\S]*?)\n {2}\}\s*\n\s*\n {2}if \(session\.phase === 'active'/)?.[1] ?? '';

  it('the completed branch contains no MeditationSetupPanel and no MeditationActiveSession - the active/setup views are gone, not hidden behind it', () => {
    expect(completedPanel).not.toBe('');
    expect(completedPanel).not.toMatch(/MeditationSetupPanel/);
    expect(completedPanel).not.toMatch(/MeditationActiveSession/);
  });

  it('shows the required periwinkle "Meditation Completed" label, reusing existing Evening tokens (bg-evening-accent/shadow-evening-glow - never the Morning gold or Anytime mint treatment)', () => {
    expect(completedPanel).toMatch(/Meditation Completed/);
    expect(completedPanel).toMatch(/bg-evening-accent\/10 border border-evening-accent-tint\/25 shadow-evening-glow/);
    expect(completedPanel).toMatch(/text-evening-accent/);
  });

  it('reuses the existing EveningSceneShell with a plain, unconfirmed Back to /evening-breathing and showExit - Back-after-completion is ordinary navigation, never an early-exit confirmation (there is no active timer/audio left to protect)', () => {
    expect(completedPanel).toMatch(/<EveningSceneShell atmosphere=\{\{ phase: 'moonlight' \}\} showBack backFallback="\/evening-breathing" showExit>/);
  });
});

describe('EveningMeditate.jsx — Continue to Prepare for Rest (required primary action, existing approved destination, never a new route)', () => {
  it('the completed panel\'s primary button calls advanceToPrepareForRest directly and is labelled with this file\'s own already-established phrasing for this exact transition (skipLabel already uses "Continue to Prepare for Rest" - kept consistent, not shortened to a new "Continue to Rest")', () => {
    const completedPanel = source.match(/if \(isCompleted\) \{([\s\S]*?)\n {2}\}\s*\n\s*\n {2}if \(session\.phase === 'active'/)?.[1] ?? '';
    expect(completedPanel).toMatch(/onClick=\{advanceToPrepareForRest\}/);
    expect(completedPanel).toMatch(/<span>Continue to Prepare for Rest<\/span>/);
  });

  it('advanceToPrepareForRest (the renamed, otherwise-unchanged former handleComplete) mirrors the Session Engine transition then navigates to /prepare-for-rest - reused verbatim by Skip and Finish & continue, never a second, divergent path', () => {
    const fn = source.match(/const advanceToPrepareForRest = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/mirrorMeditateExitRef\.current\(\);/);
    expect(fn).toMatch(/navigate\('\/prepare-for-rest'\);/);
    expect(source).toMatch(/const handleSkip = \(\) => advanceToPrepareForRest\(\);/);
    const finishFn = source.match(/const handleFinishAndContinue = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(finishFn).toMatch(/session\.endSession\(\);/);
    expect(finishFn).toMatch(/advanceToPrepareForRest\(\);/);
  });
});

describe('EveningMeditate.jsx — deliberate early finish (Finish & continue) and Skip never show the completed panel or double-record', () => {
  it('handleFinishAndContinue and handleSkip never touch isCompleted/completionGreeting/getCompletionGreeting - neither can show "Meditation Completed"', () => {
    const finishFn = source.match(/const handleFinishAndContinue = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(finishFn).not.toMatch(/isCompleted|completionGreeting|getCompletionGreeting/);
    expect(source).toMatch(/const handleSkip = \(\) => advanceToPrepareForRest\(\);/);
  });

  it('MeditationActiveSession\'s onRequestLeave (handleEndMeditation, End Meditation) never sets isCompleted - ending early is structurally distinct from natural completion', () => {
    const activeBranch = source.match(/if \(session\.phase === 'active' && session\.snapshot\) \{([\s\S]*?)\n {2}\}\s*\n\s*\n {2}return \(/)?.[1] ?? '';
    expect(activeBranch).not.toBe('');
    expect(activeBranch).toMatch(/onRequestLeave=\{handleEndMeditation\}/);
    expect(activeBranch).not.toMatch(/isCompleted/);
  });
});

describe('EveningMeditate.jsx — repeated-run use in one mounted visit (sequential-completion guard)', () => {
  it('every real Begin (countdown.onComplete) resets isCompleted/completionGreeting before calling session.begin() - a second meditation this visit never inherits a stale completed state', () => {
    const countdownBlock = source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(countdownBlock).not.toBe('');
    expect(countdownBlock).toMatch(/setIsCompleted\(false\);/);
    expect(countdownBlock).toMatch(/setCompletionGreeting\(null\);/);
    expect(countdownBlock).toMatch(/session\.begin\(\);/);
  });
});
