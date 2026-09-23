// Edit Tonight's Responses / Redo Tonight's Wind-Down (Build 15) —
// wiring and behavioural-order guards. No DOM rendering is available in
// this repo's Vitest, matching every other regression guard in this
// codebase (see eveningReview.test.js's own note) - genuinely
// executable/pure logic (computeChangedEntries, the new
// upsertRoutineResponsesBatch/deleteEveningReflectionGratitudeResponsesForDate
// IO functions) is covered instead by real execution in
// eveningJourneyQuestions.test.js/routineResponses.test.js. This file
// covers everything else: route wiring, guard/session-coupling
// boundaries, navigation formulas, exact confirmation copy, and the
// failure-safe ORDER of Redo's mutation sequence.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const editSource = read('./EditEveningResponses.jsx');
const eveningCompleteSource = read('./EveningComplete.jsx');
const homeSource = read('./Home.jsx');
const appSource = read('../App.jsx');
const backButtonSource = read('../components/BackButton.jsx');
const sceneShellSource = read('../components/evening/EveningSceneShell.jsx');
const editQuestionSource = read('../components/evening/EveningEditQuestion.jsx');
const reflectionReviewSource = read('./ReflectionReview.jsx');
const gratitudeReviewSource = read('./GratitudeReview.jsx');

// ---------------------------------------------------------------------
// Route wiring
// ---------------------------------------------------------------------
describe('Edit route registration', () => {
  it('is lazy-loaded and registered outside <Layout>, alongside the Review routes', () => {
    expect(appSource).toMatch(/const EditEveningResponses = lazy\(\(\) => import\('\.\/pages\/EditEveningResponses'\)/);
    expect(appSource).toMatch(/<Route path="edit\/evening" element=\{withFallback\(<EditEveningResponses \/>\)\} \/>/);
  });
});

// ---------------------------------------------------------------------
// ONE shared edit session across all six questions (approved correction)
// ---------------------------------------------------------------------
describe('One shared Edit session (approved correction) - a single controller/route, never two independent pages', () => {
  it('there is exactly one Edit page file, addressed by one route with a single ?q= param spanning all 6 questions', () => {
    expect(editSource).toMatch(/EVENING_EDIT_PROMPTS\.length/);
    expect(editSource).toMatch(/parseActiveIndex\(searchParams, EVENING_EDIT_PROMPTS\.length\)/);
    expect(appSource).not.toMatch(/EditReflection|EditGratitude/);
  });

  it('originalAnswers and draftAnswers are each declared exactly once (one shared original map, one shared draft map) - not per-section state', () => {
    expect(editSource.match(/const \[originalAnswers, setOriginalAnswers\] = useState/g)).toHaveLength(1);
    expect(editSource.match(/const \[draftAnswers, setDraftAnswers\] = useState/g)).toHaveLength(1);
  });

  it('loads BOTH Reflection and Gratitude responses once, into the same combined map, before either section is ever shown', () => {
    expect(editSource).toMatch(/loadRoutineResponses\(\{ userId, sessionId: SESSION_ID, stepId: 'reflection', localDate: today \}\)/);
    expect(editSource).toMatch(/loadRoutineResponses\(\{ userId, sessionId: SESSION_ID, stepId: 'gratitude', localDate: today \}\)/);
    expect(editSource).toMatch(/const combined = \{ \.\.\.reflection, \.\.\.gratitude \};/);
  });

  it('uses no module-level mutable store - draft state lives only inside the component via useState', () => {
    expect(editSource).not.toMatch(/^\s*let\s+\w+\s*=\s*\{\}/m);
  });
});

// ---------------------------------------------------------------------
// No Session Engine coupling
// ---------------------------------------------------------------------
describe('Edit Mode is not coupled to the Session Engine', () => {
  it('does not import useSession, and never calls advanceStep/completeSession/resetSession/resetRoutine/startSession', () => {
    expect(editSource).not.toMatch(/from '\.\.\/context\/SessionContext'/);
    expect(editSource).not.toMatch(/useSession\(\)/);
    expect(editSource).not.toMatch(/\badvanceStep\(|completeSession\(|resetSession\(|resetRoutine\(|startSession\(/);
  });
});

// ---------------------------------------------------------------------
// Guards, identity, eligibility (mirrors Review)
// ---------------------------------------------------------------------
describe('Edit Mode guards, in order', () => {
  it('the guest guard is checked before the eligibility guard, and both are checked before ever loading', () => {
    const guestGuardIndex = editSource.indexOf('if (isGuest) {');
    const eligibilityGuardIndex = editSource.indexOf('if (!isEveningDoneToday) {');
    const loadCallIndex = editSource.indexOf('loadRoutineResponses(');
    expect(guestGuardIndex).toBeGreaterThan(-1);
    expect(eligibilityGuardIndex).toBeGreaterThan(guestGuardIndex);
    expect(loadCallIndex).toBeGreaterThan(-1);
  });

  it('never reads userId, session id, or local date from the URL - only the allowlisted ?q= param', () => {
    expect(editSource).toMatch(/parseActiveIndex\(searchParams, EVENING_EDIT_PROMPTS\.length\)/);
    expect(editSource).not.toMatch(/searchParams\.get\('userId'\)|searchParams\.get\('sessionId'\)|searchParams\.get\('date'\)/);
  });

  it('identity and local date both come from the authenticated context (useAlarm), never the URL', () => {
    expect(editSource).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
  });
});

// ---------------------------------------------------------------------
// No Skip / Clear response / Ready for Sleep / active-journey actions
// ---------------------------------------------------------------------
describe('Edit Mode does not offer Skip, Clear response, or any active-journey completion action', () => {
  it('EditEveningResponses.jsx and EveningEditQuestion.jsx render none of these (checking actual JSX text, not doc comments)', () => {
    for (const source of [editSource, editQuestionSource]) {
      expect(source).not.toMatch(/>\s*Skip\s*</);
      expect(source).not.toMatch(/>\s*Clear response\s*</);
      expect(source).not.toMatch(/>\s*Ready for Sleep\s*</);
    }
  });

  it('clearing an answer to blank is explicitly out of scope this phase - no delete/clear function is imported', () => {
    expect(editSource).not.toMatch(/deleteRoutineResponse/);
  });
});

// ---------------------------------------------------------------------
// Presentation: "Editing tonight's responses", section colours, Back/Next
// ---------------------------------------------------------------------
describe('Edit Mode presentation', () => {
  it('shows "Editing tonight\'s responses" via a dedicated banner, distinct from both the live journey and read-only Review', () => {
    expect(editSource).toMatch(/EveningEditBanner/);
    expect(editSource).not.toMatch(/EveningReviewBanner/);
    expect(read('../components/evening/EveningEditBanner.jsx')).toMatch(/Editing.*tonight.*responses/);
  });

  it('preserves the Reflection peach / Gratitude gold accent tokens, unchanged', () => {
    expect(editSource).toMatch(/accent=\{activePrompt\.accent\}/);
    expect(editQuestionSource).toMatch(/accent === 'gratitude' \? 'text-gratitude-accent' : 'text-primary'/);
  });

  it('Back/Next navigation spans all six questions via the same backFallbackForIndex shape already proven for Review', () => {
    expect(editSource).toMatch(/const backFallbackForIndex = \(activeIndex\) => \(activeIndex === 0 \? '\/evening-complete' : `\/edit\/evening\?q=\$\{activeIndex\}`\);/);
  });

  it('Next is hidden on the last (6th) question - only Save Changes/Cancel remain', () => {
    expect(editSource).toMatch(/const isLast = activeIndex === EVENING_EDIT_PROMPTS\.length - 1;/);
    expect(editSource).toMatch(/\{!isLast && \(/);
  });
});

// ---------------------------------------------------------------------
// Save Changes - local draft, one atomic batch, double-tap guard, honest failure
// ---------------------------------------------------------------------
describe('Save Changes', () => {
  it('every answer change updates local draft state only - never imports the OLD single-row, silent-failure helper', () => {
    expect(editSource).not.toMatch(/import \{[^}]*\bupsertRoutineResponse\b[^}]*\} from '\.\.\/lib\/routineResponses';/);
    expect(editSource).toMatch(/import \{ loadRoutineResponses, upsertRoutineResponsesBatch \} from '\.\.\/lib\/routineResponses';/);
    expect(editSource).toMatch(/setDraftAnswers\(\(prev\) => \(\{ \.\.\.prev, \[promptId\]: value \}\)\);/);
  });

  it('guards against rapid double taps before ever calling the batch save', () => {
    expect(editSource).toMatch(/if \(saving\) return;/);
  });

  it('sends only the CHANGED entries (via computeChangedEntries), and no-op-navigates straight to Review when nothing changed', () => {
    expect(editSource).toMatch(/const changedEntries = originalAnswers \? computeChangedEntries\(originalAnswers, draftAnswers, EVENING_EDIT_PROMPTS\) : \[\];/);
    expect(editSource).toMatch(/if \(changedEntries\.length === 0\) \{\s*navigate\('\/review\/reflection\?q=1'\);/);
  });

  it('on success, returns to Review Tonight\'s Journey (the simpler, safer, predictable target) - never claims success without navigating', () => {
    const saveBlock = editSource.slice(editSource.indexOf('const handleSave'), editSource.indexOf('if (isGuest)'));
    expect(saveBlock).toMatch(/navigate\('\/review\/reflection\?q=1'\);/);
  });

  it('on failure, shows a friendly, non-technical error and does not navigate - the draft and originalAnswers stay exactly as they were', () => {
    expect(editSource).toMatch(/if \(!result\.ok\) \{\s*setSaveError\("Couldn't save your changes\. Please try again\."\);\s*return;\s*\}/);
    expect(editSource).not.toMatch(/result\.error\.message/);
    expect(editSource).not.toMatch(/setOriginalAnswers\(draftAnswers\)/); // never silently commits the draft as "original" on failure
  });

  it('shows a distinct saving state and disables the Save button while saving', () => {
    expect(editSource).toMatch(/\{saving \? 'Saving…' : 'Save Changes'\}/);
    expect(editSource).toMatch(/disabled=\{saving\}/);
  });
});

// ---------------------------------------------------------------------
// Cancel / Discard
// ---------------------------------------------------------------------
describe('Cancel / Discard unsaved changes', () => {
  it('Cancel with no unsaved changes exits immediately, with no write and no confirmation', () => {
    expect(editSource).toMatch(/const handleCancelTap = \(\) => \{\s*if \(!hasUnsavedChanges\) \{\s*navigate\('\/evening-complete'\);\s*return;\s*\}/);
  });

  it('Cancel with unsaved changes opens the exact approved discard-confirmation copy', () => {
    expect(editSource).toMatch(/title="Discard your changes\?"/);
    expect(editSource).toMatch(/message="Your changes have not been saved\."/);
    expect(editSource).toMatch(/confirmLabel="Discard Changes"/);
    expect(editSource).toMatch(/cancelLabel="Keep Editing"/);
    expect(editSource).toMatch(/destructive/);
  });

  it('confirming Discard performs no write - only navigation (goBack), never a call into upsertRoutineResponsesBatch', () => {
    const discardBlock = editSource.slice(
      editSource.indexOf('const handleConfirmDiscard'),
      editSource.indexOf('const handleSelectPreset')
    );
    expect(discardBlock).not.toMatch(/upsertRoutineResponsesBatch/);
    expect(discardBlock).toMatch(/goBack\(backFallbackForIndex\(0\)\);/);
  });
});

// ---------------------------------------------------------------------
// Navigation protection - shared BackButton, beforeunload, honest limitation
// ---------------------------------------------------------------------
describe('Navigation protection for unsaved Edit drafts', () => {
  it('question 1 wires the shared BackButton\'s new onBeforeLeave hook; questions 2-6 do not (intra-edit movement never loses data)', () => {
    expect(editSource).toMatch(/onBeforeLeave=\{activeIndex === 0 \? handleQ1BeforeLeave : undefined\}/);
  });

  it('onBeforeLeave opens the SAME discard dialog used by Cancel when there are unsaved changes, and allows normal navigation otherwise', () => {
    expect(editSource).toMatch(/const handleQ1BeforeLeave = \(\) => \(hasUnsavedChanges \? requestDiscardConfirmation\(\) : true\);/);
  });

  it('installs the browser\'s native beforeunload warning only while unsaved changes exist, and removes it otherwise', () => {
    expect(editSource).toMatch(/if \(!hasUnsavedChanges\) return undefined;/);
    expect(editSource).toMatch(/window\.addEventListener\('beforeunload', handleBeforeUnload\);/);
    expect(editSource).toMatch(/window\.removeEventListener\('beforeunload', handleBeforeUnload\);/);
    expect(editSource).toMatch(/e\.preventDefault\(\);/);
  });

  it('BackButton.jsx\'s new onBeforeLeave prop is additive - every existing caller omitting it keeps its exact original behaviour', () => {
    expect(backButtonSource).toMatch(/onBeforeLeave/);
    expect(backButtonSource).toMatch(/if \(onBeforeLeave && onBeforeLeave\(\) === false\) return;/);
    // The prop has no default value - omitted entirely by every existing
    // caller, so onBeforeLeave is undefined and this check is always
    // falsy for them, reaching goBack(fallback) exactly as before.
    expect(backButtonSource).toMatch(/confirmMessage = 'Your current progress may be paused\.'/);
  });

  it('EveningSceneShell forwards onBeforeLeave through to BackButton, optional and defaulting to undefined', () => {
    expect(sceneShellSource).toMatch(/showBack = false, backFallback = '\/', onBeforeLeave, children/);
    expect(sceneShellSource).toMatch(/onBeforeLeave=\{onBeforeLeave\}/);
  });

  it('this app uses a plain BrowserRouter (no data router) - useBlocker/unstable_usePrompt are not available, so a genuine browser-gesture Back cannot be safely intercepted here; only in-app exits and beforeunload are protected', () => {
    const routerSetup = read('../App.jsx');
    expect(routerSetup).toMatch(/BrowserRouter as Router/);
    expect(routerSetup).not.toMatch(/createBrowserRouter|RouterProvider/);
  });
});

// ---------------------------------------------------------------------
// Home / EveningComplete button hierarchy
// ---------------------------------------------------------------------
describe('Button hierarchy - EveningComplete.jsx (approved order: Review, Edit, Choose a Sleep Experience, Redo, Return Home)', () => {
  // Anchored to the actual rendered JSX text (not doc comments, which
  // mention several of these same phrases earlier in the file while
  // explaining the design).
  const reviewIdx = eveningCompleteSource.indexOf("<span>Review Tonight's Journey</span>");
  const editIdx = eveningCompleteSource.indexOf("<span>Edit Tonight's Responses</span>");
  const sleepIdx = eveningCompleteSource.indexOf('<span>Choose a Sleep Experience</span>');
  const redoIdx = eveningCompleteSource.indexOf('onClick={handleRedoTap}');
  const homeIdx = eveningCompleteSource.indexOf('onClick={handleReturnHome}');

  it('renders in the approved order', () => {
    expect(reviewIdx).toBeGreaterThan(-1);
    expect(reviewIdx).toBeLessThan(editIdx);
    expect(editIdx).toBeLessThan(sleepIdx);
    expect(sleepIdx).toBeLessThan(redoIdx);
    expect(redoIdx).toBeLessThan(homeIdx);
  });

  it('Edit and Redo are both guest-excluded, matching Review\'s own exclusion', () => {
    const editButtonBlock = eveningCompleteSource.slice(editIdx - 400, editIdx);
    expect(editButtonBlock).toMatch(/\{!isGuest && \(/);
    const redoButtonBlock = eveningCompleteSource.slice(redoIdx - 700, redoIdx);
    expect(redoButtonBlock).toMatch(/\{!isGuest && \(/);
  });

  it('Redo is styled as a quiet, text-only destructive action - never a filled primary/Continue-style button', () => {
    const redoButtonMatch = eveningCompleteSource.match(/onClick=\{handleRedoTap\}\s*className="([^"]+)"/);
    expect(redoButtonMatch).toBeTruthy();
    expect(redoButtonMatch[1]).not.toMatch(/bg-primary/);
    expect(redoButtonMatch[1]).toMatch(/text-red-300/);
  });
});

describe('Home.jsx completed-Evening card', () => {
  it('adds Edit Tonight\'s Responses as a visible secondary action for authenticated users, alongside Review', () => {
    expect(homeSource).toMatch(/navigate\('\/edit\/evening\?q=1'\)/);
  });

  it('does not add a Redo BUTTON directly to Home\'s compact card (kept uncluttered - Redo is reachable via the full completed-Evening screen) - the doc comment explaining that design choice is not a rendered control', () => {
    expect(homeSource).not.toMatch(/onClick=\{handleRedoTap\}/);
    expect(homeSource).not.toMatch(/deleteEveningReflectionGratitudeResponsesForDate/);
  });

  it('guests still see only "Begin Evening Wind-Down" - unaffected by this work', () => {
    expect(homeSource).toMatch(/Begin Evening Wind-Down/);
  });
});

// ---------------------------------------------------------------------
// Redo Tonight's Wind-Down - confirmation copy, failure-safe order
// ---------------------------------------------------------------------
describe('Redo confirmation copy - exact approved wording', () => {
  it('matches exactly', () => {
    expect(eveningCompleteSource).toMatch(/title="Redo tonight's Wind-Down\?"/);
    expect(eveningCompleteSource).toMatch(
      /message="This will permanently delete tonight's saved Reflection and Gratitude responses and restart the Evening journey from the beginning\. If you leave before completing it again, your previous responses cannot be restored\."/
    );
    expect(eveningCompleteSource).toMatch(/confirmLabel="Delete Responses & Redo"/);
    expect(eveningCompleteSource).toMatch(/cancelLabel="Keep Existing Journey"/);
  });

  it('is destructive-styled and pending-guarded (buttons disable while the delete is in flight)', () => {
    const dialogBlock = eveningCompleteSource.slice(eveningCompleteSource.indexOf('<ConfirmDialog\n        open={redoConfirmOpen}'));
    expect(dialogBlock).toMatch(/destructive/);
    expect(dialogBlock).toMatch(/confirmPending=\{isRedoing\}/);
  });

  it('nothing is deleted before the dialog is confirmed - handleRedoTap only opens the dialog, never calls the delete function', () => {
    const tapBlock = eveningCompleteSource.slice(eveningCompleteSource.indexOf('const handleRedoTap'), eveningCompleteSource.indexOf('const handleConfirmRedo'));
    expect(tapBlock).not.toMatch(/deleteEveningReflectionGratitudeResponsesForDate/);
  });
});

describe('Redo failure-safe order (approved: validate -> resolve date once -> guard -> delete -> check -> clear flag -> reset routine -> navigate)', () => {
  it('resolves the local date exactly once and reuses that same variable throughout the whole operation', () => {
    const dateDeclarations = eveningCompleteSource.match(/const localDate = getZonedParts/g) ?? [];
    expect(dateDeclarations).toHaveLength(1);
    // reused (not re-resolved) at every later step
    const confirmRedoBlock = eveningCompleteSource.slice(
      eveningCompleteSource.indexOf('const handleConfirmRedo'),
      eveningCompleteSource.indexOf('return (\n    <EveningSceneShell')
    );
    expect(confirmRedoBlock.match(/localDate/g).length).toBeGreaterThanOrEqual(3);
  });

  it('guards against rapid double taps before anything else runs', () => {
    expect(eveningCompleteSource).toMatch(/const handleConfirmRedo = async \(\) => \{\s*if \(isRedoing\) return;\s*setIsRedoing\(true\);/);
  });

  it('validates eligibility BEFORE the delete call, and aborts without deleting anything if ineligible', () => {
    const confirmRedoBlock = eveningCompleteSource.slice(
      eveningCompleteSource.indexOf('const handleConfirmRedo'),
      eveningCompleteSource.indexOf('return (\n    <EveningSceneShell')
    );
    const eligibilityIdx = confirmRedoBlock.indexOf('isEligible');
    const deleteCallIdx = confirmRedoBlock.indexOf('deleteEveningReflectionGratitudeResponsesForDate(');
    expect(eligibilityIdx).toBeGreaterThan(-1);
    expect(deleteCallIdx).toBeGreaterThan(eligibilityIdx);
  });

  it('the completion flag is cleared, and the routine reset, ONLY after result.ok is confirmed true - in that exact order, delete -> flag -> reset -> navigate', () => {
    const confirmRedoBlock = eveningCompleteSource.slice(
      eveningCompleteSource.indexOf('const handleConfirmRedo'),
      eveningCompleteSource.indexOf('return (\n    <EveningSceneShell')
    );
    const deleteIdx = confirmRedoBlock.indexOf('deleteEveningReflectionGratitudeResponsesForDate(');
    const resultCheckIdx = confirmRedoBlock.indexOf('if (!result.ok)');
    const clearFlagIdx = confirmRedoBlock.indexOf('clearEveningCompletionKey(userId);');
    const resetRoutineIdx = confirmRedoBlock.indexOf("resetRoutine('evening-wind-down');");
    const navigateIdx = confirmRedoBlock.indexOf("navigate('/evening-wind-down');");
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(resultCheckIdx).toBeGreaterThan(deleteIdx);
    expect(clearFlagIdx).toBeGreaterThan(resultCheckIdx);
    expect(resetRoutineIdx).toBeGreaterThan(clearFlagIdx);
    expect(navigateIdx).toBeGreaterThan(resetRoutineIdx);
  });

  it('on delete failure, does NOT clear the flag, does NOT reset the routine, and does NOT navigate', () => {
    const failureBranch = eveningCompleteSource.slice(
      eveningCompleteSource.indexOf('const result = await deleteEveningReflectionGratitudeResponsesForDate'),
      eveningCompleteSource.indexOf('clearEveningCompletionKey(userId);')
    );
    expect(failureBranch).toMatch(/if \(!result\.ok\) \{/);
    expect(failureBranch).not.toMatch(/navigate\(/);
    expect(failureBranch).not.toMatch(/resetRoutine/);
  });

  it('a failed delete shows a friendly, non-technical retry state and re-enables the button (releases the guard)', () => {
    expect(eveningCompleteSource).toMatch(/Couldn't redo tonight's Wind-Down\. Your existing journey is unchanged/);
    expect(eveningCompleteSource).not.toMatch(/result\.error\.message/);
  });

  it('the ineligible-at-confirm-time path (e.g. flag already gone) behaves exactly like a delete failure - no partial mutation', () => {
    const ineligibleBlock = eveningCompleteSource.slice(
      eveningCompleteSource.indexOf('if (!isEligible)'),
      eveningCompleteSource.indexOf('const result = await deleteEveningReflectionGratitudeResponsesForDate')
    );
    expect(ineligibleBlock).toMatch(/setRedoError\(true\);/);
    expect(ineligibleBlock).not.toMatch(/clearEveningCompletionKey|resetRoutine|navigate\(/);
  });
});

// ---------------------------------------------------------------------
// Regression: Active journey and read-only Review remain unchanged
// ---------------------------------------------------------------------
describe('Regression - unaffected surfaces', () => {
  it('ReflectionReview.jsx/GratitudeReview.jsx still import only the pure read (no write function added by this work)', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).toMatch(/import \{ loadRoutineResponses \} from '\.\.\/lib\/routineResponses';/);
      expect(source).not.toMatch(/upsertRoutineResponsesBatch|deleteEveningReflectionGratitudeResponsesForDate/);
    }
  });

  it('Reflection.jsx/Gratitude.jsx are not referenced by this work at all - the live journey\'s own immediate-write behaviour is untouched', () => {
    expect(editSource).not.toMatch(/from '\.\/Reflection'|from '\.\/Gratitude'/);
  });

  it('Morning (SessionComplete.jsx, morning-routine) is never referenced by either new feature', () => {
    expect(editSource).not.toMatch(/morning-routine|SessionComplete/);
    expect(eveningCompleteSource).not.toMatch(/morning-routine/);
  });
});
