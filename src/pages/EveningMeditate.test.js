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

  it('the primary action reads exactly "Begin 5-Minute Meditation"', () => {
    expect(source).toMatch(/beginLabel="Begin 5-Minute Meditation"/);
  });

  it('session-local: this hook instance is completely independent of Morning\'s or standalone\'s own selections', () => {
    const calls = source.match(/useMeditationSession\(/g) ?? [];
    expect(calls.length).toBe(1);
  });
});

describe('EveningMeditate.jsx — compact setup: purpose, recommended choice, disclosure, Skip', () => {
  it('renders MeditationSetupPanel in compact mode with a purpose string and an onSkip handler', () => {
    expect(source).toMatch(/<MeditationSetupPanel\s*\n\s*compact\s*\n\s*purpose=/);
    expect(source).toMatch(/onSkip=\{handleSkip\}/);
  });
});

describe('EveningMeditate.jsx — Skip and Complete both continue to Prepare for Rest, exactly once', () => {
  it('handleComplete mirrors the Session Engine transition then navigates to /prepare-for-rest - never to the standalone completion route', () => {
    const body = source.match(/const handleComplete = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/mirrorMeditateExitRef\.current\(\);/);
    expect(body).toMatch(/navigate\('\/prepare-for-rest'\);/);
    // Comments stripped first - this file's own doc comment legitimately
    // says "Completion NEVER navigates to /self-guided-meditation-complete"
    // in prose.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/self-guided-meditation-complete/);
  });

  it('handleSkip reuses handleComplete verbatim - one real transition path, not two', () => {
    expect(source).toMatch(/const handleSkip = \(\) => handleComplete\(\);/);
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

  it('onRequestLeave is session.endSession directly - no advanceStep/interruptSession/navigate wrapped around it', () => {
    expect(source).toMatch(/onRequestLeave=\{session\.endSession\}/);
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

describe('EveningMeditate.jsx — active screen: exactly ONE whole-journey Exit/X, structurally distinct from End Meditation (corrected)', () => {
  const activeBlock = () => source.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';

  it('EveningSceneShell keeps showExit visible on the active screen too - the whole-journey Exit/X is not removed, only the DUPLICATE header Close is suppressed', () => {
    const block = activeBlock();
    expect(block).toMatch(/<EveningSceneShell atmosphere=\{\{ phase: 'moonlight' \}\} showExit>/);
  });

  it('MeditationActiveSession\'s own header Close is suppressed via showHeaderClose={false} - its Back arrow and the big End Meditation button are unaffected and still render', () => {
    const block = activeBlock();
    expect(block).toMatch(/showHeaderClose=\{false\}/);
  });

  it('exactly one showExit occurrence total in the active block (EveningSceneShell\'s) - never a second exit-like prop/control', () => {
    // Comments stripped first - the doc comment right above this block
    // legitimately names "showExit (ExitEveningButton)" in prose.
    const codeOnlyBlock = activeBlock().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const showExitMatches = codeOnlyBlock.match(/showExit/g) ?? [];
    expect(showExitMatches.length).toBe(1);
  });

  it('the two controls invoke genuinely different callbacks: onRequestLeave is session.endSession (End Meditation only); EveningSceneShell\'s showExit renders ExitEveningButton, which calls its own leaveActiveRoutine()+navigate(\'/\') - never session.endSession, and this file never calls leaveActiveRoutine at all', () => {
    const block = activeBlock();
    expect(block).toMatch(/onRequestLeave=\{session\.endSession\}/);
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/leaveActiveRoutine/);
  });

  it('End Meditation preserves the parent journey exactly at Meditation - session.endSession never calls advanceStep/interruptSession/navigate (see useMeditationSession.test.js\'s own proof of endSession\'s real body)', () => {
    const block = activeBlock();
    // No local wrapper around onRequestLeave in this file - it is passed
    // the hook's endSession function directly, so its behaviour is
    // entirely governed by useMeditationSession.js's own endSession
    // (proven not to navigate/advance/interrupt in useMeditationSession.
    // test.js).
    expect(block).toMatch(/onRequestLeave=\{session\.endSession\}/);
    expect(block).not.toMatch(/advanceStep\(\)/);
    expect(block).not.toMatch(/interruptSession/);
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
