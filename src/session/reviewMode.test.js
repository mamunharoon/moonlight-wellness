// Regression guard for "safe backward navigation" (Review Mode) across
// the Morning and Evening routines. No DOM/component rendering is
// available in this repo's Vitest (see Home.routineState.test.js's own
// note) - source-level checks, matching every other regression guard in
// this codebase for exactly that reason, plus direct unit tests of the
// two genuinely pure/stateless pieces (useStepReviewMode, useReviewNavigation
// are hooks and need a real render to unit-test properly, so those two are
// also covered at the source level here rather than via @testing-library).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const useStepReviewModeSource = read('./useStepReviewMode.js');
const useReviewNavigationSource = read('./useReviewNavigation.js');
const progressIndicatorSource = read('../components/ProgressIndicator.jsx');
const reviewModeBannerSource = read('../components/ReviewModeBanner.jsx');
const promptStepperSource = read('../components/evening/PromptStepper.jsx');
const stepLabelsSource = read('../lib/stepLabels.js');
const routineResponsesSource = read('../lib/routineResponses.js');
const layoutSource = read('../components/Layout.jsx');
const routineRestoreGuardSource = read('../components/RoutineRestoreGuard.jsx');
const appSource = read('../App.jsx');
const timedExercisePauseSource = read('./timedExercisePause.js');

const breatheSource = read('../pages/Breathe.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');
const affirmationSource = read('../pages/Affirmation.jsx');
const intentionSetupSource = read('../pages/IntentionSetup.jsx');
const eveningWindDownSource = read('../pages/EveningWindDown.jsx');
const prepareForRestSource = read('../pages/PrepareForRest.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const reflectionSource = read('../pages/Reflection.jsx');
const gratitudeSource = read('../pages/Gratitude.jsx');

const ALL_STEP_PAGES = {
  Breathe: breatheSource,
  MorningFlow: morningFlowSource,
  Affirmation: affirmationSource,
  IntentionSetup: intentionSetupSource,
  EveningWindDown: eveningWindDownSource,
  PrepareForRest: prepareForRestSource,
  EveningBreathing: eveningBreathingSource,
  Reflection: reflectionSource,
  Gratitude: gratitudeSource,
};

const REPEAT_GATED_PAGES = {
  Breathe: breatheSource,
  MorningFlow: morningFlowSource,
  EveningBreathing: eveningBreathingSource,
};

describe('useStepReviewMode - the single source of truth for review vs. live', () => {
  it('never reads or writes stepIndex - a pure comparison of currentStep.id against this page\'s own stepId', () => {
    expect(useStepReviewModeSource).not.toMatch(/state\.stepIndex/);
    expect(useStepReviewModeSource).not.toMatch(/dispatch\(|advanceToStep\(|advanceStep\(/);
  });

  it('isReviewMode is only true while the session is genuinely active (playing/interrupted) AND currentStep differs from this page', () => {
    expect(useStepReviewModeSource).toMatch(
      /const sessionIsActive = state\.status === 'playing' \|\| state\.status === 'interrupted';/
    );
    expect(useStepReviewModeSource).toMatch(
      /const isReviewMode = sessionIsActive && Boolean\(currentStep\) && currentStep\.id !== stepId;/
    );
  });
});

describe('useReviewNavigation - shared navigation helper, never touches Session Engine state', () => {
  it('never imports or calls useSession/dispatch, nor reads/writes state.stepIndex', () => {
    expect(useReviewNavigationSource).not.toMatch(/import \{[^}]*useSession/);
    expect(useReviewNavigationSource).not.toMatch(/useSession\(\)|dispatch\(|state\.stepIndex/);
  });

  it('routeForStep resolves the target step\'s own registry route, defaulting to "/" if not found', () => {
    expect(useReviewNavigationSource).toMatch(
      /const routeForStep = \(stepId\) => getSessionById\(sessionId\)\?\.steps\.find\(\(s\) => s\.id === stepId\)\?\.route \?\? '\/';/
    );
  });

  it('requestReview only asks for confirmation when leaving the LIVE step with real unsaved progress - otherwise navigates immediately', () => {
    const body = useReviewNavigationSource.match(/const requestReview = \(stepId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isLiveStep && hasUnsavedProgress\) \{\s*\n\s*setPendingStepId\(stepId\);\s*\n\s*return;\s*\n\s*\}/);
    expect(body).toMatch(/navigate\(routeForStep\(stepId\)\);/);
  });

  it('cancelLeave never navigates - staying on the live step leaves it completely untouched', () => {
    expect(useReviewNavigationSource).toMatch(/const cancelLeave = \(\) => setPendingStepId\(null\);/);
  });

  it('confirmLeave navigates to the pending target and clears it, so a second call cannot re-fire the same navigation', () => {
    const body = useReviewNavigationSource.match(/const confirmLeave = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const target = pendingStepId;\s*\n\s*setPendingStepId\(null\);\s*\n\s*if \(target\) \{\s*\n\s*onLeaveLiveStep\?\.\(\);\s*\n\s*navigate\(routeForStep\(target\)\);\s*\n\s*\}/);
  });

  // Pause-and-resume-exact-state fix, found live: reviewing an earlier
  // step away from a running Breathe/Stretch/Evening-Breathing timer
  // unmounts that page, destroying its local countdown state - returning
  // showed "Exercise 1 of 4" again instead of resuming where it was.
  // onLeaveLiveStep lets those three pages snapshot their exact timer
  // state right before the navigate() that would otherwise lose it.
  it('onLeaveLiveStep is called synchronously before navigate() in confirmLeave, never in the immediate/no-confirmation path, never in cancelLeave', () => {
    expect(useReviewNavigationSource).toMatch(/onLeaveLiveStep\?\.\(\);\s*\n\s*navigate\(routeForStep\(target\)\);/);
    const requestReviewBody = useReviewNavigationSource.match(/const requestReview = \(stepId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(requestReviewBody).not.toMatch(/onLeaveLiveStep/);
    const cancelLeaveLine = useReviewNavigationSource.match(/const cancelLeave = .*/)?.[0] ?? '';
    expect(cancelLeaveLine).not.toMatch(/onLeaveLiveStep/);
  });
});

describe('timedExercisePause.js - pause-and-resume-exact-state for Breathe/Stretch/Evening-Breathing', () => {
  it('save/load/clear are keyed by stepId under a dedicated sessionStorage prefix', () => {
    expect(timedExercisePauseSource).toMatch(/const KEY_PREFIX = 'moonlight_paused_exercise_';/);
  });

  it('load never clears - the calling page is responsible for explicitly clearing once it has consumed the value', () => {
    const loadBody = timedExercisePauseSource.match(/export const loadPausedExerciseState = \(stepId\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(loadBody).not.toMatch(/removeItem/);
  });

  it('save/load/clear all fail silently (never throw) when storage is unavailable', () => {
    const fns = ['savePausedExerciseState', 'loadPausedExerciseState', 'clearPausedExerciseState'];
    for (const fn of fns) {
      const body = timedExercisePauseSource.match(new RegExp(`export const ${fn} = [\\s\\S]*?\\n\\};`))?.[0] ?? '';
      expect(body).toMatch(/catch/);
    }
  });
});

describe('ProgressIndicator.jsx - completed steps become real, focusable review buttons', () => {
  it('only completed steps (idx < activeIndex) with an onReviewStep handler render as buttons - current/future steps never do', () => {
    expect(progressIndicatorSource).toMatch(/const isCompleted = idx < activeIndex;/);
    expect(progressIndicatorSource).toMatch(/isCompleted && onReviewStep \? \(/);
  });

  it('the review button has a descriptive aria-label naming the step being reviewed', () => {
    expect(progressIndicatorSource).toMatch(/aria-label=\{`Review completed \$\{step\.label\} step`\}/);
  });

  it('tapping a completed step calls onReviewStep with that step\'s own key, nothing else', () => {
    expect(progressIndicatorSource).toMatch(/onClick=\{\(\) => onReviewStep\(step\.key\)\}/);
  });

  // Touch-target fix, found in live DEV testing: a real click reliably
  // missed this button because its hit area (~44x27 CSS px - min-w/
  // min-h were already overridden by the actual text+padding size, which
  // never reached the declared minimums) was well under a usable ~44x44
  // mobile tap target - the button was always correctly wired (an
  // accessibility-tree-resolved click worked every time), just too
  // small/tightly packed to reliably hit.
  it('the review button has a real ~44x44 tap target via invisible padding offset by matching negative margins, not just min-w/min-h (which the content already exceeded)', () => {
    expect(progressIndicatorSource).toMatch(/min-w-\[44px\] min-h-\[44px\] flex items-center justify-center -my-3\.5 py-3\.5 -mx-1 px-1/);
  });

  it('onReviewStep is optional and purely additive - omitting it keeps the original plain, non-interactive span for every caller that does not opt in', () => {
    expect(progressIndicatorSource).toMatch(/export const ProgressIndicator = \(\{ activeStep, sessionId = MORNING_SESSION_ID, onReviewStep \}\) => \{/);
    expect(progressIndicatorSource).toMatch(/<span className=\{labelClassName\}>/);
  });
});

describe('ReviewModeBanner.jsx - exact required wording, plain navigation only', () => {
  it('shows the current live step\'s label and a "Return to [step]" action', () => {
    expect(reviewModeBannerSource).toMatch(/Reviewing<\/span> — your place is still \{currentStepLabel\}\./);
    expect(reviewModeBannerSource).toMatch(/Return to \{currentStepLabel\}/);
  });

  it('never touches the Session Engine itself - it only ever calls the onReturnToCurrentStep callback it is given', () => {
    expect(reviewModeBannerSource).not.toMatch(/useSession|dispatch|advanceStep|advanceToStep/);
  });
});

describe('stepLabels.js - single flat presentation-only map, shared by ProgressIndicator and ReviewModeBanner callers', () => {
  it('falls back to the raw id for an unrecognised step, never throwing/crashing', () => {
    expect(stepLabelsSource).toMatch(/export const getStepLabel = \(stepId\) => STEP_LABELS\[stepId\] \?\? stepId;/);
  });

  it('covers every morning and evening step id used by the two ProgressIndicator VISIBLE_STEP_IDS_BY_SESSION sets', () => {
    const morningIds = ['intention', 'stretch', 'breathe', 'affirmation', 'complete'];
    const eveningIds = ['windDown', 'reflection', 'gratitude', 'breathing', 'sleepPreparation', 'completion'];
    for (const id of [...morningIds, ...eveningIds]) {
      expect(stepLabelsSource).toMatch(new RegExp(`\\b${id}: '`));
    }
  });
});

describe('PromptStepper.jsx - initialAnswers seeds once at mount, never re-seeds (fights typing / lint rule)', () => {
  it('seeds local state from initialAnswers exactly once via useState, with no re-seed effect', () => {
    expect(promptStepperSource).toMatch(/const \[answers, setAnswers\] = useState\(initialAnswers \?\? \{\}\);/);
    expect(promptStepperSource).not.toMatch(/useEffect\([\s\S]*?setAnswers\(initialAnswers/);
  });

  it('onClear is only invoked after an explicit two-step confirmation, never on a single tap', () => {
    expect(promptStepperSource).toMatch(/const handleRequestClear = \(\) => setConfirmingClear\(true\);/);
    expect(promptStepperSource).toMatch(/const handleConfirmClear = \(\) => \{[\s\S]*?onClear\?\.\(activePrompt\.id\);\s*\n\s*\};/);
    expect(promptStepperSource).not.toMatch(/onClick=\{.*onClear/);
  });

  it('cancelling the clear confirmation never calls onClear and leaves the existing answer untouched', () => {
    expect(promptStepperSource).toMatch(/const handleCancelClear = \(\) => setConfirmingClear\(false\);/);
  });

  it('the clear confirmation resets whenever the active prompt changes (Previous/Next), so a stray tap can never confirm-clear the wrong prompt', () => {
    expect(promptStepperSource).toMatch(/const goPrevious = \(\) => \{\s*\n\s*if \(isFirst\) return;\s*\n\s*setConfirmingClear\(false\);/);
    expect(promptStepperSource).toMatch(/const handleNext = \(\) => \{\s*\n\s*if \(isLast\) \{\s*\n\s*onComplete\?\.\(answers\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*setConfirmingClear\(false\);/);
  });
});

describe('routineResponses.js - Reflection/Gratitude persistence, idempotent and no-op for guests', () => {
  it('every function is a silent no-op without a userId (guest gating happens at the calling page, not here)', () => {
    expect(routineResponsesSource).toMatch(/if \(!supabase \|\| !userId\) return \{\};/);
    const noopGuards = routineResponsesSource.match(/if \(!supabase \|\| !userId\) return;/g) ?? [];
    expect(noopGuards.length).toBe(2);
  });

  it('upserts on the exact (user, session, step, prompt, date) conflict target - editing never inserts a second row', () => {
    expect(routineResponsesSource).toMatch(/const CONFLICT_TARGET = 'user_id,session_id,step_id,prompt_id,local_date';/);
    expect(routineResponsesSource).toMatch(/\{ onConflict: CONFLICT_TARGET \}/);
  });

  it('a blank/whitespace-only response is a no-op save, not an error - explicit clearing is a separate, deliberate function', () => {
    expect(routineResponsesSource).toMatch(/const trimmed = typeof response === 'string' \? response\.trim\(\) : '';\s*\n\s*if \(!trimmed\) return;/);
  });

  it('deleteRoutineResponse deletes at most the one exact matching row (all five keys), never a broader match', () => {
    const body = routineResponsesSource.match(/export const deleteRoutineResponse = async \([\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).toMatch(/\.match\(\{ user_id: userId, session_id: sessionId, step_id: stepId, prompt_id: promptId, local_date: localDate \}\);/);
  });

  it('a load failure resolves to an empty map, never throwing - the calling page always gets a renderable (if blank) stepper', () => {
    expect(routineResponsesSource).toMatch(/if \(error \|\| !data\) return \{\};/);
    expect(routineResponsesSource).toMatch(/\} catch \{\s*\n\s*return \{\};\s*\n\s*\}/);
  });
});

describe('Every Morning/Evening step page wires review mode consistently', () => {
  it('imports and calls useStepReviewMode with its own exact step id', () => {
    const expectedStepIds = {
      Breathe: 'breathe',
      MorningFlow: 'stretch',
      Affirmation: 'affirmation',
      IntentionSetup: 'intention',
      EveningWindDown: 'windDown',
      PrepareForRest: 'sleepPreparation',
      EveningBreathing: 'breathing',
      Reflection: 'reflection',
      Gratitude: 'gratitude',
    };
    for (const [page, source] of Object.entries(ALL_STEP_PAGES)) {
      expect(source).toMatch(/import \{ useStepReviewMode \} from '.*session\/useStepReviewMode';/);
      expect(source).toMatch(new RegExp(`useStepReviewMode\\((STEP_ID|'${expectedStepIds[page]}')\\)`));
    }
  });

  it('every page also imports useReviewNavigation and ReviewModeBanner (or wires requestReview/routeForStep from it)', () => {
    for (const source of Object.values(ALL_STEP_PAGES)) {
      expect(source).toMatch(/import \{ useReviewNavigation \} from '.*session\/useReviewNavigation';/);
      expect(source).toMatch(/import \{ ReviewModeBanner \} from '.*components\/ReviewModeBanner';/);
    }
  });

  it('every page renders ReviewModeBanner gated on isReviewMode && currentStep, wired to navigate back to the live step', () => {
    for (const source of Object.values(ALL_STEP_PAGES)) {
      expect(source).toMatch(
        /\{isReviewMode && currentStep && \(\s*\n\s*<ReviewModeBanner currentStepLabel=\{getStepLabel\(currentStep\.id\)\} onReturnToCurrentStep=\{\(\) => navigate\(routeForStep\(currentStep\.id\)\)\}\s*\/>\s*\n\s*\)\}/
      );
    }
  });

  it('none of the nine pages ever assign to or dispatch stepIndex directly from review-mode code (session position only ever moves via advanceStep/advanceToStep, which review mode never calls while reviewing)', () => {
    for (const source of Object.values(ALL_STEP_PAGES)) {
      expect(source).not.toMatch(/setStepIndex|stepIndex\s*[:=]/);
    }
  });
});

describe('The three timed/exercise steps (Breathe, Stretch, Evening Breathing) require an explicit "Repeat this exercise" tap before replaying', () => {
  it('gates the live exercise UI behind isRepeatGated = isReviewMode && !hasStartedRepeat', () => {
    for (const source of Object.values(REPEAT_GATED_PAGES)) {
      expect(source).toMatch(/const \[hasStartedRepeat, setHasStartedRepeat\] = useState\(false\);/);
      expect(source).toMatch(/const isRepeatGated = isReviewMode && !hasStartedRepeat;/);
    }
  });

  it('the timer effect never runs while gated - isRepeatGated is in the effect\'s own early-return guard and dependency array, alongside isConfirming (pause-during-review fix)', () => {
    for (const source of Object.values(REPEAT_GATED_PAGES)) {
      expect(source).toMatch(/if \((?:isInterrupted|manuallyPaused)(?: \|\| )?awaitingMusicChoice \|\| isRepeatGated \|\| isConfirming\) return;/);
    }
  });

  it('renders a distinct "Repeat this exercise" affordance instead of the live ring/countdown while gated', () => {
    for (const source of Object.values(REPEAT_GATED_PAGES)) {
      expect(source).toMatch(/isRepeatGated \? \(/);
      expect(source).toMatch(/Repeat this exercise/);
    }
  });

  it('tapping "Repeat this exercise" only sets local hasStartedRepeat - never advances the session, never marks a second completion', () => {
    for (const source of Object.values(REPEAT_GATED_PAGES)) {
      expect(source).toMatch(/onClick=\{\(\) => setHasStartedRepeat\(true\)\}/);
    }
  });
});

describe('Bottom controls swap to "Return to [current step]" while reviewing - Continue/Skip/Exit never shown mid-review', () => {
  it('Breathe/MorningFlow/EveningBreathing/EveningWindDown/PrepareForRest branch their bottom controls on isReviewMode', () => {
    for (const source of [breatheSource, morningFlowSource, eveningBreathingSource, eveningWindDownSource, prepareForRestSource]) {
      expect(source).toMatch(/isReviewMode \? \(/);
      expect(source).toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
    }
  });

  it('Affirmation and IntentionSetup (no repeat gate, no timer) also swap their own Continue/Skip/Exit controls while reviewing', () => {
    for (const source of [affirmationSource, intentionSetupSource]) {
      expect(source).toMatch(/isReviewMode \? \(/);
      expect(source).toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
    }
  });
});

describe('Leave-confirmation ConfirmDialog - exact required wording, only on pages with real unsaved live-step progress', () => {
  const CONFIRM_DIALOG_PAGES = {
    Breathe: breatheSource,
    MorningFlow: morningFlowSource,
    EveningBreathing: eveningBreathingSource,
    Reflection: reflectionSource,
    Gratitude: gratitudeSource,
  };

  it('every page renders ConfirmDialog wired to confirmLeave/cancelLeave with the same title', () => {
    for (const source of Object.values(CONFIRM_DIALOG_PAGES)) {
      expect(source).toMatch(/title="Review an earlier step\?"/);
      expect(source).toMatch(/onConfirm=\{confirmLeave\}/);
      expect(source).toMatch(/onDismiss=\{cancelLeave\}/);
    }
  });

  // Wording fix, required for the three TIMED exercise screens
  // specifically: reviewing away from a running timer pauses it (and
  // resumes it exactly where it was, via timedExercisePause.js) rather
  // than losing anything, so "Your unsaved progress...may be lost" was
  // inaccurate there - "Cancel"/"Review Step" also replace the generic
  // "Stay here"/"Review" labels for this specific, higher-stakes choice.
  it('Breathe/MorningFlow/EveningBreathing use the timed-exercise wording ("will be paused") and Cancel/Review Step labels, and pass hasUnsavedProgress: true', () => {
    for (const source of [breatheSource, morningFlowSource, eveningBreathingSource]) {
      expect(source).toMatch(/message="Your current exercise will be paused\."/);
      expect(source).toMatch(/confirmLabel="Review Step"/);
      expect(source).toMatch(/cancelLabel="Cancel"/);
      expect(source).not.toMatch(/Your unsaved progress on this step may be lost/);
      expect(source).toMatch(/hasUnsavedProgress: true/);
    }
  });

  // Reflection/Gratitude are about unsaved TEXT, not a running timer -
  // the original wording stays accurate for them and is deliberately
  // left unchanged.
  it('Reflection/Gratitude keep the original unsaved-progress wording and Stay here/Review labels', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      expect(source).toMatch(/message="Your unsaved progress on this step may be lost\."/);
      expect(source).toMatch(/confirmLabel="Review"/);
      expect(source).toMatch(/cancelLabel="Stay here"/);
    }
  });

  it('Reflection/Gratitude pass hasUnsavedProgress tied to real typed text, not a hardcoded true/false', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      expect(source).toMatch(/hasUnsavedProgress: hasUnsavedText/);
    }
  });

  it('pages with no timer and no free-text input (EveningWindDown, PrepareForRest, Affirmation) pass hasUnsavedProgress: false - no confirmation needed to review them', () => {
    for (const source of [eveningWindDownSource, prepareForRestSource, affirmationSource]) {
      expect(source).toMatch(/hasUnsavedProgress: false/);
    }
  });
});

describe('Reflection/Gratitude - review-mode Continue never advances the session or jumps to the next screen', () => {
  it('handleComplete checks isReviewMode BEFORE the advanceStep/navigate-forward branch, and returns immediately', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      const body = source.match(/const handleComplete = \(answers\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toBe('');
      expect(body).toMatch(/if \(isReviewMode\) \{\s*\n\s*if \(currentStep\) navigate\(routeForStep\(currentStep\.id\)\);\s*\n\s*return;\s*\n\s*\}/);
      // the review-mode return must appear before the live advanceStep call
      const reviewIdx = body.indexOf('if (isReviewMode)');
      const advanceIdx = body.indexOf('advanceStep()');
      expect(reviewIdx).toBeGreaterThan(-1);
      expect(advanceIdx).toBeGreaterThan(reviewIdx);
    }
  });

  it('still flushes any edited answers via upsert even while reviewing (edits are saved, only forward navigation is suppressed)', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      const body = source.match(/const handleComplete = \(answers\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      const flushIdx = body.indexOf('upsertRoutineResponse');
      const reviewIdx = body.indexOf('if (isReviewMode)');
      expect(flushIdx).toBeGreaterThan(-1);
      expect(flushIdx).toBeLessThan(reviewIdx);
    }
  });

  it('PromptStepper only mounts once previously-saved responses have loaded (or the guest {} default is resolved) - never shows a blank stepper that would silently overwrite saved answers', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      expect(source).toMatch(/\{responses !== null && \(/);
      expect(source).toMatch(/initialAnswers=\{responses\}/);
    }
  });
});

describe('IntentionSetup.jsx - reviewing Intend allows changing today\'s intention with no extra gating (same mechanism as Home\'s Change Intention)', () => {
  it('handleSelectPreset/handleAddCustom update the live intentions[0] unconditionally - no Session Engine call gated behind isReviewMode', () => {
    expect(intentionSetupSource).toMatch(/const handleSelectPreset = \(preset\) => \{\s*\n\s*setIntentions\(\[preset\]\);/);
    expect(intentionSetupSource).not.toMatch(/if \(isReviewMode\)[\s\S]{0,40}setIntentions/);
  });

  // Bug fix, found live: Continue (the only place that otherwise calls
  // saveIntentionToCloud, in handleComplete) is replaced by "Return to
  // [step]" while reviewing and is never reachable - a preset/custom
  // intention change made during review updated the live intentions[0]
  // correctly but silently never reached Supabase, reverting on the next
  // reload. Reproduced live via a real browser session, fixed by saving
  // immediately when isReviewMode is true; the ordinary live-step flow
  // (isReviewMode false) is unchanged and still defers to Continue.
  it('saves to Supabase immediately when changed during review, since Continue/handleComplete is unreachable then', () => {
    expect(intentionSetupSource).toMatch(/setIntentions\(\[preset\]\); \/\/ Allow exactly ONE primary intention as requested\s*\n\s*if \(isReviewMode\) saveIntentionToCloud\(userId, preset\);/);
    expect(intentionSetupSource).toMatch(/setCustomIntention\(''\);\s*\n\s*if \(isReviewMode\) saveIntentionToCloud\(userId, trimmed\);/);
  });

  it('has no ProgressIndicator of its own (Step 1 - nothing earlier to review from here)', () => {
    expect(intentionSetupSource).not.toMatch(/<ProgressIndicator/);
  });
});

describe('Breathe/MorningFlow/EveningBreathing - pause-and-resume-exact-state wiring', () => {
  const TIMED_PAGES = {
    Breathe: { source: breatheSource, stepId: 'breathe', timeField: 'secondsLeft', extraField: 'breatheState' },
    MorningFlow: { source: morningFlowSource, stepId: 'stretch', timeField: 'timeLeft', extraField: 'activeStep' },
    EveningBreathing: { source: eveningBreathingSource, stepId: 'breathing', timeField: 'secondsLeft', extraField: 'breatheState' },
  };

  it('imports the shared timedExercisePause helpers and reads a snapshot once, lazily, at mount', () => {
    for (const { source, stepId } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(/import \{ savePausedExerciseState, loadPausedExerciseState, clearPausedExerciseState \} from '\.\.\/session\/timedExercisePause';/);
      expect(source).toMatch(new RegExp(`const \\[pausedSnapshot\\] = useState\\(\\(\\) => loadPausedExerciseState\\('${stepId}'\\)\\);`));
    }
  });

  it('clears the snapshot in a one-time effect once read, so a later fresh/repeat visit never replays stale state', () => {
    for (const { source, stepId } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(new RegExp(`useEffect\\(\\(\\) => \\{\\s*\\n\\s*if \\(pausedSnapshot\\) clearPausedExerciseState\\('${stepId}'\\);\\s*\\n\\s*\\}, \\[pausedSnapshot\\]\\);`));
    }
  });

  it('seeds its own countdown/phase state from the snapshot when present, defaulting otherwise', () => {
    for (const { source, timeField } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(new RegExp(`useState\\(\\(\\) => pausedSnapshot\\?\\.${timeField} \\?\\?`));
    }
  });

  it('seeds manuallyPaused to true when resuming from a snapshot - never auto-resumes the countdown, always shows the paused panel first', () => {
    for (const { source } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(/const \[manuallyPaused, setManuallyPaused\] = useState\(\(\) => Boolean\(pausedSnapshot\)\);/);
    }
  });

  it('onLeaveLiveStep snapshots the exact current countdown/phase/music-choice state right before leaving', () => {
    for (const { source, stepId } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(new RegExp(`onLeaveLiveStep: \\(\\) => savePausedExerciseState\\('${stepId}', \\{`));
    }
  });

  it('EveningBreathing now has the same Pause Exercise / ExercisePausedPanel infrastructure as Breathe/MorningFlow (release-blocking consistency fix - it originally had none)', () => {
    expect(eveningBreathingSource).toMatch(/import \{ ExercisePausedPanel \} from '\.\.\/components\/ExercisePausedPanel';/);
    expect(eveningBreathingSource).toMatch(/const handlePauseExercise = \(\) => setManuallyPaused\(true\);/);
    expect(eveningBreathingSource).toMatch(/<ExercisePausedPanel/);
    expect(eveningBreathingSource).toMatch(/Pause Exercise/);
  });
});

describe('Affirmation.jsx - always reflects the CURRENT live intention, including one changed via review', () => {
  it('reads intentions[0] fresh at render time - no snapshot/cache that could go stale after a reviewed intention change', () => {
    expect(affirmationSource).toMatch(/const affirmation = getAffirmationForIntention\(intentions\[0\]\);/);
  });
});

describe('Reflection.jsx/Gratitude.jsx - userId comes from useAlarm(), not useAuth()', () => {
  // Bug fix, found live: useAuth()'s own exposed value has no `userId`
  // field (only the full `user` object - see AuthContext.jsx), so
  // `const { isGuest, userId } = useAuth()` silently resolved userId to
  // undefined, making every loadRoutineResponses/upsertRoutineResponse/
  // deleteRoutineResponse call a no-op (their own `if (!supabase ||
  // !userId) return` guard) for a real signed-in user - typed answers
  // never reached Supabase at all, network-request-free confirmed live.
  // useAlarm() is the context that actually derives a real, non-
  // anonymous userId (AlarmContext.jsx) - both pages already call it for
  // effectiveTimezone, so this reuses that same call rather than adding
  // a new context read.
  it('destructures userId from useAlarm(), not useAuth()', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      expect(source).toMatch(/const \{ isGuest \} = useAuth\(\);/);
      expect(source).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
      expect(source).not.toMatch(/const \{[^}]*userId[^}]*\} = useAuth\(\);/);
    }
  });
});

describe('PromptStepper.jsx - onChange is debounced, avoiding an out-of-order-write race', () => {
  // Bug fix, found live: firing onChange (an async Supabase upsert) on
  // every keystroke with no ordering guarantee let a slower earlier
  // request's write land AFTER a faster later one's - reproduced live
  // typing "A calm walk outside" then reviewing back to it: the saved/
  // reloaded value was truncated to "A calm walk outsi". Debouncing
  // collapses a burst of keystrokes into one save; local `answers` state
  // (and therefore handleComplete's own final flush) is unaffected since
  // it still updates synchronously on every keystroke, never debounced.
  it('debounces the onChange call per-prompt, clearing any pending timer for that prompt on each keystroke', () => {
    expect(promptStepperSource).toMatch(/const debounceTimersRef = useRef\(\{\}\);/);
    const body = promptStepperSource.match(/const handleValueChange = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setAnswers\(\(prev\) => \(\{ \.\.\.prev, \[activePrompt\.id\]: value \}\)\);/);
    expect(body).toMatch(/clearTimeout\(debounceTimersRef\.current\[promptId\]\);/);
    expect(body).toMatch(/debounceTimersRef\.current\[promptId\] = setTimeout\(\(\) => \{\s*\n\s*onChange\?\.\(promptId, value\);\s*\n\s*\}, CHANGE_DEBOUNCE_MS\);/);
    // local state must update synchronously (not inside the debounced
    // timer) so handleComplete's flush always has the true latest value
    const setAnswersIdx = body.indexOf('setAnswers(');
    const timeoutIdx = body.indexOf('setTimeout(');
    expect(setAnswersIdx).toBeGreaterThan(-1);
    expect(setAnswersIdx).toBeLessThan(timeoutIdx);
  });
});

describe('Safe backward navigation ("Review Mode") - Layout-mount-boundary fix', () => {
  // Bug fix, found live: only breathe/morning-flow (of the nine Morning/
  // Evening step routes) are actually nested UNDER <Layout> in App.jsx's
  // route tree - affirmation/intention-setup/every evening step render
  // as sibling top-level routes instead, so Layout fully unmounted on
  // those pages and REMOUNTED crossing back into breathe/morning-flow.
  // Layout's own "restore user into their in-progress step" effect used
  // a useRef that reset to null on every such remount, so its very first
  // run after remounting always looked like the live step had never yet
  // been forced, and it forced the URL right back to the live step -
  // reproduced live: reviewing Stretch/Breathe from Affirm (or Intend)
  // silently bounced straight back to Affirm before the reviewed page
  // ever rendered. Fixed by moving the whole effect out of Layout into
  // RoutineRestoreGuard, mounted once directly inside <Router> (outside
  // <Layout>) so it never unmounts on a route change at all.
  it('Layout.jsx no longer owns the forced-redirect effect (no useRef/useEffect/useAlarm/useActiveRoutineStep of its own)', () => {
    expect(layoutSource).not.toMatch(/useRef|useEffect|useAlarm|useActiveRoutineStep|useNavigate/);
  });

  it('RoutineRestoreGuard.jsx tracks the forced path in a MODULE-level variable, not a useRef, so it survives being unmounted/remounted', () => {
    expect(routineRestoreGuardSource).toMatch(/^let lastForcedPath = null;$/m);
    expect(routineRestoreGuardSource).not.toMatch(/useRef\(/);
    expect(routineRestoreGuardSource).toMatch(/if \(activeRoute && lastForcedPath !== activeRoute\) \{\s*\n\s*lastForcedPath = activeRoute;/);
  });

  it('renders nothing itself, and is mounted once in App.jsx outside <Layout>, alongside the other always-mounted app-level handlers', () => {
    expect(routineRestoreGuardSource).toMatch(/return null;/);
    expect(appSource).toMatch(/import \{ RoutineRestoreGuard \} from '\.\/components\/RoutineRestoreGuard';/);
    expect(appSource).toMatch(/<NativeDeepLinkHandler \/>\s*\n\s*<MorningReminderTapHandler \/>[\s\S]{0,600}<RoutineRestoreGuard \/>/);
    // must be a sibling of OnboardingGate/Routes, never nested inside the
    // <Route path="\/" element={<Layout \/>}> subtree
    const layoutRouteBlock = appSource.match(/<Route path="\/" element=\{<Layout \/>\}>[\s\S]*?<\/Route>/)?.[0] ?? '';
    expect(layoutRouteBlock).not.toMatch(/RoutineRestoreGuard/);
  });
});
