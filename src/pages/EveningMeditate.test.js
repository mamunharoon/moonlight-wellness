// Source-level regression guard for EveningMeditate.jsx (Journey Embedding,
// Phase 2) - matching this repo's established convention for logic not
// practically renderable in the `node`-environment Vitest this repo runs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./EveningMeditate.jsx', import.meta.url)), 'utf-8');
const appSource = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf-8');
const eveningBreathingSource = readFileSync(fileURLToPath(new URL('./EveningBreathing.jsx', import.meta.url)), 'utf-8');
const prepareForRestSource = readFileSync(fileURLToPath(new URL('./PrepareForRest.jsx', import.meta.url)), 'utf-8');

describe('App.jsx — route registered outside <Layout>, matching every other evening-wind-down step', () => {
  it('registers evening-meditate before the <Layout> Route opens', () => {
    const layoutIndex = appSource.indexOf('<Route path="/" element={<Layout />}>');
    const routeIndex = appSource.indexOf('<Route path="evening-meditate"');
    expect(routeIndex).toBeGreaterThan(0);
    expect(layoutIndex).toBeGreaterThan(routeIndex);
  });
});

describe('EveningMeditate.jsx — reuses the shared meditation modules, no duplicated logic', () => {
  it('imports useMeditationSession/MeditationSetupPanel/MeditationActiveSession - never a second implementation', () => {
    expect(source).toMatch(/import \{ useMeditationSession \} from '\.\.\/hooks\/useMeditationSession';/);
    expect(source).toMatch(/import \{ MeditationSetupPanel \} from '\.\.\/components\/journey\/MeditationSetupPanel';/);
    expect(source).toMatch(/import \{ MeditationActiveSession \} from '\.\.\/components\/journey\/MeditationActiveSession';/);
    expect(source).not.toMatch(/createMeditationSessionController\(/);
    expect(source).not.toMatch(/setInterval\(/);
  });

  it('reuses EveningSceneShell - the same full-bleed atmosphere/Back/Exit shell every other evening step already uses', () => {
    expect(source).toMatch(/import \{ EveningSceneShell \} from '\.\.\/components\/evening\/EveningSceneShell';/);
    expect(source).toMatch(/atmosphere=\{\{ phase: 'moonlight' \}\}/);
  });
});

describe('EveningMeditate.jsx — context-specific defaults: Quiet Meditation, 5 minutes, Soft Piano (IM02)', () => {
  it('seeds useMeditationSession with the exact approved Evening defaults', () => {
    const body = source.match(/const session = useMeditationSession\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).toMatch(/initialStyleId: 'quiet'/);
    expect(body).toMatch(/initialDurationId: '5min'/);
    expect(body).toMatch(/initialSoundId: 'IM02'/);
  });

  it('5 minutes remains recommended - getRecommendedDurationId() called with no context argument, exactly like standalone', () => {
    expect(source).toMatch(/recommendedDurationId=\{getRecommendedDurationId\(\)\}/);
  });

  // Pre-Build-15 defect fix — found live: the previous hardcoded
  // beginLabel="Begin 5-Minute Meditation" was only correct while the
  // duration stayed at its initial 5-minute seed; it went stale (never
  // updated) the moment the user picked 2 or 10 minutes in "Choose
  // style, time & sound". No longer supplied at all here - the live
  // "Begin N-Minute Meditation" is now computed inside
  // MeditationSetupPanel.jsx from the actual `duration` prop (already
  // passed just below), so it can never diverge from the real selection.
  it('never supplies a hardcoded beginLabel override - the live label is computed from the real duration prop (session.duration) inside MeditationSetupPanel.jsx instead', () => {
    expect(source).not.toMatch(/beginLabel=/);
    expect(source).toMatch(/duration=\{session\.duration\}/);
  });

  it('session-local: this hook instance is completely independent of Morning\'s or standalone\'s own selections', () => {
    const calls = source.match(/useMeditationSession\(/g) ?? [];
    expect(calls.length).toBe(1);
  });
});

describe('EveningMeditate.jsx — setup: heading, purpose, and a conditional onSkip handler', () => {
  it('renders MeditationSetupPanel (Meditation ↔ Breathing alignment correction: no more `compact` prop) with the exact approved heading/purpose and a conditional onSkip handler (Evening journey UX correction: hidden entirely in review mode, otherwise handleSkip)', () => {
    expect(source).toMatch(/<MeditationSetupPanel[\s\S]*?purpose=/);
    expect(source).not.toMatch(/<MeditationSetupPanel\s*\n\s*compact\s*\n/);
    expect(source).toMatch(/heading="Take a Mindful Pause"/);
    expect(source).toMatch(/purpose="A quiet pause before you rest\."/);
    expect(source).toMatch(/onSkip=\{isReviewMode \? undefined : handleSkip\}/);
    expect(source).toMatch(/skipLabel=\{hasStartedThisVisit \? 'Continue to Prepare for Rest' : 'Skip meditation'\}/);
  });
});

describe('EveningMeditate.jsx — Skip and Complete both continue to Prepare for Rest, exactly once', () => {
  // Evening Meditation completion correction — handleComplete was split
  // into advanceToPrepareForRest (the real mirror+navigate step, reached
  // by Skip, Finish & continue, and the new completed panel's Continue
  // action) and handleNaturalCompletion (which only shows the completed
  // panel - see eveningMeditationCompletionLifecycle.test.js for its own
  // dedicated coverage).
  it('advanceToPrepareForRest mirrors the Session Engine transition then navigates to /prepare-for-rest - never to the standalone completion route', () => {
    const body = source.match(/const advanceToPrepareForRest = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/mirrorMeditateExitRef\.current\(\);/);
    expect(body).toMatch(/navigate\('\/prepare-for-rest'\);/);
    // Comments stripped first - this file's own doc comment legitimately
    // says "Completion NEVER navigates to /self-guided-meditation-complete"
    // in prose.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/self-guided-meditation-complete/);
  });

  it('handleSkip reuses advanceToPrepareForRest verbatim - one real transition path, not two', () => {
    expect(source).toMatch(/const handleSkip = \(\) => advanceToPrepareForRest\(\);/);
  });

  it('the Session Engine mirror is guarded by a one-shot ref AND currentStep.id === \'meditation\' - the exact same double-guard pattern EveningBreathing.jsx already established, preventing a double advanceStep()', () => {
    const body = source.match(/mirrorMeditateExitRef\.current = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasMirroredExitRef\.current\) return;/);
    expect(body).toMatch(/hasMirroredExitRef\.current = true;/);
    expect(body).toMatch(/currentStep\?\.id === 'meditation'/);
    expect(body).toMatch(/advanceStep\(\);/);
  });
});

describe('EveningMeditate.jsx — registry wiring proves Breathing -> Meditation -> Prepare for Rest', () => {
  it('EveningBreathing.jsx now routes to /evening-meditate on completion and Skip/Advance (both call sites), never directly to /prepare-for-rest', () => {
    const matches = eveningBreathingSource.match(/navigate\('\/evening-meditate'\);/g) ?? [];
    expect(matches.length).toBe(2);
    expect(eveningBreathingSource).not.toMatch(/navigate\('\/prepare-for-rest'\);/);
  });

  it('PrepareForRest.jsx\'s own Back now returns to /evening-meditate, not directly to /evening-breathing - Meditation is the real preceding step', () => {
    expect(prepareForRestSource).toMatch(/backFallback="\/evening-meditate"/);
  });
});

describe('EveningMeditate.jsx — End Meditation (embedded copy), never advances/navigates/interrupts the parent journey', () => {
  it('the exact required embedded copy is passed as endCopy', () => {
    const block = source.match(/endCopy=\{\{[\s\S]*?\n {10}\}\}/)?.[0] ?? '';
    expect(block).toMatch(/buttonLabel: 'End Meditation'/);
    expect(block).toMatch(/dialogTitle: 'End this meditation\?'/);
    expect(block).toMatch(/confirmLabel: 'End Meditation'/);
    expect(block).toMatch(/cancelLabel: 'Keep Meditating'/);
  });

  it('onRequestLeave is handleEndMeditation - a thin wrapper adding Phase 9\'s honest stepOutcomes annotation (recordStepEndedEarly) around the original session.endSession() cleanup, still no advanceStep/interruptSession/navigate', () => {
    expect(source).toMatch(/onRequestLeave=\{handleEndMeditation\}/);
    const handlerBody = source.match(/const handleEndMeditation = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/recordStepEndedEarly\(\);/);
    expect(handlerBody).toMatch(/session\.endSession\(\);/);
    expect(handlerBody).not.toMatch(/navigate|advanceStep|interruptSession|leaveActiveRoutine/);
  });
});

describe('EveningMeditate.jsx — Back/Exit reuse Evening\'s existing split convention, no meditation-only exception', () => {
  it('pre-start Back has no confirmation (showBack, backFallback to /evening-breathing) - the same plain-navigate convention every other evening step already uses', () => {
    expect(source).toMatch(/showBack backFallback="\/evening-breathing"/);
  });

  it('pre-start screen: exactly one showExit, wired to EveningSceneShell\'s own unmodified ExitEveningButton', () => {
    const activeBlock = source.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    const preStartBlock = source.slice(source.indexOf(activeBlock) + activeBlock.length);
    expect(preStartBlock).toMatch(/showBack backFallback="\/evening-breathing" showExit/);
    // Comments stripped first - this file's own doc comment legitimately
    // names "ExitEveningButton" in prose, explaining that EveningSceneShell
    // renders it - it is never imported/duplicated in real code here.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/ExitEveningButton/);
  });
});

// Nested-shell correction (exercise-screen safe-area architecture) — the
// active screen no longer wraps MeditationActiveSession in
// EveningSceneShell (two independent full-viewport shells nested inside
// each other). MeditationActiveSession's own ExerciseScreenShell is now
// the one viewport/scroll owner and one protected header; the
// whole-journey Exit control is reproduced as MeditationActiveSession's
// own header Close, wired to this file's own onRequestClose handler
// (handleRequestExitRoutine -> leaveActiveRoutine()+navigate('/'), the
// exact same mechanism/copy ExitEveningButton.jsx used) - never a second,
// competing corner control.
describe('EveningMeditate.jsx — active screen: exactly ONE whole-journey Exit/X, structurally distinct from End Meditation (nested-shell correction)', () => {
  const activeBlock = () => source.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';

  it('no longer wraps MeditationActiveSession in EveningSceneShell - the moonlight atmosphere renders directly via AtmosphereManager instead, and MeditationActiveSession is the one real viewport/scroll owner', () => {
    const block = activeBlock();
    expect(block).not.toMatch(/<EveningSceneShell/);
    // Release-blocking runtime fix — this literal was previously
    // `z-[100]`, which painted the atmosphere ABOVE MeditationActiveSession's
    // own ExerciseScreenShell (a plain position:static root with no
    // stacking context of its own) - see eveningMeditateActiveStackingOrder.
    // test.js for the full root-cause trace and the real numeric-ordering
    // regression coverage this exact value change is proven against.
    expect(block).toMatch(/<AtmosphereManager phase="moonlight" className="fixed inset-0 -z-10 pointer-events-none" \/>/);
  });

  it('MeditationActiveSession\'s own header Close is now the whole-journey Exit, wired via onRequestClose to this file\'s own handleRequestExitRoutine - never suppressed with showHeaderClose={false}', () => {
    const block = activeBlock();
    expect(block).not.toMatch(/showHeaderClose=\{false\}/);
    expect(block).toMatch(/onRequestClose=\{handleRequestExitRoutine\}/);
  });

  it('handleRequestExitRoutine/handleConfirmExitRoutine reproduce ExitEveningButton\'s own gate and mechanism: no confirmation when nothing is genuinely active yet, otherwise leaveActiveRoutine()+navigate(\'/\') behind a confirm dialog', () => {
    const requestBody = source.match(/const handleRequestExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(requestBody).toMatch(/if \(!hasActiveEveningProgress\) \{/);
    expect(requestBody).toMatch(/navigate\('\/'\);/);
    expect(requestBody).toMatch(/setExitConfirmOpen\(true\);/);
    const confirmBody = source.match(/const handleConfirmExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmBody).toMatch(/leaveActiveRoutine\(\);/);
    expect(confirmBody).toMatch(/navigate\('\/'\);/);
  });

  it('the two controls invoke genuinely different callbacks: onRequestLeave is handleEndMeditation (End Meditation only, never leaveActiveRoutine); onRequestClose is handleRequestExitRoutine (the whole-journey exit, never session.endSession)', () => {
    const block = activeBlock();
    expect(block).toMatch(/onRequestLeave=\{handleEndMeditation\}/);
    expect(block).toMatch(/onRequestClose=\{handleRequestExitRoutine\}/);
    const handleEndMeditationBody = source.match(/const handleEndMeditation = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleEndMeditationBody).not.toMatch(/leaveActiveRoutine/);
  });

  it('End Meditation preserves the parent journey exactly at Meditation - handleEndMeditation (recordStepEndedEarly + session.endSession, Phase 9) never calls advanceStep/interruptSession/navigate (see useMeditationSession.test.js\'s own proof of endSession\'s real body)', () => {
    const block = activeBlock();
    expect(block).toMatch(/onRequestLeave=\{handleEndMeditation\}/);
    const handlerBody = source.match(/const handleEndMeditation = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/recordStepEndedEarly\(\);/);
    expect(handlerBody).toMatch(/session\.endSession\(\);/);
    expect(handlerBody).not.toMatch(/advanceStep\(\)/);
    expect(handlerBody).not.toMatch(/interruptSession/);
  });
});

describe('EveningMeditate.jsx — Review Mode wiring, consistent with every other Evening step', () => {
  it('uses the real Session Engine review hooks with the correct stepId/sessionId', () => {
    expect(source).toMatch(/useStepReviewMode\('meditation', 'evening-wind-down'\)/);
    expect(source).toMatch(/useReviewNavigation\(\{\s*\n\s*sessionId: 'evening-wind-down'/);
  });

  it('ProgressIndicator activeStep is "meditation" with the explicit sessionId prop (Evening pages always pass it - Morning is the default)', () => {
    expect(source).toMatch(/<ProgressIndicator activeStep="meditation" sessionId="evening-wind-down"/);
  });
});

describe('EveningMeditate.jsx — this feature never touches daily completion state directly', () => {
  it('never calls completeSession - only advanceStep, matching every other non-terminal Evening step', () => {
    expect(source).not.toMatch(/completeSession/);
  });
});
