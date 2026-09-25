// Source-level regression guard for MorningMeditate.jsx (Journey Embedding,
// Phase 2) - matching this repo's established convention for logic not
// practically renderable in the `node`-environment Vitest this repo runs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MorningMeditate.jsx', import.meta.url)), 'utf-8');
const appSource = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf-8');
const breatheSource = readFileSync(fileURLToPath(new URL('./Breathe.jsx', import.meta.url)), 'utf-8');
const affirmationSource = readFileSync(fileURLToPath(new URL('./Affirmation.jsx', import.meta.url)), 'utf-8');

describe('App.jsx — route registered outside <Layout>, matching standalone meditation\'s own chrome', () => {
  it('registers morning-meditate before the <Layout> Route opens', () => {
    const layoutIndex = appSource.indexOf('<Route path="/" element={<Layout />}>');
    const routeIndex = appSource.indexOf('<Route path="morning-meditate"');
    expect(routeIndex).toBeGreaterThan(0);
    expect(layoutIndex).toBeGreaterThan(routeIndex);
  });
});

describe('MorningMeditate.jsx — reuses the shared meditation modules, no duplicated logic', () => {
  it('imports useMeditationSession/MeditationSetupPanel/MeditationActiveSession - never a second implementation', () => {
    expect(source).toMatch(/import \{ useMeditationSession \} from '\.\.\/hooks\/useMeditationSession';/);
    expect(source).toMatch(/import \{ MeditationSetupPanel \} from '\.\.\/components\/journey\/MeditationSetupPanel';/);
    expect(source).toMatch(/import \{ MeditationActiveSession \} from '\.\.\/components\/journey\/MeditationActiveSession';/);
    expect(source).not.toMatch(/createMeditationSessionController\(/);
    expect(source).not.toMatch(/setInterval\(/);
  });
});

describe('MorningMeditate.jsx — context-specific defaults: Mindful Pause, 2 minutes, Gentle Ambient (IM01)', () => {
  it('seeds useMeditationSession with the exact approved Morning defaults', () => {
    const body = source.match(/const session = useMeditationSession\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).toMatch(/initialStyleId: 'mindful-pause'/);
    expect(body).toMatch(/initialDurationId: '2min'/);
    expect(body).toMatch(/initialSoundId: 'IM01'/);
  });

  it('2 minutes carries the Recommended badge via MEDITATION_CONTEXTS.MORNING_EMBEDDED - never mutating the shared registry\'s own 5min flag', () => {
    expect(source).toMatch(/recommendedDurationId=\{getRecommendedDurationId\(MEDITATION_CONTEXTS\.MORNING_EMBEDDED\)\}/);
  });

  it('the primary action reads exactly "Begin 2-Minute Meditation"', () => {
    expect(source).toMatch(/beginLabel="Begin 2-Minute Meditation"/);
  });

  it('session-local: this hook instance is completely independent of Evening\'s or standalone\'s own selections (a separate useMeditationSession() call, separate closure)', () => {
    // Comments stripped first - this file's own doc comment legitimately
    // mentions "useMeditationSession()" in prose.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const calls = codeOnly.match(/useMeditationSession\(/g) ?? [];
    expect(calls.length).toBe(1);
  });
});

describe('MorningMeditate.jsx — compact setup: purpose, recommended choice, disclosure, Skip', () => {
  it('renders MeditationSetupPanel in compact mode with a purpose string and an onSkip handler', () => {
    expect(source).toMatch(/<MeditationSetupPanel\s*\n\s*compact\s*\n\s*purpose=/);
    expect(source).toMatch(/onSkip=\{handleSkip\}/);
  });
});

describe('MorningMeditate.jsx — Skip and Complete both continue to Affirmation, exactly once', () => {
  it('handleComplete mirrors the Session Engine transition then navigates to /affirmation - never to the standalone completion route', () => {
    const body = source.match(/const handleComplete = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/mirrorMeditateExitRef\.current\(\);/);
    expect(body).toMatch(/setJourneyStep\('affirmation'\);/);
    expect(body).toMatch(/navigate\('\/affirmation'\);/);
    // Comments stripped first - this file's own doc comment legitimately
    // says "Completion NEVER navigates to /self-guided-meditation-complete"
    // in prose.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/self-guided-meditation-complete/);
  });

  it('handleSkip reuses handleComplete verbatim - one real transition path, not two', () => {
    expect(source).toMatch(/const handleSkip = \(\) => handleComplete\(\);/);
  });

  it('the Session Engine mirror is guarded by a one-shot ref AND currentStep.id === \'meditate\' - the exact same double-guard pattern Breathe.jsx already established, preventing a double advanceStep()', () => {
    const body = source.match(/mirrorMeditateExitRef\.current = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasMirroredExitRef\.current\) return;/);
    expect(body).toMatch(/hasMirroredExitRef\.current = true;/);
    expect(body).toMatch(/currentStep\?\.id === 'meditate'/);
    expect(body).toMatch(/advanceStep\(\);/);
  });
});

describe('MorningMeditate.jsx — registry wiring proves Breathe -> Meditate -> Affirm', () => {
  it('Breathe.jsx routes to /morning-meditate on Continue and Skip (two call sites - Continue-lock/Skip-semantics fix removed the timer effect\'s own third, auto-navigating call site: natural completion now only unlocks Continue, a real tap is what navigates - see embeddedBreathingContinueLock.test.js), never directly to /affirmation', () => {
    const matches = breatheSource.match(/navigate\('\/morning-meditate'\);/g) ?? [];
    expect(matches.length).toBe(2);
    expect(breatheSource).not.toMatch(/navigate\('\/affirmation'\);/);
  });

  it('Affirmation.jsx\'s own Back now returns to /morning-meditate, not directly to /breathe - Meditate is the real preceding step; guardActiveRoute is off (Back-navigation repair, Morning canonical map - see backNavigationCanonicalMap.test.js)', () => {
    expect(affirmationSource).toMatch(/<BackButton fallback="\/morning-meditate" guardActiveRoute=\{false\} \/>/);
  });
});

describe('MorningMeditate.jsx — End Meditation (embedded copy), never advances/navigates/interrupts the parent journey', () => {
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

describe('MorningMeditate.jsx — Back/Exit reuse Morning\'s existing conventions, no meditation-only exception', () => {
  it('pre-start Back falls back to /breathe with guardActiveRoute off (Back-navigation repair, Morning canonical map - see backNavigationCanonicalMap.test.js: the whole-routine "Leave this routine?" confirmation belongs only to Intention and to this screen\'s own active-phase Close/X, never to a plain previous-step Back)', () => {
    expect(source).toMatch(/<BackButton fallback="\/breathe" guardActiveRoute=\{false\} \/>/);
  });

  it('a plain, unconfirmed "Exit routine" link exists too, matching Affirmation.jsx/Breathe.jsx\'s own identical pattern exactly', () => {
    const body = source.match(/const handleExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setJourneyStep\(''\);/);
    expect(body).toMatch(/navigate\('\/'\);/);
    expect(body).toMatch(/abandonSession\(\);/);
    expect(source).toMatch(/Exit routine/);
  });
});

describe('MorningMeditate.jsx — Review Mode wiring, consistent with every other Morning step', () => {
  it('uses the real Session Engine review hooks with the correct stepId/sessionId', () => {
    expect(source).toMatch(/useStepReviewMode\('meditate', 'morning-routine'\)/);
    expect(source).toMatch(/useReviewNavigation\(\{\s*\n\s*sessionId: 'morning-routine'/);
  });

  it('ProgressIndicator activeStep is "meditate"', () => {
    expect(source).toMatch(/<ProgressIndicator activeStep="meditate"/);
  });
});

describe('MorningMeditate.jsx — this feature never touches daily completion state directly', () => {
  it('never calls completeSession - only advanceStep, matching every other non-terminal Morning step', () => {
    expect(source).not.toMatch(/completeSession/);
  });
});

describe('MorningMeditate.jsx — active screen: unaffected by the Evening-only duplicate-Close fix', () => {
  it('does not pass showHeaderClose - MeditationActiveSession keeps its own default (true), so Morning\'s active screen still renders both Back and Close, byte-identical to before the Evening fix (Morning has no competing wrapper-level exit control to overlap with)', () => {
    expect(source).not.toMatch(/showHeaderClose/);
  });
});

describe('MorningMeditate.jsx — active screen: Back/End Meditation and Close/X invoke genuinely different callbacks (correction, found live)', () => {
  it('onRequestLeave (Back arrow + the big End Meditation button, both wired inside MeditationActiveSession) is session.endSession - never leaveActiveRoutine/interruptSession/advanceStep/navigate, proven at its own real definition in useMeditationSession.test.js', () => {
    expect(source).toMatch(/onRequestLeave=\{session\.endSession\}/);
  });

  it('onRequestClose (Close/X) is a SEPARATE prop, wired to this page\'s own handleRequestExitRoutine - never the same function/value as onRequestLeave', () => {
    expect(source).toMatch(/onRequestClose=\{handleRequestExitRoutine\}/);
    const activeBlock = source.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(activeBlock).toMatch(/onRequestLeave=\{session\.endSession\}/);
    expect(activeBlock).toMatch(/onRequestClose=\{handleRequestExitRoutine\}/);
  });

  it('handleRequestExitRoutine only opens this page\'s own dialog - it never itself calls leaveActiveRoutine (that only happens after explicit confirmation, in a separate handler)', () => {
    const body = source.match(/const handleRequestExitRoutine = \(\) => [^\n;]+;/)?.[0] ?? '';
    expect(body).toBe('const handleRequestExitRoutine = () => setExitConfirmOpen(true);');
  });

  it('confirming calls the established leaveActiveRoutine() mechanism (useActiveRoutineStep.js - the same one BackButton.jsx\'s own "Leave this routine?" guard uses everywhere else in Morning), then navigates Home - exactly once, only from this one handler', () => {
    const body = source.match(/const handleConfirmExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setExitConfirmOpen\(false\);/);
    expect(body).toMatch(/leaveActiveRoutine\(\);/);
    expect(body).toMatch(/navigate\('\/'\);/);
    // Exactly one call site for leaveActiveRoutine in the whole file - the
    // active screen's Close/X confirmation, nowhere else.
    const leaveCalls = source.match(/leaveActiveRoutine\(\);/g) ?? [];
    expect(leaveCalls.length).toBe(1);
  });

  it('imports the real shared useActiveRoutineStep hook - never a hand-rolled reimplementation of interruptSession/journeyStep clearing', () => {
    expect(source).toMatch(/import \{ useActiveRoutineStep \} from '\.\.\/hooks\/useActiveRoutineStep';/);
    expect(source).toMatch(/const \{ leaveActiveRoutine \} = useActiveRoutineStep\(\);/);
  });

  it('cancelling ("Stay") only closes this page\'s own dialog - it never touches the meditation session (pause/end) or the parent journey, so a running meditation keeps running exactly as it was', () => {
    const dialogBlock = source.match(/<ConfirmDialog\s*\n\s*open=\{exitConfirmOpen\}[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/onDismiss=\{\(\) => setExitConfirmOpen\(false\)\}/);
    expect(dialogBlock).not.toMatch(/session\./);
  });

  it('the exit dialog reuses BackButton.jsx\'s own canonical "Leave this routine?" copy and severity verbatim - no new wording invented for this one screen', () => {
    const dialogBlock = source.match(/<ConfirmDialog\s*\n\s*open=\{exitConfirmOpen\}[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/title="Leave this routine\?"/);
    expect(dialogBlock).toMatch(/message="Your current progress may be paused\."/);
    expect(dialogBlock).toMatch(/confirmLabel="Leave routine"/);
    expect(dialogBlock).toMatch(/cancelLabel="Stay"/);
    expect(dialogBlock).toMatch(/destructive/);
    expect(dialogBlock).not.toMatch(/mildDestructive/);
  });
});

describe('MorningMeditate.jsx — the pre-start screen\'s own whole-routine exit paths are unaffected', () => {
  it('the "Exit routine" link (pre-start only) is preserved, not removed, and still uses its own existing abandonSession-based mechanism, independent of the new active-screen Close/X path', () => {
    expect(source).toMatch(/Exit routine/);
    expect(source).toMatch(/abandonSession\(\);/);
  });
});
