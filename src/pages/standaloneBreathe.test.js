// Build 15 — Standalone Breathe (QuietBreathing.jsx's additive
// `standalone` prop) and Support's own unchanged embedded usage. No DOM
// rendering available in this repo's Vitest - source-level checks,
// matching this codebase's own established precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./QuietBreathing.jsx');
const appSource = read('../App.jsx');

// ---------------------------------------------------------------------
// Route registration - a controlled, explicit prop, never an inferred
// URL parameter.
// ---------------------------------------------------------------------
describe('Route registration - two explicit routes, never inferred from a URL parameter', () => {
  it('Support keeps its exact original route, standalone gets a NEW, separate route', () => {
    expect(appSource).toMatch(/<Route path="quiet-breathing" element=\{withFallback\(<QuietBreathing \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="breathe-standalone" element=\{withFallback\(<QuietBreathing standalone \/>\)\} \/>/);
  });

  it('the standalone prop is a literal JSX boolean attribute, never read from useSearchParams/location', () => {
    expect(source).not.toMatch(/useSearchParams/);
    expect(source).toMatch(/export const QuietBreathing = \(\{ standalone = false \}\) => \{/);
  });
});

// ---------------------------------------------------------------------
// 23, 24. No Session Engine coupling, either mode; preserves an active
// journey.
// ---------------------------------------------------------------------
describe('Items 23/24 - no Session Engine coupling in either mode', () => {
  it('never imports useSession, advanceStep, setJourneyStep, or any Session Engine action - true for Support\'s own usage AND standalone (checking actual imports/calls, not this file\'s own doc comments explaining the absence)', () => {
    expect(source).not.toMatch(/from '\.\.\/context\/SessionContext'/);
    expect(source).not.toMatch(/\buseSession\(\)/);
    expect(source).not.toMatch(/\b(advanceStep|setJourneyStep|abandonSession|resetSession|resetRoutine|startSession)\(/);
  });

  it('never imports or touches routineProgress.js/dailyCompletion.js - no Morning/Evening progress or completion flag can be read or written from this file', () => {
    expect(source).not.toMatch(/routineProgress|dailyCompletion|getMorningCompletionKey|getEveningCompletionKey/);
  });
});

// ---------------------------------------------------------------------
// Support's own embedded (non-standalone) usage - byte-for-byte
// preserved behaviour.
// ---------------------------------------------------------------------
describe('Support\'s own embedded (non-standalone) usage is preserved exactly', () => {
  it('backFallback/completionRoute default to the original /support and /support-complete when standalone is omitted', () => {
    expect(source).toMatch(/const backFallback = standalone \? '\/' : '\/support';/);
    expect(source).toMatch(/const completionRoute = standalone \? '\/' : '\/support-complete';/);
  });

  it('non-standalone never renders BreathingPatternRow/MusicPreferenceToggle/a "Begin Breathing" gesture - the picker and preference toggle are standalone-only', () => {
    const nonStandaloneReturn = source.slice(source.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).not.toMatch(/BreathingPatternRow|MusicPreferenceToggle|Begin Breathing/);
  });

  it('non-standalone still renders MusicEntryChoice gated on awaitingMusicChoice alone - the exact original gate, never combined with hasBegun', () => {
    const nonStandaloneReturn = source.slice(source.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/\{awaitingMusicChoice && \(\s*\n\s*<MusicEntryChoice/);
  });

  it('non-standalone\'s selectedPatternId can never change - there is no picker UI to change it, so activePattern always resolves to the original fixed 4-4-8 ("quiet") pattern', () => {
    expect(source).toMatch(/const \[selectedPatternId, setSelectedPatternId\] = useState\(DEFAULT_STANDALONE_PATTERN_ID\);/);
    expect(source).toMatch(/const DEFAULT_STANDALONE_PATTERN_ID = 'quiet';/);
  });

  it('hasBegun starts (and, for non-standalone, stays) true - Support\'s own screen never gates on it; its own effect gate is !awaitingMusicChoice alone via the shared canRun', () => {
    expect(source).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => !standalone\);/);
    expect(source).toMatch(/const canRun = standalone \? \(hasBegun && !earlyEnded\) : !awaitingMusicChoice;/);
  });

  it('"Just breathe. There is nowhere else to be." remains the exact copy for Support\'s own usage', () => {
    const nonStandaloneReturn = source.slice(source.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/Just breathe\. There is nowhere else to be\./);
  });

  // Build 15 Box/Coherent addition — Support's flow is confirmed
  // completely unreachable-from for either new pattern: it never renders
  // a picker at all (see the test above), and its own fixed default is
  // unconditionally 'quiet' - Box/Coherent's own ids never appear
  // anywhere in the non-standalone return branch.
  it('Box/Coherent are structurally unreachable from Support\'s own flow - their ids never appear in the non-standalone return branch', () => {
    const nonStandaloneReturn = source.slice(source.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).not.toMatch(/'box'|'coherent'/);
  });
});

// ---------------------------------------------------------------------
// Standalone mode - real pattern selection, Begin gesture, correct
// return targets, no completion event.
// ---------------------------------------------------------------------
describe('Standalone mode - real pattern selection, genuine Begin gesture, correct navigation', () => {
  it('imports the shared BREATHING_PATTERNS/BreathingPatternRow - never a fabricated local pattern list', () => {
    expect(source).toMatch(/import \{ BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase \} from '\.\.\/lib\/breathingPatterns';/);
  });

  it('the standalone branch is a genuinely separate early return, entered only when standalone is true', () => {
    expect(source).toMatch(/if \(standalone\) \{\s*\n\s*return \(/);
  });

  it('defaults to the quiet 4-4-8 pattern (the approved "sensible documented default") - unaffected by the Build 15 Box/Coherent addition', () => {
    expect(source).toMatch(/const DEFAULT_STANDALONE_PATTERN_ID = 'quiet';/);
  });

  // Build 15 Box/Coherent addition — the standalone picker iterates the
  // shared array generically (no per-id filtering), so both new patterns
  // automatically appear here with zero code change to this file - this
  // is exactly what's checked below: the map call has no filter/slice
  // applied to BREATHING_PATTERNS before it.
  it('the standalone picker maps the FULL shared BREATHING_PATTERNS array with no filtering - both Box and Coherent automatically appear here', () => {
    const standaloneReturn = source.slice(source.indexOf('if (standalone) {'), source.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(standaloneReturn).toMatch(/\{BREATHING_PATTERNS\.map\(\(pattern\) => \(/);
    expect(standaloneReturn).not.toMatch(/BREATHING_PATTERNS\.filter\(/);
    expect(standaloneReturn).not.toMatch(/BREATHING_PATTERNS\.slice\(/);
  });

  it('nothing starts on mount - hasBegun defaults to false in standalone mode, gating the countdown entirely via canRun', () => {
    // useState(() => !standalone) evaluates to false when standalone is true.
    expect(source).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => !standalone\);/);
  });

  it('Begin Breathing resets the countdown, sets hasBegun, guards against double taps, and starts music only if eligible+preferred (Build 18: guest no longer excluded - IB01 is server-allowlisted)', () => {
    const body = source.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasBegunOnceRef\.current\) return;/);
    expect(body).toMatch(/hasBegunOnceRef\.current = true;/);
    expect(body).toMatch(/setSecondsLeft\(activePattern\.totalSeconds\);/);
    expect(body).toMatch(/setHasBegun\(true\);/);
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn\) \{/);
    expect(body).not.toMatch(/!isGuest/);
  });

  it('InteractiveAmbientMusic is ONE stable instance in the standalone branch, hidden pre-start (or once complete) via hideToggle, never suspended (no guided-video concept on this screen)', () => {
    const standaloneReturn = source.slice(source.indexOf('if (standalone) {'), source.lastIndexOf('return (\n    <EveningSceneShell'));
    const mountCount = (standaloneReturn.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
    expect(standaloneReturn).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}\s*\n\s*suspended=\{false\}\s*\n\s*hideToggle=\{!hasBegun \|\| isComplete\}\s*\n\s*\/>/);
  });

  // Standalone completion redesign — found live: Continue/Skip were both
  // tappable at any time and converged on the exact same immediate,
  // silent navigate('/') with no distinct completion state at all
  // (handleAdvance, still used unchanged by non-standalone below). See
  // standaloneBreatheCompletion.test.js for the full completion-screen
  // regression coverage.
  it('standalone no longer uses handleAdvance at all - it has its own End early/Done/Breathe again handlers instead', () => {
    const standaloneReturn = source.slice(source.indexOf('if (standalone) {'), source.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(standaloneReturn).not.toMatch(/handleAdvance/);
  });

  it('Back from setup/complete (not active) still resolves to Home ("/") via the shared backFallback, never an arbitrary return URL', () => {
    expect(source).toMatch(/showBack backFallback=\{backFallback\}/);
  });

  it('creates no completion/progress event of any kind - navigating to "/" is a plain route change, no flag/state write accompanies it (see the no-Session-Engine-coupling assertions above)', () => {
    const bodyBetweenBeginAndReturn = source.slice(source.indexOf('const handleBeginBreathing'), source.indexOf('if (standalone) {'));
    expect(bodyBetweenBeginAndReturn).not.toMatch(/localStorage\.setItem/);
  });
});

// ---------------------------------------------------------------------
// Standalone Home quick-action correction — Back while active, found live:
// EveningSceneShell's shared BackButton always resolved straight to Home
// regardless of hasBegun, so a single Back tap during active breathing
// silently ejected the user mid-session with no way back to setup, no
// pattern/music reselection, and no timer/audio cleanup confirmation.
// ---------------------------------------------------------------------
describe('Standalone Home quick-action correction — Back while active is a local session action, not a feature exit', () => {
  it('onBeforeLeave is wired on the standalone EveningSceneShell, alongside the unchanged backFallback', () => {
    expect(source).toMatch(/showBack backFallback=\{backFallback\} onBeforeLeave=\{handleBackFromActive\}/);
  });

  it('handleBackFromActive only intercepts while genuinely active (hasBegun, not yet complete, not already earlyEnded) - setup and either result screen let Back proceed to Home normally', () => {
    const body = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!hasBegun \|\| isComplete \|\| earlyEnded\) return;/);
    expect(body).toMatch(/setEndConfirmSource\('back'\);/);
    expect(body).toMatch(/setEndConfirmOpen\(true\);/);
    expect(body).toMatch(/return false;/);
  });

  it('confirming resolves differently depending on which control opened the dialog (endConfirmSource): Back still resets straight to setup exactly as before (hasBegunOnceRef, setHasBegun(false), no navigation); the bottom End early button instead sets earlyEnded, surfacing the new result panel', () => {
    const body = source.match(/const handleConfirmEndSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(body).toMatch(/if \(endConfirmSource === 'button'\) \{\s*\n\s*setEarlyEnded\(true\);\s*\n\s*\} else \{\s*\n\s*hasBegunOnceRef\.current = false;\s*\n\s*setHasBegun\(false\);\s*\n\s*\}/);
    expect(body).not.toMatch(/navigate/);
  });

  it('the confirmation dialog describes ending THIS session, never leaving the whole Breathe feature - matches the approved wording exactly, shared by both Back and the bottom End early button', () => {
    expect(source).toMatch(/title="End this breathing session\?"/);
    expect(source).toMatch(/message="Your current breathing session will end\."/);
    expect(source).toMatch(/confirmLabel="End Session"/);
    expect(source).toMatch(/cancelLabel="Keep Breathing"/);
  });
});

// ---------------------------------------------------------------------
// Early-end result correction — found live: the bottom "End early" button
// had no confirmation at all and navigated straight Home, unlike natural
// completion's own distinct "Breathing complete" screen. It must not
// merely duplicate Back (which still resolves silently to setup) or
// natural completion (which never went through a confirmation at all).
// ---------------------------------------------------------------------
describe('Early-end result correction — "End early" no longer silently duplicates Back or natural completion', () => {
  it('the bottom "End early" button now opens the shared confirm dialog (endConfirmSource "button") instead of navigating directly', () => {
    const body = source.match(/const handleEndEarly = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setEndConfirmSource\('button'\);/);
    expect(body).toMatch(/setEndConfirmOpen\(true\);/);
    expect(body).not.toMatch(/navigate/);
    expect(source).toMatch(/onClick=\{handleEndEarly\}/);
  });

  it('the result panel renders truthfully distinct copy for earlyEnded vs. genuine natural completion - never claims "Breathing complete" for an early end', () => {
    expect(source).toMatch(/\{isComplete \|\| earlyEnded \? \(/);
    expect(source).toMatch(/\{earlyEnded \? 'Session ended early' : 'Breathing complete'\}/);
    expect(source).toMatch(/earlyEnded \? `Your \$\{activePattern\.label\} session ended before the timer finished\.` : 'Take a moment to notice how you feel\.'/);
  });

  it('Done and "Breathe again" are shared by both result states - Breathe again also clears earlyEnded so it works identically from either', () => {
    const body = source.match(/const handleBreatheAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
    expect(body).toMatch(/setHasBegun\(false\);/);
    expect(body).toMatch(/setEarlyEnded\(false\);/);
  });

  it('confirming an early end stops the countdown immediately (canRun folds in !earlyEnded) so it can never keep ticking behind the result panel', () => {
    expect(source).toMatch(/const canRun = standalone \? \(hasBegun && !earlyEnded\) : !awaitingMusicChoice;/);
  });
});

// ---------------------------------------------------------------------
// Repeated use / preserving another active routine - by construction,
// since this page never reads or writes any Session Engine or
// routineProgress state at all (already asserted above), it can never
// leak into, block, or be blocked by an active Morning/Evening routine,
// and can be visited repeatedly with no state to exhaust.
// ---------------------------------------------------------------------
describe('Repeatable use, no interference with another active routine', () => {
  it('the pattern/preference/hasBegun state is all plain local component state - nothing persisted, so a fresh visit always starts clean and a concurrently active Morning/Evening routine (tracked entirely elsewhere, in SessionContext) is structurally unreachable from this file', () => {
    expect(source).not.toMatch(/localStorage\.getItem\(['"]moonlight_session/);
  });
});
