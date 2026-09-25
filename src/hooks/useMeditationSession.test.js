// Source-level regression guard for useMeditationSession.js - the React
// timer/controller glue extracted from SelfGuidedMeditation.jsx (Journey
// Embedding, Phase 2). Source-level, matching this repo's established
// convention for hook/page logic not practically renderable in the
// `node`-environment Vitest this repo runs (see selfGuidedMeditationSetup.
// test.js's own note) - the real timer/audio BEHAVIOUR these handlers call
// into is independently, genuinely real-execution-tested in
// meditationSessionController.test.js/meditationSession.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useMeditationSession.js', import.meta.url)), 'utf-8');

describe('useMeditationSession — no autoplay before Begin', () => {
  // Build 16 physical-iPhone correction (F3/F4/F7) — createMeditationSession
  // Controller is now constructed inside getOrCreateController(), a small
  // shared helper called by BOTH preload() (fired from the countdown's own
  // start, well before the timer/audio actually begin) and begin() itself
  // (idempotent - reuses the same controller preload() already created,
  // never a second one). The real invariant this guards - a controller is
  // never created merely by mounting/rendering this hook, only by a real
  // preload() or begin() call from an actual Begin gesture - still holds;
  // it just has two legitimate entry points now instead of one.
  it('createMeditationSessionController is only ever constructed inside getOrCreateController(), called only from preload() and begin()', () => {
    const outsideHelper = source.replace(/const getOrCreateController = \(\) => \{[\s\S]*?\n {2}\};/, '');
    expect(outsideHelper).not.toMatch(/createMeditationSessionController\(/);
    const helperBody = source.match(/const getOrCreateController = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(helperBody).toMatch(/createMeditationSessionController\(/);

    const preloadBody = source.match(/const preload = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(preloadBody).toMatch(/getOrCreateController\(\)\.preload\(\);/);
    const beginBody = source.match(/const begin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/getOrCreateController\(\);/);

    // Only these two call it - no third caller anywhere in the file.
    const callCount = (source.match(/getOrCreateController\(\)/g) ?? []).length;
    expect(callCount).toBe(2);
  });

  it('preload() alone can never advance the timer or mark the session started - it never calls controller.begin() or sets phase', () => {
    const preloadBody = source.match(/const preload = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(preloadBody).not.toMatch(/\.begin\(\)/);
    expect(preloadBody).not.toMatch(/setPhase/);
  });

  it('no effect calls begin()/start() on mount', () => {
    expect(source).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,200}\.begin\(\)/);
  });
});

describe('useMeditationSession — repeated Begin taps cannot create duplicates', () => {
  it('begin() is guarded by a ref, checked and set before any controller work happens', () => {
    const body = source.match(/const begin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(beganRef\.current\) return;/);
    expect(body).toMatch(/beganRef\.current = true;/);
  });
});

describe('useMeditationSession — cleanup on unmount/route change', () => {
  it('a mount effect with an empty dependency array returns a cleanup that destroys the controller and clears the interval', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => cleanupSession\(\), \[\]\);/);
    const cleanupBody = source.match(/const cleanupSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(cleanupBody).toMatch(/stopInterval\(\);/);
    expect(cleanupBody).toMatch(/controllerRef\.current\?\.destroy\(\);/);
  });
});

describe('useMeditationSession — configurable defaults, five styles, three durations', () => {
  it('imports the real MEDITATION_STYLES/MEDITATION_DURATIONS data modules rather than inlining a second copy', () => {
    expect(source).toMatch(/from '\.\.\/lib\/meditationStyles';/);
    expect(source).toMatch(/from '\.\.\/lib\/meditationDurations';/);
  });

  it('falls back to DEFAULT_MEDITATION_STYLE_ID/DEFAULT_MEDITATION_DURATION_ID only when no valid initial value is supplied - a caller-supplied value always wins', () => {
    const styleBody = source.match(/const \[styleId, setStyleIdState\] = useState\(\(\) =>[\s\S]*?\);/)?.[0] ?? '';
    expect(styleBody).toMatch(/getMeditationStyleById\(initialStyleId\) \? initialStyleId : DEFAULT_MEDITATION_STYLE_ID/);
    const durationBody = source.match(/const \[durationId, setDurationId\] = useState\(\(\) =>[\s\S]*?\);/)?.[0] ?? '';
    expect(durationBody).toMatch(/getMeditationDurationById\(initialDurationId\) \? initialDurationId : DEFAULT_MEDITATION_DURATION_ID/);
  });
});

describe('useMeditationSession — sound selection: style-aware default, explicit-choice tracking, no guest gating', () => {
  it('imports the real MEDITATION_SOUNDS/getSuggestedSoundIdForStyle/toControllerSoundId - no second copy of the sound data', () => {
    expect(source).toMatch(/from '\.\.\/lib\/meditationSounds';/);
    expect(source).toMatch(/getSuggestedSoundIdForStyle/);
    expect(source).toMatch(/toControllerSoundId/);
  });

  it('a valid initialSoundId counts as an explicit choice from the very first render', () => {
    expect(source).toMatch(/const \[soundExplicit, setSoundExplicit\] = useState\(\(\) => isValidMeditationSoundId\(initialSoundId\)\);/);
  });

  it('selectStyle only updates the suggested sound while no explicit choice has been made yet', () => {
    const body = source.match(/const selectStyle = \(newStyleId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!soundExplicit\) \{/);
    expect(body).toMatch(/getSuggestedSoundIdForStyle\(newStyleId\)/);
  });

  it('selectSound marks the choice explicit going forward', () => {
    const body = source.match(/const selectSound = \(newSoundId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setSoundExplicit\(true\);/);
  });

  it('no isGuest/onSignIn/auth redirect anywhere in this file - IM01 and IM02 are both server-allowlisted for guests', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/isGuest/);
    expect(codeOnly).not.toMatch(/onSignIn/);
    expect(codeOnly).not.toMatch(/'\/auth'/);
  });
});

describe('useMeditationSession — active session: sound can be changed live without a timer restart', () => {
  it('selectSound drives the live controller\'s setSoundId only while active, converting the UI sentinel first', () => {
    const body = source.match(/const selectSound = \(newSoundId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(phase === 'active'\) \{/);
    expect(body).toMatch(/controllerRef\.current\?\.setSoundId\(toControllerSoundId\(newSoundId\)\);/);
  });

  it('a genuine playback failure reverts both the real controller and the displayed selection to No Music, and flags the unavailable message', () => {
    const beginBody = source.match(/const begin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/if \(latestSnapshot\.audioError\) \{/);
    expect(beginBody).toMatch(/current\.setSoundId\(null\);/);
    expect(beginBody).toMatch(/setSoundIdState\('none'\);/);
    expect(beginBody).toMatch(/setSoundUnavailable\(true\);/);
  });

  it('completion reads the sound actually active at that moment from the live snapshot, never a stale value captured at Begin', () => {
    const beginBody = source.match(/const begin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/soundId: latestSnapshot\.soundId \|\| 'none'/);
  });

  it('pause()/resume() only ever call the controller, never touch styleId/durationId/soundId - a timer pause/resume can never restart the timer or switch tracks', () => {
    const pauseBody = source.match(/const pause = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const resumeBody = source.match(/const resume = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(pauseBody).toMatch(/controllerRef\.current\?\.pause\(\);/);
    expect(resumeBody).toMatch(/controllerRef\.current\?\.resume\(\);/);
    expect(pauseBody).not.toMatch(/setStyleIdState|setDurationId|setSoundIdState/);
    expect(resumeBody).not.toMatch(/setStyleIdState|setDurationId|setSoundIdState/);
  });
});

describe('useMeditationSession — completion calls the caller-supplied onComplete, never navigates itself', () => {
  it('completion resets phase to setup and calls onComplete with the finished summary - no navigate/route/history call anywhere in this file', () => {
    // Comments stripped first - this file's own doc comments legitimately
    // discuss "never calls navigate() itself" in prose, which would
    // otherwise false-positive match the very pattern this asserts against
    // real code never containing.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/navigate\(/);
    expect(codeOnly).not.toMatch(/from 'react-router-dom'/);
    const beginBody = source.match(/const begin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/setPhase\('setup'\);/);
    expect(beginBody).toMatch(/onComplete\?\.\(finished\);/);
  });
});

describe('useMeditationSession — endSession never navigates, only stops and resets to setup', () => {
  it('endSession calls cleanupSession and resets phase to setup - the calling page decides what happens next', () => {
    const body = source.match(/const endSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/cleanupSession\(\);/);
    expect(body).toMatch(/setPhase\('setup'\);/);
    expect(body).not.toMatch(/navigate/);
  });
});

describe('useMeditationSession — this feature never touches Morning/Evening/Meditate completion state', () => {
  it('never imports dailyCompletion.js or the Session Engine', () => {
    expect(source).not.toMatch(/from '\.\.\/lib\/dailyCompletion'/);
    expect(source).not.toMatch(/from '\.\.\/context\/SessionContext'/);
    expect(source).not.toMatch(/useSession/);
  });
});
