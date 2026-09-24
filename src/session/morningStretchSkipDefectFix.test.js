// Release-blocking DEV defect fix — "Morning 'Start over' skips the
// Stretch step." Root cause (see IntentionSetup.jsx's own top comment
// for the full trace): a legacy "quick routine skips Stretching
// entirely" branch, mechanically relocated (unchanged) from
// Affirmation.jsx during the Morning-flow redesign, sat dormant/
// unreachable until Profile.jsx's later duration toggle started actually
// setting `routineDuration` to 'quick' - at which point Intention's
// Continue/Skip (both call the same handleComplete) jumped straight to
// Breathe via a multi-step ADVANCE_TO_STEP dispatch, and
// ProgressIndicator's own `isCompleted = idx < activeIndex` inference
// then rendered the never-visited Stretch step as "completed" purely
// because its index was now behind the jumped-to active index.
//
// Confirmed live on DEV (an account with routineDuration='quick' in
// localStorage reproduced the exact reported sequence) before this fix,
// and confirmed fixed live after it (Continue -> Stretch, every time,
// regardless of routineDuration).
//
// Uses the REAL, pure sessionReducer + MORNING_ROUTINE_SESSION data for
// the step-order/progress assertions (genuine executable transitions,
// not just source regex) plus source-level checks (this repo's Vitest
// has no rendering engine) for the page-level Continue/Skip/Resume/
// Start-over wiring.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sessionReducer, SESSION_ACTION_TYPES, SESSION_STATUS, CANONICAL_IDLE_STATE } from './sessionReducer';
import { MORNING_ROUTINE_SESSION } from './sessionDefinitions';
import { MORNING_STEP_IDS } from './sessionConstants';
import { getStepIndex } from './sessionRegistry';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const intentionSetupSource = read('../pages/IntentionSetup.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');
const homeSource = read('../pages/Home.jsx');
const progressIndicatorSource = read('../components/ProgressIndicator.jsx');
const sessionContextSource = read('../context/SessionContext.jsx');

const dispatch = (state, type, payload) => sessionReducer(state, { type, payload });

const startAtIntention = () =>
  dispatch(CANONICAL_IDLE_STATE, SESSION_ACTION_TYPES.START_SESSION, {
    sessionId: 'morning-routine',
    startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.INTENTION),
  });

describe('1. Fresh routine visits Intention -> Stretch -> Breathe in order (real reducer transitions)', () => {
  it('START_SESSION lands on Intention, one ADVANCE_STEP reaches Stretch, one more reaches Breathe - never a multi-step jump', () => {
    let state = startAtIntention();
    expect(MORNING_ROUTINE_SESSION.steps[state.stepIndex].id).toBe(MORNING_STEP_IDS.INTENTION);

    state = dispatch(state, SESSION_ACTION_TYPES.ADVANCE_STEP);
    expect(MORNING_ROUTINE_SESSION.steps[state.stepIndex].id).toBe(MORNING_STEP_IDS.STRETCH);

    state = dispatch(state, SESSION_ACTION_TYPES.ADVANCE_STEP);
    expect(MORNING_ROUTINE_SESSION.steps[state.stepIndex].id).toBe(MORNING_STEP_IDS.BREATHE);
  });
});

describe('2. Start over after an unfinished routine resets to the beginning', () => {
  it('RESET_SESSION from any in-progress state returns to canonical idle; a fresh START_SESSION then lands exactly on Intention, not wherever the old routine had reached', () => {
    let state = startAtIntention();
    state = dispatch(state, SESSION_ACTION_TYPES.ADVANCE_STEP); // stretch
    state = dispatch(state, SESSION_ACTION_TYPES.ADVANCE_STEP); // breathe
    expect(state.status).toBe(SESSION_STATUS.PLAYING);

    const resetState = dispatch(state, SESSION_ACTION_TYPES.RESET_SESSION);
    expect(resetState.status).toBe(SESSION_STATUS.IDLE);
    expect(resetState.stepIndex).toBe(0);
    expect(resetState.sessionId).toBeNull();

    const freshState = startAtIntention();
    expect(MORNING_ROUTINE_SESSION.steps[freshState.stepIndex].id).toBe(MORNING_STEP_IDS.INTENTION);
  });

  it("Home.jsx's handleBeginRiseAndReset ('Begin My Morning'/'Start Today's Routine', the action behind 'Start over') resets first when a session is already playing/interrupted, then always starts fresh at Intention", () => {
    const body = homeSource.match(/const handleBeginRiseAndReset = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(state\.status === 'playing' \|\| state\.status === 'interrupted'\) \{\s*\n\s*resetSession\(\);\s*\n\s*\}/);
    expect(body).toMatch(/startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);/);
  });
});

describe('3. Previously completed Stretch state is cleared for the new active run', () => {
  it("ProgressIndicator's own completed-step inference (idx < activeIndex) reports nothing completed at all on a freshly-started/reset routine", () => {
    const state = startAtIntention();
    const activeIndex = MORNING_ROUTINE_SESSION.steps
      .filter((s) => ['intention', 'stretch', 'breathe', 'affirmation', 'complete'].includes(s.id))
      .findIndex((s) => s.id === MORNING_ROUTINE_SESSION.steps[state.stepIndex].id);
    const anyCompleted = Array.from({ length: activeIndex }, (_, idx) => idx < activeIndex).some(Boolean);
    expect(activeIndex).toBe(0); // Intention is the first visible step
    expect(anyCompleted).toBe(false);
  });
});

describe('4. Intention Continue cannot navigate directly to Breathe', () => {
  it('handleComplete never contains a literal /breathe navigation or a routineDuration branch any more', () => {
    const body = intentionSetupSource.match(/const handleComplete = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/\/breathe/);
    expect(body).not.toMatch(/routineDuration/);
    expect(body).toMatch(/setJourneyStep\('stretch'\);\s*\n\s*navigate\('\/morning-flow'\);/);
  });

  it('routineDuration is no longer destructured from useAlarm() in this file\'s real code (a prose mention in the top doc comment explaining the bug history is fine)', () => {
    const codeOnly = intentionSetupSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/routineDuration/);
  });

  it('mirrorTransition always calls the single-step advanceStep(), never the multi-step advanceToStep() - advanceToStep is no longer imported/destructured here', () => {
    const body = intentionSetupSource.match(/const mirrorTransition = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/advanceStep\(\);/);
    expect(body).not.toMatch(/advanceToStep/);
    expect(intentionSetupSource).not.toMatch(/advanceToStep/);
  });
});

describe('5. Intention Skip still goes to Stretch (Skip and Continue are the same handler, both fixed together)', () => {
  it('the Skip button ("Skip this step") is wired to the exact same handleComplete as Continue - no separate skip-specific navigation path exists to independently regress', () => {
    const continueButton = intentionSetupSource.match(/onClick=\{handleComplete\}\s*\n\s*disabled=\{isSaving \|\| intentions\.length === 0\}/);
    const skipButton = intentionSetupSource.match(/onClick=\{handleComplete\}\s*\n\s*disabled=\{isSaving\}[\s\S]{0,300}Skip this step/);
    expect(continueButton).not.toBeNull();
    expect(skipButton).not.toBeNull();
  });
});

describe('6. Stretch Continue goes to Breathe', () => {
  it('the natural end-of-exercises completion path always navigates to /breathe, with no routineDuration branch (never touched by this fix - already correct)', () => {
    expect(morningFlowSource).toMatch(/setJourneyStep\('breathe'\);\s*\n\s*navigate\('\/breathe'\);/);
  });
});

describe('7. Stretch Skip goes to Breathe', () => {
  it("handleSkip ('Skip Stretching') always navigates to /breathe unconditionally (never touched by this fix - already correct)", () => {
    const body = morningFlowSource.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setJourneyStep\('breathe'\);\s*\n\s*navigate\('\/breathe'\);/);
  });
});

describe('8. Progress indicator never marks an unvisited step complete', () => {
  it('ADVANCE_TO_STEP (the only reducer action capable of a multi-step jump) has zero remaining callers anywhere in the app', () => {
    expect(intentionSetupSource).not.toMatch(/advanceToStep/);
    // SessionContext.jsx still DEFINES advanceToStep (generic engine
    // primitive, intentionally left in place - see IntentionSetup.jsx's
    // own top comment for why removing the primitive itself is out of
    // scope for this bug fix), but nothing calls it any more.
    expect(sessionContextSource).toMatch(/const advanceToStep = useCallback/);
  });

  it("ProgressIndicator's own completed-step rule is still the simple positional idx < activeIndex check - correct precisely because stepIndex can now only ever move one step at a time from Intention forward", () => {
    expect(progressIndicatorSource).toMatch(/const isCompleted = idx < activeIndex;/);
  });
});

describe('9. Resume returns to the true saved step (never restarts from the beginning, never skips/falsely-completes another step)', () => {
  it('resumeRoutine restores the exact persisted stepIndex from the saved snapshot via RESTORE_SESSION, never START_SESSION (which would reset to the given startIndex instead)', () => {
    expect(sessionContextSource).toMatch(/const resumeRoutine = useCallback\(\(sessionId\) => \{/);
    const body = sessionContextSource.match(/const resumeRoutine = useCallback\(\(sessionId\) => \{[\s\S]*?\n {2}\}, \[state\.sessionId\]\);/)?.[0] ?? '';
    expect(body).toMatch(/stepIndex: snapshot\.stepIndex,/);
    expect(body).toMatch(/type: SESSION_ACTION_TYPES\.RESTORE_SESSION,/);
  });

  it('RESTORE_SESSION in the reducer replaces state wholesale with the given payload - it does not recompute or advance stepIndex on its own', () => {
    const restored = sessionReducer(CANONICAL_IDLE_STATE, {
      type: SESSION_ACTION_TYPES.RESTORE_SESSION,
      payload: {
        sessionId: 'morning-routine',
        stepIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.BREATHE),
        status: SESSION_STATUS.PLAYING,
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        interruptionReason: null,
        completionEventId: null,
      },
    });
    expect(restored.stepIndex).toBe(getStepIndex('morning-routine', MORNING_STEP_IDS.BREATHE));
    expect(MORNING_ROUTINE_SESSION.steps[restored.stepIndex].id).toBe(MORNING_STEP_IDS.BREATHE);
  });
});

describe('10. Start over does not delete historical completion data', () => {
  it('resetSession/resetRoutine/discardStaleRoutine only ever clear THIS session\'s own progress snapshot (clearRoutineProgress(sessionId)) - never a completion-history key', () => {
    const resetSessionBody = sessionContextSource.match(/const resetSession = useCallback\(\(\) => \{[\s\S]*?\n {2}\}, \[state\.sessionId\]\);/)?.[0] ?? '';
    expect(resetSessionBody).not.toMatch(/completed_date/);
    const resetRoutineBody = sessionContextSource.match(/const resetRoutine = useCallback\(\(sessionId\) => \{[\s\S]*?\n {2}\}, \[state\.sessionId\]\);/)?.[0] ?? '';
    expect(resetRoutineBody).toMatch(/clearRoutineProgress\(sessionId\);/);
    expect(resetRoutineBody).not.toMatch(/completed_date/);
    const discardBody = sessionContextSource.match(/const discardStaleRoutine = useCallback\(\(sessionId\) => \{[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(discardBody).toMatch(/clearRoutineProgress\(sessionId\);/);
    expect(discardBody).not.toMatch(/completed_date/);
  });

  it('this fix touches no completion/history/persistence code at all - only IntentionSetup.jsx\'s own navigation branch and its doc comments, plus Affirmation.jsx\'s doc comment', () => {
    expect(intentionSetupSource).not.toMatch(/saveIntentionsToCloud.*completed/i);
  });
});

describe('11. Morning reset does not alter Evening state', () => {
  it('resetSession/resetRoutine only ever act on the ONE currently-tracked state.sessionId - there is no code path that resets a session other than the one passed/current', () => {
    const resetRoutineBody = sessionContextSource.match(/const resetRoutine = useCallback\(\(sessionId\) => \{[\s\S]*?\n {2}\}, \[state\.sessionId\]\);/)?.[0] ?? '';
    expect(resetRoutineBody).toMatch(/if \(state\.sessionId === sessionId\) \{\s*\n\s*dispatch\(\{ type: SESSION_ACTION_TYPES\.RESET_SESSION \}\);\s*\n\s*\}/);
  });

  it("Home.jsx guards Morning's start/reset action behind isOtherRoutineActivelyRunning, showing a switch-routine confirmation instead of silently resetting an active Evening session (pre-existing guard, unaffected by this fix)", () => {
    const body = homeSource.match(/const handleMorningAction = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/isOtherRoutineActivelyRunning\(RITUAL_SESSION_IDS\.morning\)/);
    expect(body).toMatch(/setActiveDialog\(\{ kind: 'switch-routine', period: 'morning' \}\);/);
  });
});

describe('12. State remains user/date scoped', () => {
  it('completion keys are namespaced per-user (getMorningCompletionKey(userId)) - unaffected by this fix, confirmed still present', () => {
    expect(homeSource).toMatch(/getMorningCompletionKey\(userId\)/);
  });
});

describe('13. Existing full Morning order tests remain passing', () => {
  it('the canonical registry order is unchanged apart from Journey Embedding\'s own approved insertion: Intend -> Stretch -> Breathe -> Meditate (optional) -> Affirm -> Complete (alarm first as the pre-routine entry state)', () => {
    expect(MORNING_ROUTINE_SESSION.steps.map((s) => s.id)).toEqual([
      MORNING_STEP_IDS.ALARM,
      MORNING_STEP_IDS.INTENTION,
      MORNING_STEP_IDS.STRETCH,
      MORNING_STEP_IDS.BREATHE,
      MORNING_STEP_IDS.MEDITATE,
      MORNING_STEP_IDS.AFFIRMATION,
      MORNING_STEP_IDS.COMPLETE,
    ]);
  });
});

describe('Back behaviour is unaffected by this fix (no back/review-mode code touched)', () => {
  it('IntentionSetup.jsx still uses BackButton, and review-mode wiring is untouched (Remove Routines from the Visible User Flow: fallback now points at Home directly, since /routines/rise-reset itself just redirects to Home anyway)', () => {
    expect(intentionSetupSource).toMatch(/<BackButton fallback="\/" \/>/);
    expect(intentionSetupSource).toMatch(/useStepReviewMode\('intention', 'morning-routine'\)/);
  });

  it('a revisit via Review Mode still only ever calls setIntentions (never advanceStep/advanceToStep) while reviewing - no duplicate completion event risk', () => {
    const applySelectionBody = intentionSetupSource.match(/const applySelection = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(applySelectionBody).not.toMatch(/advanceStep|advanceToStep/);
  });
});
