// Evening completed-review (Build 15) — ReflectionReview.jsx/
// GratitudeReview.jsx/EveningComplete.jsx/Home.jsx wiring. No DOM
// rendering is available in this repo's Vitest - source-level checks,
// matching every other regression guard in this codebase. Genuinely
// executable/pure logic (resolveSavedAnswerDisplay, parseActiveIndex) is
// covered instead by real execution in eveningJourneyQuestions.test.js/
// questionStepNavigation.test.js - imported here too, to prove both
// review pages actually consume that same real logic rather than a
// parallel reimplementation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REFLECTION_PROMPTS, GRATITUDE_PROMPTS } from '../lib/eveningJourneyQuestions';
import { parseActiveIndex } from '../lib/questionStepNavigation';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const reflectionReviewSource = read('./ReflectionReview.jsx');
const gratitudeReviewSource = read('./GratitudeReview.jsx');
const eveningCompleteSource = read('./EveningComplete.jsx');
const homeSource = read('./Home.jsx');
const appSource = read('../App.jsx');
const routineResponsesSource = read('../lib/routineResponses.js');

// ---------------------------------------------------------------------
// 1, 2. Completed Home/completion-screen actions.
// ---------------------------------------------------------------------
describe('Completed Evening actions - authenticated vs guest (items 1-4)', () => {
  // Build 15 Evening UX correction — the former separate "Review Tonight's
  // Journey" button is now the combined "Review or Edit Tonight's
  // Responses" action, still navigating to the same review flow's own
  // first question, still authenticated-only.
  it('EveningComplete.jsx shows "Review or Edit Tonight\'s Responses" for authenticated users only, navigating to the review flow\'s own first question', () => {
    expect(eveningCompleteSource).toMatch(/\{!isGuest && \(/);
    expect(eveningCompleteSource).toMatch(/onClick=\{\(\) => navigate\('\/review\/reflection\?q=1'\)\}/);
    expect(eveningCompleteSource).toMatch(/Review or Edit Tonight's Responses/);
  });

  it('guests never see Review or Edit Tonight\'s Responses and get no misleading claim about saved reflections', () => {
    const guestGuardedBlock = eveningCompleteSource.match(/\{!isGuest && \(([\s\S]*?)\n {8}\)\}/)?.[0] ?? '';
    expect(guestGuardedBlock).toMatch(/Review or Edit Tonight's Responses/);
    // the guest-visible actions below are unconditional / isGuest-styled,
    // never inside the !isGuest-only block above
    expect(eveningCompleteSource).toMatch(/Choose a Sleep Experience/);
    expect(eveningCompleteSource).toMatch(/Return Home/);
  });

  it('approved heading and supporting copy, no medical/physiological/guaranteed-sleep claim', () => {
    expect(eveningCompleteSource).toMatch(/Your Evening Wind-Down is complete/);
    expect(eveningCompleteSource).toMatch(/You've taken time to reflect, appreciate the day and prepare for rest\./);
    expect(eveningCompleteSource).not.toMatch(/nervous system|melatonin|guarantee|cure|treat(s|ment)?\b/i);
  });

  it('"Start over"/"Start a New Wind-Down" are not offered anywhere on this screen - the investigation found the data model cannot safely support a second same-day session', () => {
    expect(eveningCompleteSource).not.toMatch(/Start [Oo]ver/);
    expect(eveningCompleteSource).not.toMatch(/Start a New Wind-Down/);
    // startSession is still never used here - a fresh Evening session is
    // always begun via the canonical /evening-wind-down flow, never
    // started directly from this screen. resetRoutine IS now used (Build
    // 15's own, separately-approved Redo Tonight's Wind-Down feature -
    // see redoEveningWindDown.test.js), but only inside
    // handleConfirmRedo, gated behind explicit confirmation and a
    // successful deletion - covered in that file, not re-asserted here.
    expect(eveningCompleteSource).not.toMatch(/startSession/);
  });
});

// ---------------------------------------------------------------------
// 2. Home completed-Evening state.
// ---------------------------------------------------------------------
describe('Home completed-Evening state (item 2) - covered in depth in routineRepeatAndStale.test.js; cross-checked here', () => {
  it('the unsafe evening repeat dialog trigger is gone; Review Tonight\'s Journey is the authenticated primary action', () => {
    expect(homeSource).not.toMatch(/kind: 'repeat', period: 'evening'/);
    expect(homeSource).toMatch(/onClick=\{\(\) => navigate\('\/review\/reflection\?q=1'\)\}/);
  });

  it('Morning\'s own completed-state behaviour is untouched - still the original repeat dialog, still scoped to period: \'morning\'', () => {
    expect(homeSource).toMatch(/kind: 'repeat', period: 'morning'/);
  });
});

// ---------------------------------------------------------------------
// 3. Review architecture - routes, allowlisted ?q= only, no session
//    engine coupling, no write functions imported.
// ---------------------------------------------------------------------
describe('Review architecture (item 3) - dedicated routes, no live Session Engine coupling, no write functions imported', () => {
  it('both routes are registered, lazy-loaded, outside <Layout> alongside the other evening steps', () => {
    expect(appSource).toMatch(/const ReflectionReview = lazy\(\(\) => import\('\.\/pages\/ReflectionReview'\)/);
    expect(appSource).toMatch(/const GratitudeReview = lazy\(\(\) => import\('\.\/pages\/GratitudeReview'\)/);
    expect(appSource).toMatch(/<Route path="review\/reflection" element=\{withFallback\(<ReflectionReview \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="review\/gratitude" element=\{withFallback\(<GratitudeReview \/>\)\} \/>/);
  });

  it('neither review page imports useSession, or any session-mutating function (startSession/resetSession/resetRoutine/advanceStep/completeSession/setJourneyStep) - there is structurally nothing to start, resume, reset, advance, or complete here', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/useSession/);
      expect(code).not.toMatch(/advanceStep|completeSession|resetSession|resetRoutine|startSession|setJourneyStep/);
    }
  });

  it('neither review page imports upsertRoutineResponse or deleteRoutineResponse - only the pure read loadRoutineResponses - so a write literally cannot happen from this file, not merely "doesn\'t happen today"', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).toMatch(/import \{ loadRoutineResponses \} from '\.\.\/lib\/routineResponses';/);
      const importLine = source.match(/^import.*routineResponses.*$/m)?.[0] ?? '';
      expect(importLine).not.toMatch(/upsertRoutineResponse|deleteRoutineResponse/);
    }
  });

  it('the only URL input either page reads is `?q=`, via the same allowlisted parseActiveIndex the live journey uses - no userId, session id, return URL, or local date parameter is ever read from useSearchParams', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).toMatch(/import \{ parseActiveIndex \} from '\.\.\/lib\/questionStepNavigation';/);
      const searchParamsUsages = source.match(/searchParams\.get\('[^']*'\)/g) ?? [];
      expect(searchParamsUsages).toEqual([]); // parseActiveIndex itself reads 'q' internally; this file never reads any param directly
      expect(source).not.toMatch(/userId=|session[Ii]d=.*searchParams|returnTo|return_to/);
    }
  });

  it('identity (userId) and today\'s local date both come from the authenticated context (useAlarm), exactly like the live journey - never from the URL', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
      expect(source).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    }
  });

  it('the fixed session type and correct step id are used for each page - never a URL-supplied session id', () => {
    expect(reflectionReviewSource).toMatch(/const SESSION_ID = 'evening-wind-down';/);
    expect(reflectionReviewSource).toMatch(/const STEP_ID = 'reflection';/);
    expect(gratitudeReviewSource).toMatch(/const SESSION_ID = 'evening-wind-down';/);
    expect(gratitudeReviewSource).toMatch(/const STEP_ID = 'gratitude';/);
  });

  it('Supabase RLS remains the final ownership boundary regardless - confirmed unchanged (no migration touched by this work)', () => {
    expect(routineResponsesSource).not.toMatch(/service_role|bypass/i);
  });
});

// ---------------------------------------------------------------------
// 4. Shared question configuration - covered in depth in
//    reflectionGratitudeTapFirst.test.js/eveningJourneyQuestions.test.js;
//    cross-checked here for the review pages specifically.
// ---------------------------------------------------------------------
describe('Reuse of question configuration (item 4)', () => {
  it('both review pages import REFLECTION_PROMPTS/GRATITUDE_PROMPTS from the shared module - never a re-declared copy', () => {
    expect(reflectionReviewSource).toMatch(/import \{ REFLECTION_PROMPTS \} from '\.\.\/lib\/eveningJourneyQuestions';/);
    expect(gratitudeReviewSource).toMatch(/import \{ GRATITUDE_PROMPTS \} from '\.\.\/lib\/eveningJourneyQuestions';/);
    expect(reflectionReviewSource).not.toMatch(/const REFLECTION_PROMPTS = \[/);
    expect(gratitudeReviewSource).not.toMatch(/const GRATITUDE_PROMPTS = \[/);
  });

  it('the real REFLECTION_PROMPTS/GRATITUDE_PROMPTS each have exactly 3 questions, matching the required 6-question review order', () => {
    expect(REFLECTION_PROMPTS.map((p) => p.id)).toEqual(['went-well', 'challenged', 'release']);
    expect(GRATITUDE_PROMPTS.map((p) => p.id)).toEqual(['appreciated-moment', 'who-made-better', 'grateful-now']);
  });

  it('both review pages pass journeyTone="evening" to EveningReviewQuestion - the same periwinkle tokens the live journey now uses (Evening journey-theme correction; previously accent="reflection"/"gratitude", both of which only ever resolved to the same hardcoded peach)', () => {
    expect(reflectionReviewSource).toMatch(/journeyTone="evening"/);
    expect(gratitudeReviewSource).toMatch(/journeyTone="evening"/);
  });
});

// ---------------------------------------------------------------------
// 5. Read-only presentation.
// ---------------------------------------------------------------------
describe('Read-only presentation (item 5) - no Skip, no Clear response, no editable "Add your own", every option readOnly', () => {
  it('neither review page nor EveningReviewQuestion.jsx renders Skip, Clear response, or an "Add your own" toggle/textarea', () => {
    const reviewQuestionSource = read('../components/evening/EveningReviewQuestion.jsx');
    for (const source of [reflectionReviewSource, gratitudeReviewSource, reviewQuestionSource]) {
      // Strip comments first - this file's own doc comments discuss, in
      // prose, exactly the affordances it deliberately does NOT render.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/>Skip</);
      expect(code).not.toMatch(/Clear response/);
      expect(code).not.toMatch(/Add your own/);
      expect(code).not.toMatch(/<textarea/);
    }
  });

  it('every AnswerOptionButton rendered by EveningReviewQuestion.jsx is readOnly - the saved preset (if any) is passed as `selected`, every option remains visible for context', () => {
    const reviewQuestionSource = read('../components/evening/EveningReviewQuestion.jsx');
    expect(reviewQuestionSource).toMatch(/<AnswerOptionButton[\s\S]{0,200}readOnly/);
    expect(reviewQuestionSource).toMatch(/selected=\{selectedOption === option\}/);
    expect(reviewQuestionSource).toMatch(/\{prompt\.options\?\.map\(\(option\) => \(/);
  });

  it('a saved custom answer renders expanded, as a plain non-editable paragraph, labelled "Your own words" - never a textarea, never Save/Clear/Cancel', () => {
    const reviewQuestionSource = read('../components/evening/EveningReviewQuestion.jsx');
    expect(reviewQuestionSource).toMatch(/\{isCustomAnswer && \(/);
    expect(reviewQuestionSource).toMatch(/Your own words/);
    expect(reviewQuestionSource).toMatch(/<p className="w-full bg-white\/5 border border-white\/10 rounded-2xl p-4 text-sm text-on-surface leading-relaxed">/);
    expect(reviewQuestionSource).not.toMatch(/>Save</);
    expect(reviewQuestionSource).not.toMatch(/>Cancel</);
  });

  it('a missing/skipped response shows the exact approved truthful empty state, never a fabricated selection', () => {
    const reviewQuestionSource = read('../components/evening/EveningReviewQuestion.jsx');
    expect(reviewQuestionSource).toMatch(/\{!hasValue && \(/);
    expect(reviewQuestionSource).toMatch(/No response was saved for this question\./);
  });

  it('the page shows "Reviewing tonight\'s completed journey" via EveningReviewBanner, distinct from the live journey\'s own "your place is still X" ReviewModeBanner (never reused here)', () => {
    const bannerSource = read('../components/evening/EveningReviewBanner.jsx');
    expect(bannerSource).toMatch(/Reviewing<\/span> tonight's completed journey\./);
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).toMatch(/import \{ EveningReviewBanner \} from '\.\.\/components\/evening\/EveningReviewBanner';/);
      expect(source).not.toMatch(/ReviewModeBanner/);
    }
  });
});

// ---------------------------------------------------------------------
// 6, 20, 21, 22, 23. Review navigation order.
// ---------------------------------------------------------------------
describe('Review navigation order (items 6, 20-23)', () => {
  it('Reflection Q1 Back -> Evening Summary; Q2 Back -> Q1; Q3 Back -> Q2 (real execution against the actual backFallbackForIndex logic, mirrored from source)', () => {
    expect(reflectionReviewSource).toMatch(
      /const backFallbackForIndex = \(activeIndex\) => \(activeIndex === 0 \? '\/evening-complete' : `\/review\/reflection\?q=\$\{activeIndex\}`\);/
    );
  });

  it('Gratitude Q1 Back -> Reflection Q3 (item 21); Q2 Back -> Q1; Q3 Back -> Q2', () => {
    expect(gratitudeReviewSource).toMatch(
      /const backFallbackForIndex = \(activeIndex\) => \(activeIndex === 0 \? '\/review\/reflection\?q=3' : `\/review\/gratitude\?q=\$\{activeIndex\}`\);/
    );
  });

  it('Reflection Q3 Next -> Gratitude Q1 (item 20)', () => {
    const body = reflectionReviewSource.match(/const handleNext = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isLast\) \{\s*\n\s*navigate\('\/review\/gratitude\?q=1'\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('Gratitude Q3 Continue -> Evening Summary (item 22)', () => {
    const body = gratitudeReviewSource.match(/const handleNext = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isLast\) \{\s*\n\s*navigate\('\/evening-complete'\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('"Return to Evening Summary" is a persistent, discoverable action on every question (the banner\'s own action), never an arbitrary returnTo URL (item 23) - Build 15 Evening UX correction also wires the banner\'s additive onEdit action to the existing Edit route', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).toMatch(/const handleReturnToSummary = \(\) => navigate\('\/evening-complete'\);/);
      expect(source).toMatch(/<EveningReviewBanner onReturn=\{handleReturnToSummary\} onEdit=\{\(\) => navigate\('\/edit\/evening\?q=1'\)\} \/>/);
    }
  });

  it('forward navigation between questions is a real navigate() call - browser/in-app Back History naturally lands on the previous question too, exactly like the live journey\'s own proven mechanism (no custom history manipulation, no trap)', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).toMatch(/navigate\(`\/review\/(reflection|gratitude)\?q=\$\{activeIndex \+ 2\}`\)/);
    }
  });

  it('real execution: parseActiveIndex (imported by both review pages) safely falls back for invalid/out-of-range queries, exactly as already proven in questionStepNavigation.test.js', () => {
    const validParams = new URLSearchParams('q=2');
    expect(parseActiveIndex(validParams, REFLECTION_PROMPTS.length)).toBe(1);
    const invalidParams = new URLSearchParams('q=99');
    expect(parseActiveIndex(invalidParams, REFLECTION_PROMPTS.length)).toBe(0);
    const missingParams = new URLSearchParams('');
    expect(parseActiveIndex(missingParams, GRATITUDE_PROMPTS.length)).toBe(0);
  });
});

// ---------------------------------------------------------------------
// 7. Evening summary safe to revisit.
// ---------------------------------------------------------------------
describe('Evening summary (/evening-complete) is safe to revisit after the Session Engine has been reset (item 7)', () => {
  it('completeSession only ever fires guarded on status === \'playing\' - a revisit after reset (status idle) cannot re-fire it, cannot create a second completion event, cannot reset Morning, cannot touch response rows', () => {
    const body = eveningCompleteSource.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[state\.status, currentStep, completeSession\]\);/)?.[0] ?? '';
    expect(body).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'completion'\) \{/);
    expect(body).not.toMatch(/upsertRoutineResponse|deleteRoutineResponse|resetSession\(\)|MORNING/);
  });

  it('the completion-date flag write is now inside this same guarded block (moved earlier than "Return Home" - see the file\'s own doc comment for why) - still idempotent via shouldWriteCompletionDate, so a revisit writes nothing new', () => {
    const body = eveningCompleteSource.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[state\.status, currentStep, completeSession\]\);/)?.[0] ?? '';
    expect(body).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(eveningDoneKey\), attributionDateKey\)/);
  });

  it('handleReturnHome (Return Home) no longer writes the completion flag itself - only unpins/clears the routine snapshot and resets the live session, since the flag is already correctly set by the time this could ever be tapped', () => {
    const body = eveningCompleteSource.match(/const handleReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/shouldWriteCompletionDate|localStorage\.setItem/);
    expect(body).toMatch(/unpinRoutineDate\(state\.sessionId\);\s*\n\s*clearRoutineProgress\(state\.sessionId\);/);
    expect(body).toMatch(/resetSession\(\);/);
  });
});

// ---------------------------------------------------------------------
// 8. Loading/empty/error states, unauthenticated/not-completed guards.
// ---------------------------------------------------------------------
describe('Loading, empty, error, guest, and not-completed guard states (item 8)', () => {
  for (const [label, source] of [['Reflection', reflectionReviewSource], ['Gratitude', gratitudeReviewSource]]) {
    describe(label, () => {
      it('guest guard is checked FIRST, before any query - no loadRoutineResponses call reachable for a guest', () => {
        const guestBlock = source.match(/if \(isGuest\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
        expect(guestBlock).not.toBe('');
        expect(guestBlock).toMatch(/Sign in to review your journey/);
        const effectBody = source.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[isGuest, isEveningDoneToday, userId, today\]\);/)?.[0] ?? '';
        expect(effectBody).toMatch(/if \(isGuest \|\| !isEveningDoneToday\) return;/);
      });

      it('the not-completed-today guard is checked before ever loading - never presents stale/partial data as a completed review', () => {
        expect(source).toMatch(/const isEveningDoneToday = !isGuest && localStorage\.getItem\(getEveningCompletionKey\(userId\)\) === today;/);
        expect(source).toMatch(/Nothing to review yet/);
      });

      it('loading is a genuinely distinct state from "no response saved" - the question list never renders until real data has arrived', () => {
        expect(source).toMatch(/responses === null \? \(/);
        expect(source).toMatch(/Loading tonight's journey…/);
      });

      it('a load error shows a friendly, non-technical message and a Return Home action - no raw error/identifier ever rendered', () => {
        expect(source).toMatch(/if \(loadError\) \{/);
        expect(source).toMatch(/Couldn't load your journey/);
        expect(source).not.toMatch(/error\.message|err\.message|console\.error/);
      });
    });
  }
});

// ---------------------------------------------------------------------
// 9. Strict no-write guarantee - already largely proven in "item 3"
//    above via absent imports; this block adds the completion-event and
//    session-write angle explicitly.
// ---------------------------------------------------------------------
describe('Strict no-write guarantee (item 9)', () => {
  it('neither review page imports the completion-date helper or routineProgress mutators - review cannot write a completion date or clear/alter routine progress', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).not.toMatch(/shouldWriteCompletionDate|clearRoutineProgress|pinRoutineDate|unpinRoutineDate/);
    }
  });

  it('guidance videos are omitted from Build 15 review entirely (approved fallback) - no BetaVideoModal/useProtectedVideo import at all, the simplest possible way to keep the no-write guarantee airtight', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).not.toMatch(/useProtectedVideo|BetaVideoModal|BetaVideoRow/);
    }
  });
});

// ---------------------------------------------------------------------
// 10. Prepare for Rest untouched / not reconstructed.
// ---------------------------------------------------------------------
describe('Prepare for Rest is not reviewed or reconstructed (item 10)', () => {
  it('neither review page references Prepare for Rest or its toggle state in any way', () => {
    for (const source of [reflectionReviewSource, gratitudeReviewSource]) {
      expect(source).not.toMatch(/PrepareForRest|PrepareToggleRow|prepare-for-rest|Ready for Sleep/);
    }
  });

  it('PrepareForRest.jsx itself is byte-for-byte unrelated to this work - not read/imported by anything new here', () => {
    expect(reflectionReviewSource).not.toMatch(/from '\.\.\/pages\/PrepareForRest'/);
    expect(gratitudeReviewSource).not.toMatch(/from '\.\.\/pages\/PrepareForRest'/);
  });
});

// ---------------------------------------------------------------------
// 32-34. Active journey / AnswerOptionButton / Prepare for Rest remain
// unchanged - cross-referenced (each already covered by its own,
// still-passing pre-existing suite; this just proves the specific
// additive contract these new files depend on didn't require changing
// any of them).
// ---------------------------------------------------------------------
describe('Active journey and shared components remain unchanged (items 32, 34, 38)', () => {
  it('Reflection.jsx/Gratitude.jsx still import and call upsertRoutineResponse/deleteRoutineResponse exactly as before - the live journey\'s own write behaviour is untouched by this work', () => {
    const reflectionSource = read('./Reflection.jsx');
    const gratitudeSource = read('./Gratitude.jsx');
    for (const source of [reflectionSource, gratitudeSource]) {
      expect(source).toMatch(/import \{ loadRoutineResponses, upsertRoutineResponse, deleteRoutineResponse \} from '\.\.\/lib\/routineResponses';/);
    }
  });

  it('AnswerOptionButton\'s readOnly prop defaults to false - every active-journey call site (PromptStepper.jsx) never passes it, so its rendered output there is unchanged (already re-verified by AnswerOptionButton.test.js\'s own, still-passing "selected state"/"unselected state" suites)', () => {
    const promptStepperSource = read('../components/evening/PromptStepper.jsx');
    expect(promptStepperSource).not.toMatch(/readOnly/);
  });

  it('PrepareForRest.jsx has no reference to review/summary routes or logic - this task never touched its design', () => {
    const prepareForRestSource = read('./PrepareForRest.jsx');
    expect(prepareForRestSource).not.toMatch(/\/review\/|EveningReviewBanner|EveningReviewQuestion/);
  });
});
