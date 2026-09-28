// "Your Momentum" foundation, Phase 2 — wiring guard for the three
// completion paths that call recordPracticeCompletion
// (src/lib/practiceCompletions.js). This repo's Vitest runs in a plain
// Node environment (see vite.config.js's own `test.environment: 'node'`),
// with no jsdom/@testing-library/react available, so a real mounted-
// component behavioural test is not possible here - source-level checks
// are the established convention for this kind of React completion-timing
// wiring (see dailyCompletionWiring.test.js's own note, and
// meditationEndedEarlyFix.test.js for the same standard already applied to
// Meditate.jsx). The pure, fully behavioural coverage for
// recordPracticeCompletion itself lives in
// src/lib/practiceCompletions.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const sessionCompleteSource = read('./SessionComplete.jsx');
const eveningCompleteSource = read('./EveningComplete.jsx');
const meditateSource = read('./Meditate.jsx');
const meditationCompleteSource = read('./MeditationComplete.jsx');

describe('SessionComplete.jsx (Morning) — completion event and daily flag both fire at mount-time completion, not the CTA tap', () => {
  it('imports recordPracticeCompletion', () => {
    expect(sessionCompleteSource).toMatch(/import \{ recordPracticeCompletion \} from '\.\.\/lib\/practiceCompletions';/);
  });

  it('the daily completion-date flag (morningDoneKey) is now written inside the SAME mount effect that calls completeSession() - not gated behind the CTA - mirroring EveningComplete.jsx\'s own proven pattern exactly', () => {
    const mountEffectBody = sessionCompleteSource.match(/useEffect\(\(\) => \{\s*if \(state\.status === 'playing' && currentStep\?\.id === 'complete'\) \{[\s\S]*?\n {2}\}, \[state\.status, currentStep, completeSession\]\);/)?.[0];
    expect(mountEffectBody).toBeTruthy();
    expect(mountEffectBody).toMatch(/completeSession\(\);/);
    expect(mountEffectBody).toMatch(/const morningDoneKey = getMorningCompletionKey\(userId\);/);
    expect(mountEffectBody).toMatch(/if \(shouldWriteCompletionDate\(localStorage\.getItem\(morningDoneKey\), attributionDateKey\)\) \{/);
    expect(mountEffectBody).toMatch(/localStorage\.setItem\(morningDoneKey, attributionDateKey\);/);
  });

  it('the completion-event effect is gated on state.status === \'completed\' && state.completionEventId - never on the CTA (handleReturnHome) alone', () => {
    const effectBody = sessionCompleteSource.match(/useEffect\(\(\) => \{\s*if \(state\.status !== 'completed' \|\| !state\.completionEventId\) return;[\s\S]*?\n {2}\}, \[state\.status, state\.completionEventId, userId, effectiveTimezone\]\);/)?.[0];
    expect(effectBody).toBeTruthy();
    expect(effectBody).toMatch(/journey: 'morning'/);
    expect(effectBody).toMatch(/practiceType: 'full_routine'/);
    expect(effectBody).toMatch(/sessionId: state\.completionEventId/);
    expect(effectBody).toMatch(/timezone: effectiveTimezone/);
  });

  it('handleReturnHome (the CTA) no longer writes the flag or the completion event at all - navigation/cleanup only', () => {
    const handleReturnHomeBody = sessionCompleteSource.match(/const handleReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0];
    expect(handleReturnHomeBody).toBeTruthy();
    expect(handleReturnHomeBody).not.toMatch(/recordPracticeCompletion/);
    expect(handleReturnHomeBody).not.toMatch(/localStorage\.setItem\(morningDoneKey/);
    expect(handleReturnHomeBody).not.toMatch(/getMorningCompletionKey/);
    expect(handleReturnHomeBody).toMatch(/navigate\('\/'\);/);
  });

  it('duration policy correction: always null for a full routine, never computed from updatedAt - startedAt (that span includes interruption/backgrounding time, not genuine active/mindful duration)', () => {
    expect(sessionCompleteSource).toMatch(/durationSeconds: null,/);
    expect(sessionCompleteSource).not.toMatch(/new Date\(state\.updatedAt\)\.getTime\(\) - new Date\(state\.startedAt\)\.getTime\(\)/);
  });
});

describe('EveningComplete.jsx — completion event mirrors the same mount-time pattern, additive to the already-correct flag write', () => {
  it('imports recordPracticeCompletion', () => {
    expect(eveningCompleteSource).toMatch(/import \{ recordPracticeCompletion \} from '\.\.\/lib\/practiceCompletions';/);
  });

  it('the new effect is gated on state.status === \'completed\' && state.completionEventId, in a SEPARATE effect from the existing flag-writing mount effect', () => {
    const effectBody = eveningCompleteSource.match(/useEffect\(\(\) => \{\s*if \(state\.status !== 'completed' \|\| !state\.completionEventId\) return;[\s\S]*?\n {2}\}, \[state\.status, state\.completionEventId, userId, effectiveTimezone\]\);/)?.[0];
    expect(effectBody).toBeTruthy();
    expect(effectBody).toMatch(/journey: 'evening'/);
    expect(effectBody).toMatch(/practiceType: 'full_routine'/);
    expect(effectBody).toMatch(/sessionId: state\.completionEventId/);
  });

  it('the existing mount effect (completeSession + eveningDoneKey flag write) is completely unchanged', () => {
    expect(eveningCompleteSource).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'completion'\) \{/);
    expect(eveningCompleteSource).toMatch(/const eveningDoneKey = getEveningCompletionKey\(userId\);/);
    expect(eveningCompleteSource).toMatch(/if \(shouldWriteCompletionDate\(localStorage\.getItem\(eveningDoneKey\), attributionDateKey\)\) \{/);
  });

  it('duration policy correction: always null for a full routine, never computed from updatedAt - startedAt (that span includes interruption/backgrounding time, not genuine active/mindful duration)', () => {
    expect(eveningCompleteSource).toMatch(/durationSeconds: null,/);
    expect(eveningCompleteSource).not.toMatch(/new Date\(state\.updatedAt\)\.getTime\(\) - new Date\(state\.startedAt\)\.getTime\(\)/);
  });
});

describe('Meditate.jsx — guided-video meditation completion event, natural `ended` only', () => {
  it('imports recordPracticeCompletion', () => {
    expect(meditateSource).toMatch(/import \{ recordPracticeCompletion \} from '\.\.\/lib\/practiceCompletions';/);
  });

  it('mints a fresh session id before every genuine open (verifyAndOpenVideo success path, and the post-auth restore mount effect) - never a fixed/reused literal', () => {
    expect(meditateSource).toMatch(/mediaSessionIdRef\.current = mintMediaSessionId\(\);\s*\n\s*setOpenVideoId\(id\);/);
    expect(meditateSource).toMatch(/if \(openVideoId\) mediaSessionIdRef\.current = mintMediaSessionId\(\);/);
  });

  it('onEnded (genuine natural completion only) still writes the exact same "meditated today" flag, and additionally records the completion event using the captured session id, then rotates it for any subsequent genuine replay', () => {
    const onEndedBody = meditateSource.match(/onEnded=\{\(\) => \{[\s\S]*?\n\s*\}\}/)?.[0] ?? '';
    expect(onEndedBody).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    expect(onEndedBody).toMatch(/localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/);
    expect(onEndedBody).toMatch(/const sessionId = mediaSessionIdRef\.current;/);
    expect(onEndedBody).toMatch(/mediaSessionIdRef\.current = mintMediaSessionId\(\);/);
    expect(onEndedBody).toMatch(/journey: 'direct'/);
    expect(onEndedBody).toMatch(/practiceType: 'meditation'/);
  });

  it('handleVideoClose (early close/Escape/backdrop/manual close) never records a completion - it only clears openVideoId', () => {
    const closeBody = meditateSource.match(/const handleVideoClose = \(\) => [^\n]*;/)?.[0] ?? '';
    expect(closeBody).not.toMatch(/recordPracticeCompletion/);
    expect(closeBody).toMatch(/setOpenVideoId\(null\)/);
  });

  it('duration comes from the real media element (onDurationKnown, fired from BetaVideoModal\'s own onLoadedMetadata) - never a selected/catalogue-estimated value', () => {
    expect(meditateSource).toMatch(/onDurationKnown=\{\(seconds\) => \{\s*mediaDurationRef\.current = Number\.isFinite\(seconds\) && seconds > 0 \? seconds : null;\s*\}\}/);
    const onEndedBody = meditateSource.match(/onEnded=\{\(\) => \{[\s\S]*?\n\s*\}\}/)?.[0] ?? '';
    expect(onEndedBody).toMatch(/const durationSeconds = mediaDurationRef\.current;/);
  });
});

describe('BetaVideoModal.jsx — onDurationKnown is additive, never changes the existing onEnded/completionContext contract', () => {
  const betaVideoModalSource = read('../components/BetaVideoModal.jsx');

  it('onEnded itself still takes no arguments - onDurationKnown is a wholly separate, optional prop', () => {
    expect(betaVideoModalSource).toMatch(/onEnded, completionContext = null, onDurationKnown/);
  });

  it('onDurationKnown fires from onLoadedMetadata, alongside (never replacing) the existing whole-minutes cosmetic cache', () => {
    expect(betaVideoModalSource).toMatch(/cacheDurationSeconds\(entry\.id, e\.currentTarget\.duration\);/);
    expect(betaVideoModalSource).toMatch(/onDurationKnown\?\.\(e\.currentTarget\.duration\);/);
  });
});

describe('MeditationComplete.jsx (legacy /meditation-complete route) — audit correction proof', () => {
  it('nothing in the app still navigates to /meditation-complete - the route is reachable only by a direct/typed URL visit', () => {
    // Repo-wide search proxy: grep already confirmed zero navigate('/meditation-complete' call sites during
    // implementation; this assertion pins the one remaining safe reader of
    // `session` so a future re-introduction of a real navigate() call site
    // is immediately visible in this same test file's failure, not silently
    // reintroducing the false-completion defect.
    expect(meditationCompleteSource).toMatch(/const session = location\.state \|\| null;/);
  });

  it('both action handlers require genuine session state (not just !endedEarly) before ever writing the completion flag - a bare direct URL visit can never record completion regardless of which button is tapped', () => {
    const occurrences = meditationCompleteSource.match(/if \(session && !endedEarly\) localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/g) ?? [];
    expect(occurrences.length).toBe(2);
    // The old, defective guard must be gone entirely - not merely joined by the new one.
    expect(meditationCompleteSource).not.toMatch(/if \(!endedEarly\) localStorage\.setItem/);
  });

  it('this legacy screen never itself writes to practice_completion_events - Phase 2 wires that completion entirely inside Meditate.jsx\'s own in-place onEnded handler', () => {
    expect(meditationCompleteSource).not.toMatch(/recordPracticeCompletion/);
  });
});
