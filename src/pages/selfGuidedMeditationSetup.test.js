// Source-level regression guard for SelfGuidedMeditation.jsx's own
// remaining JSX-bound structure (routing, context resolution, composition
// of the extracted shared pieces) - this repo's Vitest has no rendering
// engine (environment: 'node', see vite.config.js).
//
// Journey Embedding (Phase 2) — this page's timer/controller/audio glue
// moved to src/hooks/useMeditationSession.js (covered by
// useMeditationSession.test.js), and its setup/active JSX moved to
// MeditationSetupPanel.jsx/MeditationActiveSession.jsx (covered by their
// own test files) - this file now only checks what genuinely remains in
// SelfGuidedMeditation.jsx itself: context resolution, the hook wiring,
// and that standalone's own defaults/copy/navigation are unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./SelfGuidedMeditation.jsx');
const appSource = read('../App.jsx');

describe('App.jsx — routes are registered outside <Layout>, same placement as /meditate', () => {
  it('registers both self-guided-meditation and self-guided-meditation-complete', () => {
    expect(appSource).toMatch(/<Route path="self-guided-meditation" element=\{withFallback\(<SelfGuidedMeditation \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="self-guided-meditation-complete" element=\{withFallback\(<SelfGuidedMeditationComplete \/>\)\} \/>/);
  });
});

describe('SelfGuidedMeditation.jsx — reuses the shared modules, no duplicated timer/audio/controls logic', () => {
  it('imports useMeditationSession rather than owning the controller/interval itself', () => {
    expect(source).toMatch(/import \{ useMeditationSession \} from '\.\.\/hooks\/useMeditationSession';/);
    expect(source).not.toMatch(/createMeditationSessionController\(/);
    expect(source).not.toMatch(/setInterval\(/);
  });

  it('imports the shared setup/active presentation components rather than inlining their JSX again', () => {
    expect(source).toMatch(/import \{ MeditationSetupPanel \} from '\.\.\/components\/journey\/MeditationSetupPanel';/);
    expect(source).toMatch(/import \{ MeditationActiveSession \} from '\.\.\/components\/journey\/MeditationActiveSession';/);
  });

  it('never re-imports MEDITATION_STYLES/MEDITATION_DURATIONS/MEDITATION_SOUNDS directly - that data now lives only inside the shared setup/active components', () => {
    expect(source).not.toMatch(/MEDITATION_STYLES/);
    expect(source).not.toMatch(/MEDITATION_DURATIONS/);
    expect(source).not.toMatch(/MEDITATION_SOUNDS/);
  });
});

describe('SelfGuidedMeditation.jsx — allowlisted entry context, never a raw returnTo', () => {
  it('resolves `from` through the allowlisted resolver, captured once via a lazy initializer', () => {
    expect(source).toMatch(/const \[context\] = useState\(\(\) => resolveSelfGuidedMeditationContext\(searchParams\.get\('from'\)\)\);/);
  });
});

describe('SelfGuidedMeditation.jsx — standalone defaults are unchanged: no context-specific overrides passed to the hook', () => {
  it('seeds useMeditationSession only from the restored preset - never a Morning/Evening-style hardcoded style/duration/sound', () => {
    const body = source.match(/const session = useMeditationSession\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).toMatch(/initialStyleId: preset\?\.styleId/);
    expect(body).toMatch(/initialDurationId: preset\?\.durationId/);
    expect(body).toMatch(/initialSoundId: preset\?\.soundId/);
  });

  it('the setup panel renders in NON-compact mode - every option still shows immediately, no disclosure/Skip button', () => {
    expect(source).toMatch(/<MeditationSetupPanel\s*\n\s*compact=\{false\}/);
    expect(source).not.toMatch(/<MeditationSetupPanel[\s\S]*?onSkip=/);
  });

  it('still recommends 5 minutes (getRecommendedDurationId() called with no context argument)', () => {
    expect(source).toMatch(/recommendedDurationId=\{getRecommendedDurationId\(\)\}/);
  });

  it('still offers Explore Guided Meditations, navigating to the real Library Meditation category', () => {
    expect(source).toMatch(/onExploreGuided=\{handleExploreGuided\}/);
    expect(source).toMatch(/navigate\('\/library\?category=meditation&from=meditation-setup'\);/);
  });

  // Pre-Build-15 defect fix — standalone never supplied a beginLabel
  // override before this fix either, so it already received
  // MeditationSetupPanel.jsx's own default - but that default used to be
  // the static, duration-agnostic "Begin Meditation" (never naming a
  // duration at all, so technically never "stale", but also never
  // reflecting the real selection the way Morning/Evening's own hardcoded
  // strings were SUPPOSED to). It now gets the same live "Begin N-Minute
  // Meditation" every other context gets, computed from `session.duration`.
  it('never supplies a beginLabel override - gets the live "Begin N-Minute Meditation" computed from session.duration inside MeditationSetupPanel.jsx, same as Morning/Evening', () => {
    expect(source).not.toMatch(/beginLabel=/);
    expect(source).toMatch(/duration=\{session\.duration\}/);
  });
});

describe('SelfGuidedMeditation.jsx — completion reproduces the exact original navigate target', () => {
  it('onComplete navigates to /self-guided-meditation-complete with the finished session state, including `from` and (WakeWise DEV Anytime completion correction) the anytimeNeed/anytimeDuration this practice was itself entered with, if any', () => {
    const body = source.match(/const handleComplete = \(finished\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/navigate\('\/self-guided-meditation-complete', \{\s*\n\s*state: \{\s*\n\s*\.\.\.finished,\s*\n\s*from: searchParams\.get\('from'\) \|\| null,\s*\n\s*anytimeNeed: preset\?\.anytimeNeed \|\| null,\s*\n\s*anytimeDuration: preset\?\.anytimeDuration \|\| null\s*\n\s*\}\s*\n\s*\}\);/);
  });

  it('never opens any other route on completion', () => {
    const body = source.match(/const handleComplete = \(finished\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const navigateCalls = body.match(/navigate\(/g) ?? [];
    expect(navigateCalls.length).toBe(1);
  });
});

describe('SelfGuidedMeditation.jsx — Back/Close split fix: Back ends and returns to this screen\'s own setup, Close ends and leaves', () => {
  // Found live: Back and Close previously both resolved to the exact same
  // performLeave (end + navigate away) - Back never actually returned to
  // setup the way MorningMeditate.jsx/EveningMeditate.jsx's identical Back
  // already does. performLeave now only ends the session; phase falling
  // back to 'setup' is what makes this component's own render show the
  // pre-start screen again - no navigate needed. performClose is the new,
  // separate "leave" action, mirroring MorningMeditate.jsx's own
  // onRequestLeave/onRequestClose split exactly.
  it('performLeave (Back, via MeditationActiveSession\'s own local confirm dialog) only ends the session - it never navigates', () => {
    const body = source.match(/const performLeave = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/session\.endSession\(\);/);
    expect(body).not.toMatch(/navigate/);
  });

  it('performClose (the header Close/X, bypassing that local dialog) ends the session then exits to exitDestination via the centralized helper (clears the captured practice journey tone first) - the one real "leave" action. WakeWise DEV Anytime Back-navigation correction: exitDestination is context.fallback unless anytimeOrigin, in which case it is the preserved Anytime Reset recommendation - see the dedicated describe block below for what anytimeOrigin/exitDestination resolve to.', () => {
    const body = source.match(/const performClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/session\.endSession\(\);/);
    expect(body).toMatch(/exitPracticeToHome\(navigate, exitDestination\);/);
  });

  // Standalone Home quick-action correction — Close/X previously called
  // performClose directly with NO confirmation at all (reproduced live: a
  // single tap ended the session and navigated Home immediately). Close
  // now opens its own local exitConfirmOpen dialog first (mirroring
  // MorningMeditate.jsx's handleRequestExitRoutine); only confirming it
  // calls performClose. Back is unaffected - MeditationActiveSession still
  // owns that confirmation via endCopy (now overridden, see below).
  it('the active screen wires performLeave as onRequestLeave (MeditationActiveSession owns that confirmation) and handleRequestClose as onRequestClose (opens this page\'s own ConfirmDialog, only calling performClose once confirmed)', () => {
    expect(source).toMatch(/onRequestLeave=\{performLeave\}/);
    expect(source).toMatch(/onRequestClose=\{handleRequestClose\}/);
    expect(source).toMatch(/<ConfirmDialog/);
    const performCloseBody = source.match(/const performClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(performCloseBody).toMatch(/setExitConfirmOpen\(false\);/);
  });

  // F4 (pre-Build-15 usability pass) — found live: Back's dialog and End
  // Session's own dialog still shared identical "End this meditation?"
  // wording even after being independently wired, with no signal that
  // Back quietly returns to setup while End Session shows a distinct
  // "ended early" result. Back's own wording (endCopy) now explicitly
  // names returning to choose another style/duration/sound; End
  // Session's own wording (endSessionCopy) stays completion-oriented.
  it('the active screen\'s Back dialog (endCopy) uses "Return to meditation choices?" wording, not the stale "Leave meditation?"/"End and Leave" wording written for actually leaving, and not End Session\'s own wording', () => {
    const activeReturnBlock = source.slice(source.indexOf("session.phase === 'active'"), source.indexOf('return (\n    // Mobile scroll repair'));
    expect(activeReturnBlock).toMatch(/dialogTitle: 'Return to meditation choices\?'/);
    expect(activeReturnBlock).toMatch(/dialogMessage: 'Your current meditation will end, and you can choose another style, duration or sound\.'/);
    expect(activeReturnBlock).toMatch(/confirmLabel: 'Return to Choices'/);
    expect(activeReturnBlock).toMatch(/cancelLabel: 'Keep Meditating'/);
  });

  it('End Session has its own distinct, completion-oriented wording (endSessionCopy), separate from Back\'s', () => {
    const activeReturnBlock = source.slice(source.indexOf("session.phase === 'active'"), source.indexOf('return (\n    // Mobile scroll repair'));
    expect(activeReturnBlock).toMatch(/endSessionCopy=\{\{/);
    expect(activeReturnBlock).toMatch(/dialogTitle: 'End this meditation\?'/);
    expect(activeReturnBlock).toMatch(/dialogMessage: 'Your current meditation will end before the timer finishes\.'/);
    expect(activeReturnBlock).toMatch(/confirmLabel: 'End Meditation'/);
  });

  it('the Close/X ConfirmDialog reuses the original "Leave meditation?"/"End and Leave"/"Continue Meditation" wording - correct framing for a genuine whole-feature exit, only ever misapplied to Back before this fix', () => {
    const activeReturnBlock = source.slice(source.indexOf("session.phase === 'active'"), source.indexOf('return (\n    // Mobile scroll repair'));
    expect(activeReturnBlock).toMatch(/title="Leave meditation\?"/);
    expect(activeReturnBlock).toMatch(/confirmLabel="End and Leave"/);
    expect(activeReturnBlock).toMatch(/cancelLabel="Continue Meditation"/);
    expect(activeReturnBlock).toMatch(/onConfirm=\{performClose\}/);
  });
});

describe('SelfGuidedMeditation.jsx — Back/Close on the setup screen (pre-Begin), unchanged', () => {
  it('setup renders JourneyHeader with a real Back button (step 1 shape) falling back to exitDestination, clearing the captured practice journey tone on either Back or Close (both are real exits from this screen)', () => {
    const headerBlock = source.slice(source.indexOf('<JourneyHeader\n'), source.indexOf('<MeditationSetupPanel'));
    expect(headerBlock).toMatch(/showBackButton\s*\n\s*backFallback=\{exitDestination\}/);
    expect(headerBlock).toMatch(/onBackBeforeLeave=\{\(\) => \{\s*\n\s*clearPracticeJourneyTone\(\);\s*\n\s*\}\}/);
    expect(headerBlock).toMatch(/onClose=\{\(\) => exitPracticeToHome\(navigate, exitDestination\)\}/);
  });

  it('this JourneyHeader is forced straight to exitDestination via alwaysFallback={anytimeOrigin} - without it, goBack() would silently prefer a real navigate(-1) over exitDestination whenever this app instance\'s in-app history has more than one entry, discarding the preserved Anytime Reset recommendation', () => {
    const headerBlock = source.slice(source.indexOf('<JourneyHeader\n'), source.indexOf('<MeditationSetupPanel'));
    expect(headerBlock).toMatch(/alwaysFallback=\{anytimeOrigin\}/);
  });
});

// WakeWise DEV — Anytime Back-navigation correction: found live - Welcome
// -> Take a calming pause -> Anytime Step 1 -> Calm -> Meditate -> Back
// from setup (and Close, and the early-ended Done button) all fell
// straight through to context.fallback ('/' - no `?from=` param survives
// AnytimeReset.jsx's own navigate() call), silently ejecting the user
// past Anytime Reset to Home, with no memory of the need/duration they'd
// already chosen. `anytimeOrigin` is the one EXPLICIT marker (never
// journeyTone, which also defaults to 'anytime' for an unrelated reason,
// and never navigate(-1)/browser history) this whole lifecycle uses to
// know it was genuinely launched from Anytime Reset's "Meditate"
// alternative; `exitDestination` replaces every real "leave this
// practice" destination with the preserved Anytime Reset recommendation
// when it's true - reached any other way (Home's Meditate tile, Library),
// anytimeOrigin is false and every one of those destinations is exactly
// context.fallback, completely unchanged.
describe('SelfGuidedMeditation.jsx — Anytime Back-navigation correction: explicit origin, not journeyTone or browser history', () => {
  it('anytimeOrigin/anytimeResetDestination/exitDestination are computed from router state, not journeyTone', () => {
    expect(source).toMatch(/const anytimeOrigin = Boolean\(preset\?\.anytimeNeed && preset\?\.anytimeDuration\);/);
    expect(source).toMatch(
      /const anytimeResetDestination = anytimeOrigin\s*\n\s*\? `\/anytime-reset\?need=\$\{encodeURIComponent\(preset\.anytimeNeed\)\}&duration=\$\{encodeURIComponent\(preset\.anytimeDuration\)\}`\s*\n\s*: null;/
    );
    expect(source).toMatch(/const exitDestination = anytimeOrigin \? anytimeResetDestination : context\.fallback;/);
  });

  it('the countdown screen\'s own Back also falls back to exitDestination, not context.fallback', () => {
    const countdownBlock = source.slice(source.indexOf('if (countdown.isActive)'), source.indexOf("if (session.phase === 'active'"));
    expect(countdownBlock).toMatch(/fallback=\{exitDestination\}/);
    expect(countdownBlock).not.toMatch(/fallback=\{context\.fallback\}/);
  });

  it('the earlyEnded panel shows "Choose another quick reset"/"Return to Home" (restoring the preserved need/duration) only when anytimeOrigin, the original Done/Meditate Again pair only otherwise - exactly the same two-branch shape QuietBreathing.jsx\'s own early-ended panel already uses', () => {
    const panelBlock = source.match(/if \(earlyEnded\) \{[\s\S]*?\n {2}\}\n\n {2}return \(\n {4}\/\/ Mobile scroll repair/)?.[0] ?? '';
    expect(panelBlock).toMatch(/\{anytimeOrigin \? \(/);
    expect(panelBlock).toMatch(/<span>Choose another quick reset<\/span>/);
    expect(panelBlock).toMatch(/onClick=\{\(\) => exitPracticeToHome\(navigate, '\/'\)\}[\s\S]*?Return to Home/);
    const ifIndex = panelBlock.indexOf('anytimeOrigin ? (');
    const elseIndex = panelBlock.indexOf(') : (');
    const doneIndex = panelBlock.indexOf('<span>Done</span>');
    expect(elseIndex).toBeGreaterThan(ifIndex);
    expect(doneIndex).toBeGreaterThan(elseIndex);
    expect(panelBlock).toMatch(/onClick=\{\(\) => exitPracticeToHome\(navigate, exitDestination\)\}/);
    expect(panelBlock).toMatch(/onClick=\{handleMeditateAgainFromEarlyEnd\}/);
  });
});

describe('SelfGuidedMeditation.jsx — reduced motion, unchanged', () => {
  it('reads both the manual override and the OS-level media query, matching this app\'s one established pattern', () => {
    expect(source).toMatch(/getReducedMotionPreference\(\)/);
    expect(source).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('passes reducedMotion through to MeditationActiveSession rather than animating unconditionally', () => {
    expect(source).toMatch(/reducedMotion=\{reducedMotion\}/);
  });
});

describe('SelfGuidedMeditation.jsx — this feature never touches Morning/Evening/Meditate completion state', () => {
  it('never imports dailyCompletion.js or the Session Engine', () => {
    expect(source).not.toMatch(/from '\.\.\/lib\/dailyCompletion'/);
    expect(source).not.toMatch(/from '\.\.\/context\/SessionContext'/);
    expect(source).not.toMatch(/useSession/);
  });
});

describe('SelfGuidedMeditation.jsx — retains its existing Close/End behaviour, unaffected by the Evening-only duplicate-Close fix', () => {
  it('does not pass showHeaderClose - MeditationActiveSession keeps its own default (true), so standalone\'s active screen still renders both Back and Close exactly as before', () => {
    expect(source).not.toMatch(/showHeaderClose/);
  });

  it('End Session button/aria-label copy is still the component\'s own established wording ("End Session"), even though dialogTitle/confirmLabel/cancelLabel are now overridden for the Back dialog\'s correctness', () => {
    const activeReturnBlock = source.slice(source.indexOf("session.phase === 'active'"), source.indexOf('return (\n    // Mobile scroll repair'));
    expect(activeReturnBlock).toMatch(/buttonLabel: 'End Session'/);
    expect(activeReturnBlock).toMatch(/buttonAriaLabel: 'End meditation'/);
  });
});

// ---------------------------------------------------------------------
// Early-end result correction — found live: the bottom "End Session"
// button and Back were wired to MeditationActiveSession's own single
// leaveConfirmOpen/onRequestLeave pair, so End Session could never be
// verified "independently from Back" - both silently returned to setup
// with no distinct outcome. onEndSession (MeditationActiveSession.jsx)
// gives End Session its own confirm dialog/handler; this page uses it to
// surface a new, truthful "Session ended early" panel instead, while
// Back (performLeave) is completely unchanged.
// ---------------------------------------------------------------------
describe('SelfGuidedMeditation.jsx — Early-end result correction: End Session is independent of Back', () => {
  it('performEndSession ends the session and sets earlyEnded - distinct from performLeave, which never touches earlyEnded', () => {
    const body = source.match(/const performEndSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/session\.endSession\(\);/);
    expect(body).toMatch(/setEarlyEnded\(true\);/);
    const leaveBody = source.match(/const performLeave = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(leaveBody).not.toMatch(/earlyEnded/);
  });

  it('the active screen wires performEndSession as onEndSession, alongside the unchanged onRequestLeave/onRequestClose', () => {
    expect(source).toMatch(/onRequestLeave=\{performLeave\}/);
    expect(source).toMatch(/onRequestClose=\{handleRequestClose\}/);
    expect(source).toMatch(/onEndSession=\{performEndSession\}/);
  });

  it('the earlyEnded panel renders truthful wording - never claims the full selected duration completed (Done -> exitDestination and Meditate Again -> clears earlyEnded, revealing setup with the same style/duration/sound still selected, are covered by the dedicated Anytime Back-navigation describe block below)', () => {
    const panelBlock = source.match(/if \(earlyEnded\) \{[\s\S]*?\n {2}\}\n\n {2}return \(\n {4}\/\/ Mobile scroll repair/)?.[0] ?? '';
    expect(panelBlock.length).toBeGreaterThan(0);
    expect(panelBlock).toMatch(/Session ended early/);
    expect(panelBlock).toMatch(/session ended before the timer finished/);
    expect(panelBlock).not.toMatch(/complete/i);
  });

  it('handleMeditateAgainFromEarlyEnd only clears earlyEnded - no navigation, no session reset (style/duration/sound and the setup screen underneath are untouched, since endSession() never resets them)', () => {
    const body = source.match(/const handleMeditateAgainFromEarlyEnd = \(\) => setEarlyEnded\(false\);/);
    expect(body).not.toBeNull();
  });
});
