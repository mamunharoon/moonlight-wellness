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

  it('passes each question\'s own accent through to EveningEditQuestion - Gratitude now renders the same peach as Reflection (Build 15 Evening UX correction), not gold', () => {
    expect(editSource).toMatch(/accent=\{activePrompt\.accent\}/);
    expect(editQuestionSource).not.toMatch(/text-gratitude-accent/);
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
    expect(sceneShellSource).toMatch(/showBack = false, backFallback = '\/', onBeforeLeave, showExit = false, children/);
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
// Build 15 Evening UX correction — Choose a Sleep Experience is now
// first/primary; Review and Edit are combined into one action; Redo and
// Return Home keep their existing order/styling.
describe('Button hierarchy - EveningComplete.jsx (approved order: Choose a Sleep Experience, Review or Edit, Redo, Return Home)', () => {
  // Anchored to the actual rendered JSX text (not doc comments, which
  // mention several of these same phrases earlier in the file while
  // explaining the design).
  const sleepIdx = eveningCompleteSource.indexOf('<span>Choose a Sleep Experience</span>');
  const reviewOrEditIdx = eveningCompleteSource.indexOf("<span>Review or Edit Tonight's Responses</span>");
  const redoIdx = eveningCompleteSource.indexOf('onClick={handleRedoTap}');
  const homeIdx = eveningCompleteSource.indexOf('onClick={handleReturnHome}');

  it('renders in the approved order', () => {
    expect(sleepIdx).toBeGreaterThan(-1);
    expect(sleepIdx).toBeLessThan(reviewOrEditIdx);
    expect(reviewOrEditIdx).toBeLessThan(redoIdx);
    expect(redoIdx).toBeLessThan(homeIdx);
  });

  it('Choose a Sleep Experience is the first, primary filled action for every user (guest included) - its real destination is unchanged', () => {
    const sleepButtonMatch = eveningCompleteSource.match(/onClick=\{\(\) => navigate\('\/library\?category=sleep-soundscapes'\)\}\s*\n\s*className="([^"]+)"/);
    expect(sleepButtonMatch).toBeTruthy();
    expect(sleepButtonMatch[1]).toMatch(/bg-primary text-on-primary/);
    expect(sleepIdx).toBeLessThan(eveningCompleteSource.indexOf('{!isGuest && ('));
  });

  it('the separate Edit Tonight\'s Responses button is gone from this screen - Edit is reached from inside Review instead', () => {
    expect(eveningCompleteSource).not.toMatch(/navigate\('\/edit\/evening\?q=1'\)/);
    expect(eveningCompleteSource).not.toMatch(/>Edit Tonight's Responses</);
  });

  it('the combined Review-or-Edit action and Redo are both guest-excluded, matching the original Review exclusion', () => {
    const reviewOrEditBlock = eveningCompleteSource.slice(reviewOrEditIdx - 400, reviewOrEditIdx);
    expect(reviewOrEditBlock).toMatch(/\{!isGuest && \(/);
    const redoButtonBlock = eveningCompleteSource.slice(redoIdx - 700, redoIdx);
    expect(redoButtonBlock).toMatch(/\{!isGuest && \(/);
  });

  it('the combined action opens the existing read-only Review journey at Reflection Q1 - not a new route', () => {
    const reviewOrEditBlock = eveningCompleteSource.slice(reviewOrEditIdx - 400, reviewOrEditIdx);
    expect(reviewOrEditBlock).toMatch(/onClick=\{\(\) => navigate\('\/review\/reflection\?q=1'\)\}/);
  });

  it('Redo is styled as a quiet, text-only destructive action - never a filled primary/Continue-style button', () => {
    const redoButtonMatch = eveningCompleteSource.match(/onClick=\{handleRedoTap\}\s*className="([^"]+)"/);
    expect(redoButtonMatch).toBeTruthy();
    expect(redoButtonMatch[1]).not.toMatch(/bg-primary/);
    expect(redoButtonMatch[1]).toMatch(/text-red-300/);
  });
});

describe('Home.jsx completed-Evening card', () => {
  it('combines Review and Edit into one "Review or Edit Tonight\'s Responses" action, opening read-only Review first - the separate Edit button is gone', () => {
    expect(homeSource).toMatch(/Review or Edit Tonight's Responses/);
    expect(homeSource).not.toMatch(/>Edit Tonight's Responses</);
    expect(homeSource).not.toMatch(/navigate\('\/edit\/evening\?q=1'\)/);
  });

  // Build 15 addendum — Redo Tonight's Wind-Down is now ALSO reachable
  // directly from Home's own compact completed-Evening card, using the
  // same shared routineResponses.js#redoEveningWindDown workflow as
  // EveningComplete.jsx (see routineResponses.test.js for that shared
  // function's own behavioural coverage) - never a second, hand-rolled
  // copy of the eligibility/delete/flag/routine-reset sequence here.
  it('adds a Redo Tonight\'s Wind-Down action, wired to the shared redoEveningWindDown workflow - never a duplicated copy of the delete/reset logic', () => {
    expect(homeSource).toMatch(/import \{ redoEveningWindDown \} from '\.\.\/lib\/routineResponses';/);
    expect(homeSource).toMatch(/onClick=\{handleRedoTap\}/);
    expect(homeSource).not.toMatch(/deleteEveningReflectionGratitudeResponsesForDate/);
    expect(homeSource).not.toMatch(/clearEveningCompletionKey/);
    const confirmRedoBody = homeSource.match(/const handleConfirmRedo = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmRedoBody).toMatch(/await redoEveningWindDown\(\{ userId, isGuest, localDate: today, resetRoutine \}\);/);
  });

  it('Redo is guest-excluded, matching Review/Edit\'s own exclusion (rendered only inside the same !isGuest branch)', () => {
    const redoIdx = homeSource.indexOf('onClick={handleRedoTap}');
    const guestBranchIdx = homeSource.lastIndexOf(') : (', redoIdx);
    expect(guestBranchIdx).toBeGreaterThan(-1);
    expect(redoIdx).toBeGreaterThan(guestBranchIdx);
  });

  it('Redo is styled as a quiet, text-only destructive action on Home too - never a filled primary/Continue-style button', () => {
    const redoButtonMatch = homeSource.match(/onClick=\{handleRedoTap\}\s*className="([^"]+)"/);
    expect(redoButtonMatch).toBeTruthy();
    expect(redoButtonMatch[1]).not.toMatch(/bg-primary/);
    expect(redoButtonMatch[1]).toMatch(/text-red-300/);
  });

  it('uses the exact same approved confirmation copy as EveningComplete.jsx\'s own dialog', () => {
    expect(homeSource).toMatch(/title="Redo tonight's Wind-Down\?"/);
    expect(homeSource).toMatch(
      /message="This will permanently delete tonight's saved Reflection and Gratitude responses and restart the Evening journey from the beginning\. If you leave before completing it again, your previous responses cannot be restored\."/
    );
    expect(homeSource).toMatch(/confirmLabel="Delete Responses & Redo"/);
    expect(homeSource).toMatch(/cancelLabel="Keep Existing Journey"/);
  });

  it('is a separate ConfirmDialog/state from the existing activeDialog system (Redo is async and can fail; every activeDialog kind is synchronous)', () => {
    expect(homeSource).toMatch(/const \[redoConfirmOpen, setRedoConfirmOpen\] = useState\(false\);/);
    expect(homeSource).toMatch(/const \[isRedoing, setIsRedoing\] = useState\(false\);/);
    expect(homeSource).toMatch(/const \[redoError, setRedoError\] = useState\(false\);/);
    expect(homeSource).toMatch(/<ConfirmDialog\s*\n\s*open=\{redoConfirmOpen\}/);
    expect(homeSource).toMatch(/confirmPending=\{isRedoing\}/);
  });

  it('handleRedoTap only opens the dialog - nothing is deleted before confirmation', () => {
    const tapBody = homeSource.match(/const handleRedoTap = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(tapBody).not.toMatch(/redoEveningWindDown/);
    expect(tapBody).toMatch(/setRedoConfirmOpen\(true\);/);
  });

  it('navigates to /evening-wind-down only on a successful redo, and shows the shared retry-safe error copy on failure - never partially, matching EveningComplete.jsx\'s own outcome handling', () => {
    const confirmRedoBody = homeSource.match(/const handleConfirmRedo = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmRedoBody).toMatch(/if \(!result\.ok\) \{\s*setRedoError\(true\);\s*return;\s*\}/);
    expect(confirmRedoBody).toMatch(/navigate\('\/evening-wind-down'\);/);
    expect(homeSource).toMatch(/Couldn't redo tonight's Wind-Down\. Your existing journey is unchanged/);
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

// Build 15 addendum — the actual failure-safe eligibility/delete/flag/
// routine-reset ORDER now lives in ONE place, routineResponses.js's own
// redoEveningWindDown (see routineResponses.test.js for real behavioural
// coverage of that exact order, against a mocked Supabase). What remains
// here is EveningComplete.jsx's own thin wrapper: guard against rapid
// double taps, resolve today's local date once, call the shared
// function, and translate its result into this screen's own error/
// navigation UI - never a second copy of the underlying sequence.
describe('EveningComplete.jsx\'s handleConfirmRedo - thin wrapper around the shared redoEveningWindDown workflow', () => {
  it('imports the shared function - never the raw delete/clear-flag primitives directly', () => {
    expect(eveningCompleteSource).toMatch(/import \{ redoEveningWindDown \} from '\.\.\/lib\/routineResponses';/);
    expect(eveningCompleteSource).not.toMatch(/deleteEveningReflectionGratitudeResponsesForDate/);
    expect(eveningCompleteSource).not.toMatch(/clearEveningCompletionKey/);
  });

  it('guards against rapid double taps before anything else runs', () => {
    expect(eveningCompleteSource).toMatch(/const handleConfirmRedo = async \(\) => \{\s*if \(isRedoing\) return;\s*setIsRedoing\(true\);/);
  });

  it('resolves the local date exactly once and passes it, along with userId/isGuest/resetRoutine, straight to the shared function', () => {
    const confirmRedoBody = eveningCompleteSource.match(/const handleConfirmRedo = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmRedoBody.match(/const localDate = getZonedParts/g)).toHaveLength(1);
    expect(confirmRedoBody).toMatch(/await redoEveningWindDown\(\{ userId, isGuest, localDate, resetRoutine \}\);/);
  });

  it('navigates to /evening-wind-down only on a successful result, and shows the friendly retry-safe error otherwise - never both, never neither', () => {
    const confirmRedoBody = eveningCompleteSource.match(/const handleConfirmRedo = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmRedoBody).toMatch(/if \(!result\.ok\) \{\s*setRedoError\(true\);\s*return;\s*\}/);
    expect(confirmRedoBody).toMatch(/navigate\('\/evening-wind-down'\);/);
  });

  it('a failed redo shows a friendly, non-technical retry state, never the raw error message', () => {
    expect(eveningCompleteSource).toMatch(/Couldn't redo tonight's Wind-Down\. Your existing journey is unchanged/);
    expect(eveningCompleteSource).not.toMatch(/result\.error\.message/);
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
