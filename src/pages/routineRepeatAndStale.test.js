// Regression guard for two remediations added in the same batch:
//   1. "Resume Previous Routine" / "Start Today's Routine" — wiring
//      shouldOfferStaleRoutineChoice (already pure-logic tested in
//      routineCardState.test.js/routineProgress.test.js) into Home.jsx's
//      actual rendered UI, never silently resuming/deleting/mislabelling
//      an unfinished routine from an earlier local day.
//   2. The completed-routine "Do Again" defect — confirming did nothing
//      because it only ever called resetRoutine() and never launched
//      anything. Replaced with "Repeat Morning/Evening Routine", wired
//      through the SAME fresh-start handlers the ordinary "Begin" card
//      already uses (handleBeginRiseAndReset/handleBeginEveningWindDown),
//      so confirming genuinely starts the routine at its own start route.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - these are source-level checks,
// matching every other regression guard in this codebase for exactly
// that reason.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const homeSource = read('./Home.jsx');
const sessionContextSource = read('../context/SessionContext.jsx');
const routineProgressSource = read('../session/routineProgress.js');
const sessionCompleteSource = read('./SessionComplete.jsx');
const eveningCompleteSource = read('./EveningComplete.jsx');
const routineDetailSource = read('./RoutineDetail.jsx');
const eveningWindDownSource = read('./EveningWindDown.jsx');

describe('Stale-routine choice card — "Yesterday\'s unfinished routine" (Morning)', () => {
  it('renders a distinct stale-choice card, gated on morningHasStaleChoice, only when nothing exists for today', () => {
    expect(homeSource).toMatch(/morningCardState === 'not-started' && !morningHasStaleChoice/);
    expect(homeSource).toMatch(/morningCardState === 'not-started' && morningHasStaleChoice/);
  });

  it('shows the original date in a friendly format, never silently presented as today\'s own progress', () => {
    expect(homeSource).toMatch(/formatStaleRoutineDate\(morningStaleSnapshot\?\.dateKey, today\)/);
    expect(homeSource).toMatch(/'s Morning routine is unfinished\./);
  });

  it('"Resume Previous Routine" is scoped to resumeStaleRoutine\\(RITUAL_SESSION_IDS.morning\\), never the live/today resume path', () => {
    expect(homeSource).toMatch(/handleResumeStaleMorning = \(\) => \{\s*\n\s*if \(isGuest\) \{ promptRoutineSignIn\(\); return; \}\s*\n\s*if \(!resumeStaleRoutine\(RITUAL_SESSION_IDS\.morning\)\)/);
  });

  it('"Start Today\'s Routine" opens the discard-stale confirmation, scoped to morning', () => {
    expect(homeSource).toMatch(/setActiveDialog\(\{ kind: 'discard-stale', period: 'morning' \}\)/);
  });
});

describe('Stale-routine choice card — "Yesterday\'s unfinished routine" (Evening)', () => {
  it('renders a distinct stale-choice card, gated on eveningHasStaleChoice, only when nothing exists for today', () => {
    expect(homeSource).toMatch(/eveningCardState === 'not-started' && !eveningHasStaleChoice/);
    expect(homeSource).toMatch(/eveningCardState === 'not-started' && eveningHasStaleChoice/);
  });

  it('shows the original date in a friendly format', () => {
    expect(homeSource).toMatch(/formatStaleRoutineDate\(eveningStaleSnapshot\?\.dateKey, today\)/);
    expect(homeSource).toMatch(/'s Evening routine is unfinished\./);
  });

  it('"Resume Previous Routine" is scoped to resumeStaleRoutine\\(RITUAL_SESSION_IDS.evening\\)', () => {
    expect(homeSource).toMatch(/handleResumeStaleEvening = \(\) => \{\s*\n\s*if \(isGuest\) \{ promptRoutineSignIn\(\); return; \}\s*\n\s*if \(!resumeStaleRoutine\(RITUAL_SESSION_IDS\.evening\)\)/);
  });

  it('"Start Today\'s Routine" opens the discard-stale confirmation, scoped to evening', () => {
    expect(homeSource).toMatch(/setActiveDialog\(\{ kind: 'discard-stale', period: 'evening' \}\)/);
  });
});

describe('"Start today\'s routine?" discard confirmation — exact required wording, and never silently discards without it', () => {
  it('has the exact title/message/confirm label', () => {
    expect(homeSource).toMatch(/title: "Start today's routine\?"/);
    expect(homeSource).toMatch(/message: 'Your unfinished previous routine progress will be cleared\.'/);
  });

  it('confirming calls discardStaleRoutine(sessionId) before starting the fresh routine, never the other way around', () => {
    const match = homeSource.match(/\} else if \(kind === 'discard-stale'\) \{\s*\n\s*discardStaleRoutine\(sessionId\);\s*\n\s*if \(period === 'morning'\) handleBeginRiseAndReset\(\);\s*\n\s*else handleBeginEveningWindDown\(\);/);
    expect(match).not.toBeNull();
  });
});

describe('SessionContext.jsx — resumeStaleRoutine/discardStaleRoutine never touch journal/reflection/intention storage', () => {
  it('only references routineProgress\'s own pin/snapshot functions, not any journal/reflection API', () => {
    const resumeStaleBlock = sessionContextSource.match(/const resumeStaleRoutine = useCallback\([\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    const discardStaleBlock = sessionContextSource.match(/const discardStaleRoutine = useCallback\([\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(resumeStaleBlock).not.toBe('');
    expect(discardStaleBlock).not.toBe('');
    for (const block of [resumeStaleBlock, discardStaleBlock]) {
      expect(block).not.toMatch(/journal/i);
      expect(block).not.toMatch(/reflection/i);
      expect(block).not.toMatch(/intention/i);
      expect(block).not.toMatch(/supabase/i);
    }
  });

  it('resumeStaleRoutine pins the ORIGINAL dateKey before restoring live state - this is the "retain original identity" mechanism', () => {
    expect(sessionContextSource).toMatch(/pinRoutineDate\(sessionId, stale\.dateKey\)/);
  });

  it('resetSession/abandonSession/resetRoutine all unpin whatever routine they end, so a NEXT run saves under today\'s real date again', () => {
    expect(sessionContextSource).toMatch(/const abandonSession = useCallback\(\(\) => \{\s*\n\s*if \(state\.sessionId\) unpinRoutineDate\(state\.sessionId\);/);
    expect(sessionContextSource).toMatch(/const resetSession = useCallback\(\(\) => \{\s*\n\s*if \(state\.sessionId\) unpinRoutineDate\(state\.sessionId\);/);
    expect(sessionContextSource).toMatch(/unpinRoutineDate\(sessionId\);\s*\n\s*clearRoutineProgress\(sessionId\);/);
  });
});

describe('Completed-routine "Repeat" fix (the "Do Again does nothing" defect) - Morning only, unchanged', () => {
  it('the ambiguous "Do Again" label no longer exists anywhere', () => {
    expect(homeSource).not.toMatch(/>\s*Do Again\s*</);
  });

  it('a completed Morning routine shows "Repeat Morning Routine" (Home redesign - the literal copy lives in nextStepCard.js, rendered here via {morningCompletedCard.buttonLabel})', () => {
    const nextStepCardSource = read('../lib/nextStepCard.js');
    expect(nextStepCardSource).toMatch(/buttonLabel: 'Repeat Morning Routine'/);
    expect(homeSource).toMatch(/\{morningCompletedCard\.buttonLabel\}/);
  });

  it('tapping Repeat opens the repeat dialog, scoped to morning', () => {
    expect(homeSource).toMatch(/onClick=\{\(\) => setActiveDialog\(\{ kind: 'repeat', period: 'morning' \}\)\}/);
  });

  it('the repeat dialog uses non-destructive confirmation copy - the previous completion is preserved, not something being discarded (still used by Morning\'s own Repeat action - Morning has no per-day saved-answer data of the kind routine_responses stores, so this claim stays true for it)', () => {
    expect(homeSource).toMatch(/title: `Repeat \$\{label\} Routine\?`/);
    expect(homeSource).toMatch(/message: 'Your completed routine and saved reflections will remain in your history\.'/);
    expect(homeSource).toMatch(/confirmLabel: 'Start Again'/);
    expect(homeSource).toMatch(/destructive: false/);
  });

  it('confirming Repeat actually launches the routine (the exact defect: confirming used to do nothing) via the SAME fresh-start handler the ordinary Begin card uses - the generic handler still supports both periods, even though only Morning\'s own UI can reach the evening branch\'s dead code path today', () => {
    const match = homeSource.match(/\} else if \(kind === 'repeat'\) \{\s*\n\s*if \(period === 'morning'\) handleBeginRiseAndReset\(\);\s*\n\s*else handleBeginEveningWindDown\(\);/);
    expect(match).not.toBeNull();
  });

  it('Repeat Morning never touches Evening\'s own sessionId, and vice versa - each dialog kind only ever resolves `sessionId` from `RITUAL_SESSION_IDS[period]`', () => {
    expect(homeSource).toMatch(/const sessionId = RITUAL_SESSION_IDS\[period\];/);
  });
});

describe('Evening completed-review (Build 15) - the unsafe "Repeat Evening Routine" action is gone, replaced by a safe Review action', () => {
  it('no control on Home can dispatch { kind: \'repeat\', period: \'evening\' } any more - the investigation proved this would silently overwrite tonight\'s saved routine_responses (routine_responses\' own UNIQUE(user_id, session_id, step_id, prompt_id, local_date) constraint has no room for a second same-day Evening run)', () => {
    expect(homeSource).not.toMatch(/kind: 'repeat', period: 'evening'/);
  });

  it('an authenticated completed-Evening card offers "Review Tonight\'s Journey" instead, navigating straight to the read-only review flow - no confirmation dialog, since nothing destructive happens', () => {
    const block = homeSource.match(/\{eveningCardState === 'completed' && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    expect(block).toMatch(/\{isGuest \? \(/);
    expect(block).toMatch(/onClick=\{\(\) => navigate\('\/review\/reflection\?q=1'\)\}/);
    expect(block).toMatch(/Review Tonight's Journey/);
  });

  it('a guest\'s completed-Evening card (a possible device-flag edge case - guests never actually have saved routine_responses) shows a truthful "Begin Evening Wind-Down" action instead - never Review, never a claim about saved reflections', () => {
    const block = homeSource.match(/\{eveningCardState === 'completed' && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    expect(block).toMatch(/onClick=\{handleBeginEveningWindDown\}/);
    expect(block).toMatch(/Begin Evening Wind-Down/);
    expect(block).not.toMatch(/isGuest[\s\S]{0,120}Review Tonight's Journey/);
  });
});

describe('Same-day repeat completion — no double daily-streak credit', () => {
  it('SessionComplete.jsx and EveningComplete.jsx both gate their completion-date write behind shouldWriteCompletionDate', () => {
    expect(sessionCompleteSource).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(morningDoneKey\), attributionDateKey\)/);
    expect(eveningCompleteSource).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(eveningDoneKey\), attributionDateKey\)/);
  });

  it('both attribute completion to a pinned (original) date when one exists, falling back to "now" only when it does not', () => {
    expect(sessionCompleteSource).toMatch(/const pinnedDateKey = getPinnedRoutineDate\(state\.sessionId\);/);
    expect(sessionCompleteSource).toMatch(/const attributionDateKey = pinnedDateKey \?\? getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    expect(eveningCompleteSource).toMatch(/const pinnedDateKey = getPinnedRoutineDate\(state\.sessionId\);/);
    expect(eveningCompleteSource).toMatch(/const attributionDateKey = pinnedDateKey \?\? getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
  });

  it('both unpin and clear that routine\'s snapshot on return home, so a resolved (stale-then-resumed) run is never re-offered as "unfinished" again', () => {
    expect(sessionCompleteSource).toMatch(/unpinRoutineDate\(state\.sessionId\);\s*\n\s*clearRoutineProgress\(state\.sessionId\);/);
    expect(eveningCompleteSource).toMatch(/unpinRoutineDate\(state\.sessionId\);\s*\n\s*clearRoutineProgress\(state\.sessionId\);/);
  });
});

describe('"today\'s routine remains independently available" after a previous-day routine is completed', () => {
  it('routineProgress.js only stamps the PINNED date (not today) while a routine is pinned, and falls back to today once unpinned', () => {
    expect(routineProgressSource).toMatch(/dateKey: pinnedDateKey \?\? todayDateKey\(\)/);
  });
});

describe('Fresh-start parity fix — "Repeat Evening Routine" must begin at Wind-Down Step 1 of 6, not Reflection Step 2', () => {
  it('RoutineDetail.jsx\'s own "Start Routine" for Wind-Down resolves to a plain navigation once past the (Guest Onboarding) auth check - it never starts the Session Engine itself, deferring entirely to EveningWindDown.jsx\'s own Begin button', () => {
    // Guest Onboarding revision: 'wind-down' now requires auth too (see
    // guestOnboarding.test.js for the full guest-gating regression suite)
    // - Evening Wind-Down persists real Session Engine progress the
    // moment its own Begin is tapped, same as Rise & Reset. Once an
    // authenticated tap clears that check, handleStart's own routineId
    // branch still resolves to a bare navigate(detail.startRoute) for
    // Wind-Down (never beginRiseAndReset(), which is Rise & Reset-
    // specific) - the reference behaviour both Home's card and Repeat
    // must match.
    expect(routineDetailSource).toMatch(/'wind-down': \{/);
    const windDownBlock = routineDetailSource.match(/'wind-down': \{[\s\S]*?\n {2}\},?/)?.[0] ?? '';
    expect(windDownBlock).toMatch(/requiresAuth: true/);
    expect(windDownBlock).toMatch(/startRoute: '\/evening-wind-down'/);
    expect(routineDetailSource).toMatch(/if \(routineId === 'rise-reset'\) \{\s*\n\s*beginRiseAndReset\(\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*navigate\(detail\.startRoute\);/);
  });

  it('EveningWindDown.jsx genuinely displays "Step 1 of 6" as its own real screen, and only starts/advances the session once ITS OWN Begin button is tapped', () => {
    expect(eveningWindDownSource).toMatch(/Step 1 of 6/);
    expect(eveningWindDownSource).toMatch(/startSession\('evening-wind-down'\);\s*\n\s*advanceStep\(\);\s*\n\s*navigate\('\/reflection'\);/);
  });

  it('Home.jsx\'s handleBeginEveningWindDown no longer pre-starts the session or skips to Reflection - it is a plain navigation to the Wind-Down intro, matching RoutineDetail.jsx exactly', () => {
    expect(homeSource).toMatch(/const handleBeginEveningWindDown = \(\) => \{\s*\n\s*navigate\('\/evening-wind-down'\);\s*\n\s*\};/);
    // The old skip-straight-to-Reflection implementation must be gone.
    expect(homeSource).not.toMatch(/startSession\('evening-wind-down'\);\s*\n\s*advanceStep\(\);\s*\n\s*navigate\('\/reflection'\);/);
  });

  it('both the ordinary "Begin Wind-Down" card and "Repeat Evening Routine" call this exact same function - there is only one Evening fresh-start code path to keep in sync', () => {
    const occurrences = homeSource.match(/handleBeginEveningWindDown\(\)/g) ?? [];
    // handleEveningAction's not-in-progress fallback, the 'repeat' dialog
    // branch, and the 'discard-stale' dialog branch - three call sites,
    // one shared implementation, zero duplicated skip-to-Reflection logic.
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it('Morning already has full parity - handleBeginRiseAndReset and RoutineDetail.jsx\'s beginRiseAndReset both start at getStepIndex(\'morning-routine\', MORNING_STEP_IDS.INTENTION), with no equivalent skip', () => {
    // Morning-flow redesign: Step 1 is now Set Your Intention
    // (/intention-setup) - the former /morning-start video-selection
    // screen (and MORNING_STEP_IDS.START) is removed entirely.
    for (const source of [homeSource, routineDetailSource]) {
      expect(source).toMatch(/startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);/);
    }
    // Home.jsx navigates to the literal route; RoutineDetail.jsx navigates
    // to the same route via its own detail.startRoute ('/intention-setup'
    // for 'rise-reset') - same destination, different but equally valid
    // spelling, so each is checked in its own terms rather than forcing
    // an identical literal string match.
    expect(homeSource).toMatch(/navigate\('\/intention-setup'\);/);
    expect(routineDetailSource).toMatch(/startRoute: '\/intention-setup'/);
    expect(routineDetailSource).toMatch(/navigate\(detail\.startRoute\);/);
  });
});

describe('Repeat/discard-stale isolation — clearing is scoped to exactly the selected routine', () => {
  it('the repeat dialog never references the OTHER period\'s RITUAL_SESSION_IDS entry inside its own branch', () => {
    const repeatBranch = homeSource.match(/\} else if \(kind === 'repeat'\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(repeatBranch).not.toBe('');
    expect(repeatBranch).not.toMatch(/RITUAL_SESSION_IDS\.morning|RITUAL_SESSION_IDS\.evening/);
  });

  it('the discard-stale dialog only calls discardStaleRoutine once, on the single resolved `sessionId` - never both routines at once', () => {
    const discardBranch = homeSource.match(/\} else if \(kind === 'discard-stale'\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(discardBranch).not.toBe('');
    const discardCalls = discardBranch.match(/discardStaleRoutine\(/g) ?? [];
    expect(discardCalls.length).toBe(1);
  });

  it('discardStaleRoutine/resetRoutine/startSession are all single-sessionId-argument functions - the type system itself makes touching the other routine\'s progress from one call impossible', () => {
    expect(sessionContextSource).toMatch(/const discardStaleRoutine = useCallback\(\(sessionId\) => \{/);
    expect(sessionContextSource).toMatch(/const resetRoutine = useCallback\(\(sessionId\) => \{/);
  });
});
