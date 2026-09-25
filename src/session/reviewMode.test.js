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

describe('useStepReviewMode - the single source of truth for review vs. live, strictly scoped to ONE routine', () => {
  it('never reads or writes stepIndex - a pure comparison of currentStep.id against this page\'s own stepId', () => {
    expect(useStepReviewModeSource).not.toMatch(/state\.stepIndex/);
    expect(useStepReviewModeSource).not.toMatch(/dispatch\(|advanceToStep\(|advanceStep\(/);
  });

  // Cross-routine isolation fix, found live: "Reviewing — your place is
  // still Rest" appeared on a MORNING screen because this hook only ever
  // checked state.status, never WHICH routine (state.sessionId) was
  // actually live - Evening being live at 'sleepPreparation' (Rest) was
  // enough to make isReviewMode true on Morning's Breathe.jsx too, since
  // `currentStep.id !== stepId` is trivially true across two entirely
  // different routines' step vocabularies. Fixed by requiring the
  // CALLER'S OWN sessionId to match the live session's sessionId before
  // treating anything as "this routine is live" at all.
  it('takes sessionId as a required second argument and gates isThisRoutineLive on state.sessionId === sessionId', () => {
    expect(useStepReviewModeSource).toMatch(/export const useStepReviewMode = \(stepId, sessionId\) => \{/);
    expect(useStepReviewModeSource).toMatch(
      /const isThisRoutineLive = \(state\.status === 'playing' \|\| state\.status === 'interrupted'\) && state\.sessionId === sessionId;/
    );
  });

  it('isReviewMode and isLiveStep are both derived from isThisRoutineLive - never from session status/currentStep alone', () => {
    expect(useStepReviewModeSource).toMatch(
      /const isReviewMode = isThisRoutineLive && Boolean\(currentStep\) && currentStep\.id !== stepId;/
    );
    expect(useStepReviewModeSource).toMatch(
      /const isLiveStep = isThisRoutineLive && Boolean\(currentStep\) && currentStep\.id === stepId;/
    );
  });

  it('never surfaces the OTHER routine\'s currentStep - the returned value is null whenever this routine is not the live one', () => {
    expect(useStepReviewModeSource).toMatch(/currentStep: isThisRoutineLive \? currentStep : null,/);
  });

  it('a mismatched live session (a different routine, or none at all) is treated as an ordinary standalone visit - both isReviewMode and isLiveStep false, matching the pre-existing "no active session" behaviour, never guessed at', () => {
    // Structural proof: isReviewMode/isLiveStep can only ever be true
    // when isThisRoutineLive is true, which itself requires an exact
    // sessionId match - there is no other code path to either flag.
    const trueSources = useStepReviewModeSource.match(/const is(?:ReviewMode|LiveStep) = ([^;]+);/g) ?? [];
    expect(trueSources.length).toBe(2);
    for (const line of trueSources) {
      expect(line).toMatch(/^const is(?:ReviewMode|LiveStep) = isThisRoutineLive && /);
    }
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

describe('timedExercisePause.js - pause-and-resume-exact-state, strictly isolated per (sessionId, stepId)', () => {
  it('the storage key is built from BOTH sessionId and stepId, never stepId alone', () => {
    expect(timedExercisePauseSource).toMatch(/const KEY_PREFIX = 'moonlight_paused_exercise_';/);
    expect(timedExercisePauseSource).toMatch(/const keyFor = \(sessionId, stepId\) => `\$\{KEY_PREFIX\}\$\{sessionId\}__\$\{stepId\}`;/);
  });

  it('save tags the stored snapshot with its own sessionId/stepId - a fact this same module later validates on load', () => {
    const body = timedExercisePauseSource.match(/export const savePausedExerciseState = \(sessionId, stepId, state\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).toMatch(/JSON\.stringify\(\{ \.\.\.state, sessionId, stepId, savedAt: Date\.now\(\) \}\)/);
  });

  // Section 1/7 requirement: a snapshot from Breathe must never be
  // consumed by EveningBreathing, MorningFlow, or another routine/step -
  // enforced two ways: (1) the key itself is already scoped by both
  // sessionId and stepId, so a differently-scoped snapshot physically
  // lives under a different key; (2) defense-in-depth, load ALSO
  // rejects a stored value whose own recorded sessionId/stepId doesn't
  // match what was actually requested, exactly like "no snapshot at
  // all" - never guessed at, never partially trusted.
  it('load rejects (returns null for) a stored snapshot whose own sessionId or stepId does not match what was requested', () => {
    const body = timedExercisePauseSource.match(/export const loadPausedExerciseState = \(sessionId, stepId\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(!parsed \|\| parsed\.sessionId !== sessionId \|\| parsed\.stepId !== stepId\) return null;/);
  });

  it('load never clears - the calling page is responsible for explicitly clearing once it has consumed the value', () => {
    const loadBody = timedExercisePauseSource.match(/export const loadPausedExerciseState = \(sessionId, stepId\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
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
    // Journey Embedding - a completed step is also excluded from review
    // (isReviewable) when its id is in NON_REVIEWABLE_STEP_IDS
    // ('meditate'/'meditation') - see that constant's own doc comment.
    // Every OTHER step's reviewability is unaffected: isReviewable is
    // still exactly `isCompleted && onReviewStep` whenever the step id
    // isn't in that narrow allowlist.
    expect(progressIndicatorSource).toMatch(/const isReviewable = isCompleted && onReviewStep && !NON_REVIEWABLE_STEP_IDS\.has\(step\.key\);/);
    expect(progressIndicatorSource).toMatch(/isReviewable \? \(/);
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
    expect(promptStepperSource).toMatch(/const handleConfirmClear = \(\) => \{[\s\S]*?onClear\?\.\(promptId\);\s*\n\s*\};/);
    expect(promptStepperSource).not.toMatch(/onClick=\{.*onClear/);
  });

  it('cancelling the clear confirmation never calls onClear and leaves the existing answer untouched', () => {
    expect(promptStepperSource).toMatch(/const handleCancelClear = \(\) => setConfirmingClear\(false\);/);
  });

  // Phase 3 (Reflection/Gratitude tap-first redesign, back-navigation
  // fix): activeIndex moved from this component's own internal useState
  // to a prop CONTROLLED by the calling page (Reflection.jsx/Gratitude.jsx
  // derive it from their own allowlisted `?q=` route param) - see those
  // two pages' own tests for the route-param/back-destination contract.
  // The confirm-clear and guidance-disclosure UI state still reset
  // whenever the active question changes, now adjusted directly during
  // render when the activeIndex prop changes, rather than inline in
  // goPrevious/handleNext (both removed - see the next test).
  it('activeIndex is a controlled prop, not internal state - confirm-clear/guidance-disclosure reset when it changes, adjusted directly during render (React\'s own documented pattern) rather than a useEffect, so this never causes an extra committed render', () => {
    expect(promptStepperSource).not.toMatch(/const \[activeIndex, setActiveIndex\]/);
    expect(promptStepperSource).toMatch(/export const PromptStepper = \(\{ prompts, activeIndex, initialAnswers, onChange, onClear, onAdvance, onComplete, accent \}\) => \{/);
    expect(promptStepperSource).toMatch(/if \(activeIndex !== prevActiveIndex\) \{\s*\n\s*setPrevActiveIndex\(activeIndex\);\s*\n\s*setConfirmingClear\(false\);\s*\n\s*setGuidanceOpen\(false\);\s*\n\s*\}/);
    expect(promptStepperSource).not.toMatch(/useEffect\(/);
  });

  it('no in-card Previous button remains - Back is exclusively the shared page-level BackButton\'s job now (see EveningSceneShell\'s own showBack/backFallback)', () => {
    expect(promptStepperSource).not.toMatch(/goPrevious/);
    expect(promptStepperSource).not.toMatch(/>Previous</);
    expect(promptStepperSource).not.toMatch(/const isFirst/);
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
  it('imports and calls useStepReviewMode with its own exact step id AND its own exact sessionId - never omitted, never the other routine\'s', () => {
    const expected = {
      Breathe: { stepId: 'breathe', sessionId: 'morning-routine' },
      MorningFlow: { stepId: 'stretch', sessionId: 'morning-routine' },
      Affirmation: { stepId: 'affirmation', sessionId: 'morning-routine' },
      IntentionSetup: { stepId: 'intention', sessionId: 'morning-routine' },
      EveningWindDown: { stepId: 'windDown', sessionId: 'evening-wind-down' },
      PrepareForRest: { stepId: 'sleepPreparation', sessionId: 'evening-wind-down' },
      EveningBreathing: { stepId: 'breathing', sessionId: 'evening-wind-down' },
      Reflection: { stepId: 'reflection', sessionId: 'evening-wind-down' },
      Gratitude: { stepId: 'gratitude', sessionId: 'evening-wind-down' },
    };
    for (const [page, source] of Object.entries(ALL_STEP_PAGES)) {
      const { stepId, sessionId } = expected[page];
      expect(source).toMatch(/import \{ useStepReviewMode \} from '.*session\/useStepReviewMode';/);
      expect(source).toMatch(new RegExp(`useStepReviewMode\\((STEP_ID|'${stepId}'), (SESSION_ID|'${sessionId}')\\)`));
    }
  });

  // Section 7 requirement: "Rest" (sleepPreparation's evening-only label)
  // can never appear as a Morning return step - structurally impossible
  // once every Morning page's own useStepReviewMode call is hardcoded to
  // sessionId 'morning-routine': isThisRoutineLive (and therefore
  // isReviewMode/currentStep) can only ever be true when the Session
  // Engine's OWN live sessionId also equals 'morning-routine' - Evening
  // being live at 'sleepPreparation' can never satisfy that check on a
  // Morning page, regardless of what currentStep.id happens to be.
  it('every Morning page hardcodes sessionId \'morning-routine\' and every Evening page hardcodes \'evening-wind-down\' - never a value that could resolve to the other routine', () => {
    const morningPages = [breatheSource, morningFlowSource, affirmationSource, intentionSetupSource];
    const eveningPages = [eveningWindDownSource, prepareForRestSource, eveningBreathingSource, reflectionSource, gratitudeSource];
    for (const source of morningPages) {
      expect(source).not.toMatch(/useStepReviewMode\([^)]*'evening-wind-down'/);
    }
    for (const source of eveningPages) {
      expect(source).not.toMatch(/useStepReviewMode\([^)]*'morning-routine'/);
    }
  });

  // Build 15 Evening UX correction — EveningWindDown.jsx (the intro) is
  // the one deliberate exception: it still imports/uses useReviewNavigation
  // (routeForStep drives its own "Return to X" button), but never renders
  // ReviewModeBanner at all. That banner's "Reviewing — your place is
  // still X" wording describes revisiting an EARLIER STEP mid-journey
  // (the genuine ProgressIndicator/onReviewStep case every OTHER step page
  // renders it for) - the intro isn't a step being "reviewed" in that
  // sense, it's the entry screen, so showing that banner there was
  // confusing rather than informative. See EveningWindDown.jsx's own doc
  // comment for the full reasoning.
  it('every OTHER page (all but EveningWindDown) imports useReviewNavigation and ReviewModeBanner (or wires requestReview/routeForStep from it)', () => {
    for (const [page, source] of Object.entries(ALL_STEP_PAGES)) {
      expect(source).toMatch(/import \{ useReviewNavigation \} from '.*session\/useReviewNavigation';/);
      if (page === 'EveningWindDown') continue;
      expect(source).toMatch(/import \{ ReviewModeBanner \} from '.*components\/ReviewModeBanner';/);
    }
  });

  it('EveningWindDown.jsx deliberately does NOT import ReviewModeBanner at all - not merely omitting the render, the import itself is gone (its own doc comment may still mention the name in prose explaining why)', () => {
    const code = eveningWindDownSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/ReviewModeBanner/);
  });

  it('every OTHER page (all but EveningWindDown) renders ReviewModeBanner gated on isReviewMode && currentStep, wired to navigate back to the live step', () => {
    for (const [page, source] of Object.entries(ALL_STEP_PAGES)) {
      if (page === 'EveningWindDown') continue;
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

// isRepeatGated hidden-options defect fix — found live: reviewing an
// earlier, already-passed Stretch/Breathe/Breathing step (via Back or a
// progress-bar review tap) showed "You already completed this step -
// Repeat this exercise?" instead of the real setup screen with all
// choices, unlike Meditation/Affirmation/Intention, which have no
// equivalent gate and already show real choices directly during review -
// directly blocking the approved "review the previous step with setup
// options" behaviour. isRepeatGated is now permanently `false` in all
// three files (no longer derived from isReviewMode/hasStartedRepeat at
// all) - every downstream `!isRepeatGated`/`isRepeatGated &&` reference
// in each file's own render (unchanged, not touched by this fix) now
// resolves exactly as if the gate never existed, and the old "Repeat this
// exercise" panel/button no longer exist anywhere in these three files.
describe('The three timed/exercise steps (Breathe, Stretch, Evening Breathing) no longer gate their setup/active UI behind a "Repeat this exercise" tap when reviewing an earlier step', () => {
  it('isRepeatGated is hardcoded false in all three files - no hasStartedRepeat state remains in real code (each file\'s own doc comment legitimately names it in prose, explaining the fix - comments stripped first)', () => {
    for (const source of Object.values(REPEAT_GATED_PAGES)) {
      expect(source).toMatch(/const isRepeatGated = false;/);
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(codeOnly).not.toMatch(/hasStartedRepeat/);
    }
  });

  it('the timer effect\'s own early-return guard and dependency array still reference isRepeatGated by name (a token that is always false now, not removed from every call site - the smallest fix that leaves every other reference correct without touching it), alongside isConfirming (pause-during-review fix)', () => {
    // Build 15 — none of the three timed pages has an awaitingMusicChoice
    // concept left (no music-entry-choice gate - see
    // musicEntryChoice.test.js): each now gates on hasBegun (MorningFlow.jsx
    // additionally on its own locked activeSequence), since nothing may
    // run before its own new pre-start screen's explicit Begin gesture.
    expect(morningFlowSource).toMatch(/if \(!hasBegun \|\| !activeSequence \|\| isInterrupted \|\| isRepeatGated \|\| isConfirming\) return;/);
    // Continue-lock/Skip-semantics fix adds hasFinished to Breathe.jsx/
    // EveningBreathing.jsx's own guard too (MorningFlow.jsx/Stretch is
    // untouched by that fix) - see embeddedBreathingContinueLock.test.js.
    expect(breatheSource).toMatch(/if \(!hasBegun \|\| isInterrupted \|\| isRepeatGated \|\| isConfirming \|\| hasFinished\) return;/);
    expect(eveningBreathingSource).toMatch(/if \(!hasBegun \|\| manuallyPaused \|\| isRepeatGated \|\| isConfirming \|\| hasFinished\) return;/);
  });

  it('no "Repeat this exercise" affordance exists anywhere in these three files any more - reviewing an earlier step now shows the real setup screen (all pattern/movement/music choices) directly, matching Meditation/Affirmation/Intention\'s own already-correct review-mode behaviour (each file\'s own doc comment legitimately names the old copy in prose, explaining the fix - comments stripped first)', () => {
    for (const source of Object.values(REPEAT_GATED_PAGES)) {
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(codeOnly).not.toMatch(/Repeat this exercise/);
      expect(codeOnly).not.toMatch(/setHasStartedRepeat/);
    }
  });
});

describe('Bottom controls swap to "Return to [current step]" while reviewing - Continue/Skip/Exit never shown mid-review', () => {
  // Duplicate-return-action fix, found live: reviewing Breathe/MorningFlow
  // (Stretch)/EveningBreathing from a later step and then replaying it
  // (tapping Begin) used to show BOTH the ReviewModeBanner's own
  // "Return to X" (top, always rendered whenever isReviewMode) AND an
  // identical second button here - two controls doing the exact same
  // thing simultaneously. Affirmation/IntentionSetup have no
  // active/pre-start split at all, so their own duplicate was reachable
  // every single time they were reviewed (no replay needed). Fixed by
  // removing the redundant branch (`!isReviewMode &&` - nothing renders
  // here while reviewing; the banner covers it) rather than the banner,
  // since the banner is the one universal, always-present mechanism
  // every reviewable screen in the app already shares. EveningWindDown/
  // PrepareForRest are unaffected: EveningWindDown never renders
  // ReviewModeBanner at all (a deliberate, different, non-duplicating
  // design - see its own doc comment) so its ternary-based label swap
  // was never a duplicate; PrepareForRest DID duplicate (fixed below,
  // separately, since its shape is `const primaryAction = isReviewMode ?
  // null : (...)`, not an inline ternary in the JSX).
  it('Breathe/MorningFlow/EveningBreathing no longer render a second "Return to X" button - the ReviewModeBanner is the sole return control', () => {
    for (const source of [breatheSource, morningFlowSource, eveningBreathingSource]) {
      expect(source).not.toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
      expect(source).toMatch(/\{!isReviewMode && \(/);
    }
  });

  it('EveningWindDown keeps its own, different, non-duplicating ternary label-swap unchanged (it never renders ReviewModeBanner)', () => {
    expect(eveningWindDownSource).toMatch(/isReviewMode \? \(/);
    expect(eveningWindDownSource).toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
    expect(eveningWindDownSource).not.toMatch(/<ReviewModeBanner/);
  });

  it('PrepareForRest\'s primaryAction is null while reviewing - the ReviewModeBanner (rendered separately, further down) is the sole return control', () => {
    expect(prepareForRestSource).toMatch(/const primaryAction = isReviewMode \? null : \(/);
    expect(prepareForRestSource).not.toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
  });

  it('Affirmation and IntentionSetup (no repeat gate, no timer) no longer render a second "Return to X" button either', () => {
    for (const source of [affirmationSource, intentionSetupSource]) {
      expect(source).not.toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
      expect(source).toMatch(/\{!isReviewMode && \(/);
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

describe('IntentionSetup.jsx - reviewing Intend allows changing today\'s intentions with no extra gating (same mechanism as Home\'s Change Intention)', () => {
  it('applySelection (chip-tap, used by handleSelectPreset and the summary-chip removal buttons) updates the live intentions unconditionally via the shared toggleIntention helper - no Session Engine call gated behind isReviewMode. handleAddCustom now uses its own ADD-only addCustomIntention path - see IntentionSetup.customIntentionFix.test.js - but mirrors this same review-mode save.', () => {
    expect(intentionSetupSource).toMatch(/import \{\s*\n\s*toggleIntention,\s*\n\s*addCustomIntention,\s*\n\s*roleForIndex,\s*\n\s*LIMIT_MESSAGE,\s*\n\s*CUSTOM_LIMIT_MESSAGE,\s*\n\s*DUPLICATE_INTENTION_MESSAGE\s*\n\s*\} from '\.\.\/lib\/intentionSelection';/);
    expect(intentionSetupSource).toMatch(/const \{ intentions: next, limitReached \} = toggleIntention\(intentions, value\);/);
    // setIntentions( is asserted absent inside the isReviewMode block
    // specifically (a second, redundant array-state write would be the
    // real bug this originally guarded against) - setIntentionsConfirmed(
    // (F1, added since) is a different setter and must not trip this.
    const reviewBlock = intentionSetupSource.match(/if \(isReviewMode\) \{[\s\S]{0,120}?\n {4}\}/)?.[0] ?? '';
    expect(reviewBlock).not.toMatch(/setIntentions\(/);
    expect(reviewBlock).toMatch(/setIntentionsConfirmed\(true\);/);
  });

  // Bug fix, found live: Continue (the only place that otherwise calls
  // saveIntentionsToCloud, in handleComplete) is replaced by "Return to
  // [step]" while reviewing and is never reachable - a preset/custom
  // intention change made during review updated the live intentions
  // correctly but silently never reached Supabase, reverting on the next
  // reload. Reproduced live via a real browser session, fixed by saving
  // immediately when isReviewMode is true; the ordinary live-step flow
  // (isReviewMode false) is unchanged and still defers to Continue.
  it('saves to Supabase immediately when changed during review, since Continue/handleComplete is unreachable then (F1: also confirms - a review-mode edit is a genuine save, not just browsing)', () => {
    expect(intentionSetupSource).toMatch(/setIntentions\(next\);\s*\n[\s\S]*?if \(isReviewMode\) \{\s*\n\s*saveIntentionsToCloud\(userId, next\);\s*\n\s*setIntentionsConfirmed\(true\);\s*\n\s*\}/);
  });

  it('has no ProgressIndicator of its own (Step 1 - nothing earlier to review from here)', () => {
    expect(intentionSetupSource).not.toMatch(/<ProgressIndicator/);
  });
});

describe('Breathe/MorningFlow/EveningBreathing - pause-and-resume-exact-state wiring', () => {
  const TIMED_PAGES = {
    Breathe: { source: breatheSource, sessionId: 'morning-routine', stepId: 'breathe', timeField: 'secondsLeft', extraField: 'breatheState' },
    MorningFlow: { source: morningFlowSource, sessionId: 'morning-routine', stepId: 'stretch', timeField: 'timeLeft', extraField: 'activeStep' },
    EveningBreathing: { source: eveningBreathingSource, sessionId: 'evening-wind-down', stepId: 'breathing', timeField: 'secondsLeft', extraField: 'breatheState' },
  };

  it('imports the shared timedExercisePause helpers and reads a snapshot once, lazily, at mount, keyed by BOTH sessionId and stepId', () => {
    for (const { source, sessionId, stepId } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(/import \{ savePausedExerciseState, loadPausedExerciseState, clearPausedExerciseState \} from '\.\.\/session\/timedExercisePause';/);
      expect(source).toMatch(new RegExp(`const \\[pausedSnapshot\\] = useState\\(\\(\\) => loadPausedExerciseState\\('${sessionId}', '${stepId}'\\)\\);`));
    }
  });

  it('clears the snapshot in a one-time effect once read, so a later fresh/repeat visit never replays stale state', () => {
    for (const { source, sessionId, stepId } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(new RegExp(`useEffect\\(\\(\\) => \\{\\s*\\n\\s*if \\(pausedSnapshot\\) clearPausedExerciseState\\('${sessionId}', '${stepId}'\\);\\s*\\n\\s*\\}, \\[pausedSnapshot\\]\\);`));
    }
  });

  it('seeds its own countdown/phase state from the TRUSTED snapshot when present, defaulting otherwise - review-mode auto-start defect fix: trustedSnapshot is null unless this mount is genuinely the live step (isLiveStep), see backNavigationCanonicalMap.test.js', () => {
    for (const { source, timeField } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(new RegExp(`useState\\(\\(\\) => trustedSnapshot\\?\\.${timeField} \\?\\?`));
    }
  });

  it('seeds manuallyPaused to true when resuming from a TRUSTED snapshot - never auto-resumes the countdown, always shows the paused panel first', () => {
    for (const { source } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(/const \[manuallyPaused, setManuallyPaused\] = useState\(\(\) => Boolean\(trustedSnapshot\)\);/);
    }
  });

  it('onLeaveLiveStep snapshots the exact current countdown/phase/music-choice state right before leaving, tagged with this exact sessionId+stepId', () => {
    for (const { source, sessionId, stepId } of Object.values(TIMED_PAGES)) {
      expect(source).toMatch(new RegExp(`onLeaveLiveStep: \\(\\) => savePausedExerciseState\\('${sessionId}', '${stepId}', \\{`));
    }
  });

  // Section 7 requirement: a snapshot from one timed step must never be
  // consumed by a different one, even within the SAME routine (e.g.
  // Breathe vs Stretch, both Morning) - guaranteed structurally since
  // every save/load/clear call above always passes ITS OWN literal
  // sessionId+stepId pair, never a shared/generic key, and
  // timedExercisePause.js itself additionally validates the snapshot's
  // own recorded sessionId/stepId on load (see that file's own tests).
  it('every timed page uses its own distinct (sessionId, stepId) pair - no two pages share a key', () => {
    const pairs = Object.values(TIMED_PAGES).map(({ sessionId, stepId }) => `${sessionId}::${stepId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('EveningBreathing now has the same Pause Exercise / ExercisePausedPanel infrastructure as Breathe/MorningFlow (release-blocking consistency fix - it originally had none)', () => {
    expect(eveningBreathingSource).toMatch(/import \{ ExercisePausedPanel \} from '\.\.\/components\/ExercisePausedPanel';/);
    expect(eveningBreathingSource).toMatch(/const handlePauseExercise = \(\) => setManuallyPaused\(true\);/);
    expect(eveningBreathingSource).toMatch(/<ExercisePausedPanel/);
    expect(eveningBreathingSource).toMatch(/Pause Exercise/);
  });
});

describe('Affirmation.jsx - always reflects the CURRENT live intentions, including ones changed via review', () => {
  it('reads intentions fresh at render time - no snapshot/cache that could go stale after a reviewed intention change', () => {
    expect(affirmationSource).toMatch(/const affirmations = intentions\.map\(\(intention\) => \(\{\s*\n\s*intention,\s*\n\s*affirmation: getAffirmationForIntention\(intention\)\s*\n\s*\}\)\);/);
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

describe('PromptStepper.jsx - single-select persistence (Build 15, Phase 3): preset taps commit immediately, free text stays debounced, Skip/Clear cancel any pending save', () => {
  it('a preset tap (handleSelectPreset) commits and saves immediately - no debounce, since a tap is one discrete action, not a keystroke stream - and collapses the custom field, since a preset is now the sole authoritative answer', () => {
    const body = promptStepperSource.match(/const handleSelectPreset = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/clearPendingSave\(activePrompt\.id\);/);
    expect(body).toMatch(/setAnswers\(\(prev\) => \(\{ \.\.\.prev, \[activePrompt\.id\]: value \}\)\);/);
    expect(body).toMatch(/setCustomOpenByPrompt\(\(prev\) => \(\{ \.\.\.prev, \[activePrompt\.id\]: false \}\)\);/);
    expect(body).toMatch(/onChange\?\.\(activePrompt\.id, value\);/);
    expect(body).not.toMatch(/setTimeout/);
  });

  // Bug fix, found live: firing onChange (an async Supabase upsert) on
  // every keystroke with no ordering guarantee let a slower earlier
  // request's write land AFTER a faster later one's - reproduced live
  // typing "A calm walk outside" then reviewing back to it: the saved/
  // reloaded value was truncated to "A calm walk outsi". Debouncing
  // collapses a burst of keystrokes into one save; local `answers` state
  // (and therefore handleComplete's own final flush) is unaffected since
  // it still updates synchronously on every keystroke, never debounced.
  it('free-text typing (handleCustomChange) still debounces the onChange call per-prompt, clearing any pending timer for that prompt on each keystroke', () => {
    expect(promptStepperSource).toMatch(/const debounceTimersRef = useRef\(\{\}\);/);
    const body = promptStepperSource.match(/const handleCustomChange = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setAnswers\(\(prev\) => \(\{ \.\.\.prev, \[promptId\]: value \}\)\);/);
    expect(body).toMatch(/clearPendingSave\(promptId\);/);
    expect(body).toMatch(/debounceTimersRef\.current\[promptId\] = setTimeout\(\(\) => \{\s*\n\s*onChange\?\.\(promptId, value\);\s*\n\s*\}, CHANGE_DEBOUNCE_MS\);/);
    // local state must update synchronously (not inside the debounced
    // timer) so handleComplete's flush always has the true latest value
    const setAnswersIdx = body.indexOf('setAnswers(');
    const timeoutIdx = body.indexOf('setTimeout(');
    expect(setAnswersIdx).toBeGreaterThan(-1);
    expect(setAnswersIdx).toBeLessThan(timeoutIdx);
  });

  // Persistence-safety fix, found while implementing Skip's "does not
  // fabricate or overwrite an answer" guarantee: typing (debounced 400ms)
  // then tapping Skip before that timer fired used to leave the pending
  // save scheduled - it would land AFTER Skip's own delete, silently
  // resurrecting the "skipped" answer. Skip (and Clear) now cancel any
  // pending save for the active prompt first.
  it('Skip cancels any pending debounced save for the active prompt before clearing its answer', () => {
    const body = promptStepperSource.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    const clearIdx = body.indexOf('clearPendingSave(promptId)');
    const deleteIdx = body.indexOf('delete rest[promptId]');
    expect(clearIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(clearIdx);
  });

  it('Clear also cancels any pending debounced save before deleting the answer', () => {
    const body = promptStepperSource.match(/const handleConfirmClear = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/clearPendingSave\(promptId\);/);
  });

  it('Next/Skip on a non-last question call onAdvance(activeIndex + 1) - a real navigate() owned by the calling page, never local setState', () => {
    expect(promptStepperSource).toMatch(/onAdvance\?\.\(activeIndex \+ 1\);/);
    expect(promptStepperSource).not.toMatch(/setActiveIndex/);
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
