// Regression guard for InteractiveAmbientMusic.jsx (shared interactive-
// timed-screen ambient loop — EveningBreathing/QuietBreathing/Breathe/
// MorningFlow). No DOM/component rendering is available in this repo's
// Vitest (see Home.routineState.test.js's own note) - these are
// source-level checks, matching every other regression guard in this
// codebase for exactly that reason. Pure eligibility logic itself is
// unit-tested directly in backgroundMusicSelection.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
// Strips /* ... */ and // ... comments - some of this file's own doc
// comments legitimately describe react-router navigate() conceptually
// (e.g. the unmount-cleanup rationale), which must not itself trip a
// check for actual navigate(/SignInPromptDialog usage in real code.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const playerSource = read('./InteractiveAmbientMusic.jsx');
const playerCodeOnly = stripComments(playerSource);
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');

describe('Exactly one <audio> element - no narration exists on these screens', () => {
  it('renders exactly one <audio> tag, no <video>', () => {
    const audioTags = playerSource.match(/<audio\s*\n\s*ref=\{audioRef\}/g) ?? [];
    expect(audioTags.length).toBe(1);
    expect(playerSource).not.toMatch(/<video[\s>]/);
  });
});

describe('Music defaults off, uses the same shared persisted preference', () => {
  it('musicEnabled always starts false on a fresh mount - never seeded from getMusicPreference()', () => {
    expect(playerSource).toMatch(/const \[musicEnabled, setMusicEnabledState\] = useState\(false\);/);
    const importLine = playerSource.match(/^import .*musicPreference.*$/m)?.[0] ?? '';
    expect(importLine).not.toMatch(/getMusicPreference/);
    expect(importLine).toMatch(/setMusicPreference/);
  });

  it('writes go through the same shared musicPreference.js key used by BetaVideoModal.jsx', () => {
    expect(playerSource).toMatch(/import \{ setMusicPreference \} from '\.\.\/lib\/musicPreference';/);
    expect(playerSource).toMatch(/setMusicPreference\(false\);/);
    expect(playerSource).toMatch(/setMusicPreference\(true\);/);
  });
});

describe('musicEnabled is driven by the <audio> element\'s own native events, never set from an effect', () => {
  it('onPlay/onPause on the <audio> element are the only two places setMusicEnabledState is ever called', () => {
    const setCalls = playerSource.match(/setMusicEnabledState\(/g) ?? [];
    expect(setCalls.length).toBe(2);
    expect(playerSource).toMatch(/onPlay=\{\(\) => \{\s*\n\s*setMusicEnabledState\(true\);/);
    expect(playerSource).toMatch(/onPause=\{\(\) => setMusicEnabledState\(false\)\}/);
  });

  // Regression test for a real bug found during guest-access verification:
  // start()'s own `await audio.play()` can settle noticeably later than
  // the native 'play' event that actually drives musicEnabled - leaving
  // isBusyRef stuck true and the toggle silently unresponsive to an Off
  // tap for that whole gap, even with audio audibly already playing.
  it('onPlay also clears isBusyRef the moment playback is genuinely confirmed, not only in start()\'s own finally', () => {
    const onPlayBody = playerSource.match(/onPlay=\{\(\) => \{[\s\S]*?\n {8}\}\}/)?.[0] ?? '';
    expect(onPlayBody).not.toBe('');
    expect(onPlayBody).toMatch(/isBusyRef\.current = false;/);
  });

  it('no useEffect body anywhere in the file calls setMusicEnabledState directly (would trip react-hooks/set-state-in-effect)', () => {
    const effectBodies = playerSource.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/g) ?? [];
    expect(effectBodies.length).toBeGreaterThan(0);
    for (const body of effectBodies) {
      expect(body).not.toMatch(/setMusicEnabledState/);
    }
  });
});

describe('Feature flag + registered-asset gating (missing music variants fall back safely)', () => {
  it('eligibility is resolved via the shared isInteractiveMusicEligible guard, not a local re-implementation', () => {
    expect(playerSource).toMatch(/import \{ isInteractiveMusicEligible \} from '\.\.\/lib\/backgroundMusicSelection';/);
    expect(playerSource).toMatch(/const eligible = isInteractiveMusicEligible\(\{ musicVariantId, featureEnabled: featureOn, getEntryById: getBetaVideoById \}\);/);
  });

  it('renders nothing at all when ineligible (today\'s real state - no manifest entry exists for IB01 or IS01)', () => {
    expect(playerSource).toMatch(/if \(!eligible\) return null;/);
  });
});

describe('Start only after a user gesture (iOS autoplay rules)', () => {
  it('audio.play() is only ever called from inside start(), which is only ever called from handleToggle - never from an effect or on mount', () => {
    const playCalls = playerSource.match(/await audio\.play\(\);/g) ?? [];
    expect(playCalls.length).toBe(1);
    expect(playerSource).toMatch(/const start = async \(\) => \{/);
    expect(playerSource).toMatch(/const handleToggle = \(\) => \{[\s\S]*?start\(\);/);
  });

  it('sets a low default volume appropriate for a background bed, not full volume', () => {
    expect(playerSource).toMatch(/const DEFAULT_VOLUME = 0\.35;/);
    expect(playerSource).toMatch(/audio\.volume = DEFAULT_VOLUME;/);
  });

  it('loops seamlessly via the native loop attribute', () => {
    expect(playerSource).toMatch(/audio\.loop = true;/);
  });
});

describe('Prevent duplicate playback on remount or repeated taps', () => {
  it('start() is guarded by isBusyRef for its entire async body, including the network fetch', () => {
    expect(playerSource).toMatch(/const start = async \(\) => \{\s*\n\s*if \(isBusyRef\.current\) return;\s*\n\s*isBusyRef\.current = true;/);
    expect(playerSource).toMatch(/\} finally \{\s*\n\s*isBusyRef\.current = false;\s*\n\s*\}/);
  });

  it('handleToggle also checks isBusyRef before doing anything, so a rapid second tap while loading is ignored', () => {
    expect(playerSource).toMatch(/const handleToggle = \(\) => \{[\s\S]*?if \(isBusyRef\.current\) return;/);
  });

  it('a fresh mount always gets its own new ref - a stale previous instance can never bleed into a remount (structural, via useRef(null) + the unmount cleanup below)', () => {
    expect(playerSource).toMatch(/const audioRef = useRef\(null\);/);
  });
});

describe('Missing/failed asset falls back to silent continuation with only an unobtrusive message', () => {
  it('a load/playback failure sets loadError, never throws or blocks the exercise', () => {
    expect(playerSource).toMatch(/\} catch \{\s*\n[\s\S]*?setLoadError\(true\);/);
  });

  it('the failure message is small, unobtrusive, and explicitly says the exercise continues without music', () => {
    expect(playerSource).toMatch(/Music unavailable right now — continuing without it\./);
  });

  it('an <audio> element error event also surfaces the same unobtrusive state, never a blocking dialog', () => {
    expect(playerSource).toMatch(/onError=\{\(\) => setLoadError\(true\)\}/);
  });
});

describe('Stop and release the element on every exit path', () => {
  it('unmount cleanup pauses, clears src, and reloads the element - Skip/Continue/Back/route-change/stage-change all navigate() away, which unmounts this component', () => {
    expect(playerSource).toMatch(/audio\.pause\(\);\s*\n\s*audio\.removeAttribute\('src'\);\s*\n\s*audio\.load\(\);/);
  });

  it('has no guest defensive sign-out guard any more - a guest is genuinely allowed to keep this playing (IB01/IS01 are server-allowlisted in GUEST_ALLOWED_IDS)', () => {
    expect(playerSource).not.toMatch(/if \(!isGuest\) return;/);
    expect(playerSource).not.toMatch(/\[isGuest\]/);
  });

  it('the visible toggle state can never show "on" for a suspended screen, even for one stale render - guest is no longer part of this guard', () => {
    expect(playerSource).toMatch(/const isChecked = musicEnabled && !suspended;/);
  });
});

describe('`suspended` prop - stop before an optional guided video opens (Breathe.jsx/MorningFlow.jsx)', () => {
  it('defaults to false, so EveningBreathing.jsx/QuietBreathing.jsx (which never pass it) are unaffected', () => {
    expect(playerSource).toMatch(/export const InteractiveAmbientMusic = forwardRef\(\(\{ musicVariantId, suspended = false, hideToggle = false \}, ref\) => \{/);
  });

  it('a suspended transition only ever calls the native .pause() DOM method inside its effect - never setState in an effect', () => {
    expect(playerSource).toMatch(/useEffect\(\(\) => \{\s*\n\s*if \(!suspended\) return;\s*\n\s*audioRef\.current\?\.pause\(\);\s*\n\s*\}, \[suspended\]\);/);
  });

  it('handleToggle refuses to start/stop while suspended - a guided video open on the same page cannot be fought with a toggle tap', () => {
    expect(playerSource).toMatch(/const handleToggle = \(\) => \{\s*\n\s*if \(suspended\) return;/);
  });

  it('closing the video (suspended -> false) has no code path that calls start() or .play() - resuming requires a fresh, real toggle tap', () => {
    // The only two call sites of start()/.play() are inside handleToggle
    // (a real click) - already proven above (`playCalls.length === 1`,
    // only inside start(), only called from handleToggle). No effect in
    // this file references `start(` at all.
    const effectBodies = playerSource.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/g) ?? [];
    for (const body of effectBodies) {
      expect(body).not.toMatch(/start\(\)/);
    }
  });
});

describe('Guests genuinely control playback - no authentication UI intercepts this toggle', () => {
  // IB01/IS01 (the only two ids this component is ever given - see the
  // "Shared by every structurally-similar interactive timed screen"
  // describe block below) are both explicitly server-allowlisted for
  // guest access (GUEST_ALLOWED_IDS in
  // supabase/functions/_shared/betaVideoUrlAccess.ts, proven to genuinely
  // succeed for a guest by src/lib/betaVideoUrlGuestAccess.test.js) -
  // this component must never intercept a guest's tap with a sign-in
  // prompt of any kind.
  it('handleToggle has no sign-in-interception branch - it never shows a prompt instead of reaching stop()/start()', () => {
    const body = playerSource.match(/const handleToggle = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/if \(isGuest\)/);
    expect(body).not.toMatch(/SignInPrompt/);
    expect(body).toMatch(/start\(\);/);
    expect(body).toMatch(/stop\(\);/);
  });

  it('no SignInPromptDialog, no pending-content stash, no /auth navigation exists in this file\'s real code any more (only removal-rationale comments may mention navigate() conceptually)', () => {
    expect(playerCodeOnly).not.toMatch(/SignInPromptDialog/);
    expect(playerCodeOnly).not.toMatch(/setPendingContent/);
    expect(playerCodeOnly).not.toMatch(/navigate\(/);
    expect(playerCodeOnly).not.toMatch(/\/auth/);
  });

  it('a guest\'s choice is never persisted to the shared, device-scoped musicPreference.js key (would leak into/be overwritten by whoever else signs in on this device) - only a signed-in user\'s choice is', () => {
    const body = playerSource.match(/const handleToggle = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!isGuest\) setMusicPreference\(false\);/);
    expect(body).toMatch(/if \(!isGuest\) setMusicPreference\(true\);/);
  });

  it('isGuest is still read from useAuth (needed for the persistence guard above), but useNavigate/useLocation are gone - nothing in this file navigates any more', () => {
    expect(playerSource).toMatch(/const \{ isGuest \} = useAuth\(\);/);
    expect(playerSource).not.toMatch(/useNavigate|useLocation/);
  });
});

describe('Shared by every structurally-similar interactive timed screen', () => {
  it('EveningBreathing.jsx renders ONE shared, stable player with IB01 (Build 15: never two separate mount points across the pre-start/active transition - see MorningFlow.jsx\'s own fix comment), suspended={manuallyPaused} only once genuinely begun', () => {
    expect(eveningBreathingSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(eveningBreathingSource).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}\s*\n\s*suspended=\{hasBegun \? manuallyPaused : false\}\s*\n\s*hideToggle=\{!hasBegun\}\s*\n\s*\/>/);
    const mountCount = (eveningBreathingSource.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
  });

  it('QuietBreathing.jsx (non-standalone, Support\'s own unchanged usage) renders the same shared player with IB01, not an independent copy, and also never passes `suspended` - the standalone branch below is a separate, later `return` and never reached by Support\'s own usage', () => {
    expect(quietBreathingSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(quietBreathingSource).toMatch(/<InteractiveAmbientMusic ref=\{musicPlayerRef\} musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} \/>/);
    // Scoped to the non-standalone `return` (after the `if (standalone)`
    // early return) - the standalone branch's own InteractiveAmbientMusic
    // mount legitimately does pass `suspended` (always false) and is a
    // completely separate JSX tree, never reached when !standalone.
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).not.toMatch(/suspended=/);
  });

  it('both reserve the exact same shared breathing/grounding asset id - one loop serves both screens', () => {
    expect(eveningBreathingSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
    expect(quietBreathingSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
  });

  it('Breathe.jsx (Morning grounding/breathing timer - confirmed no narration during the ring itself) renders ONE shared, stable player with IB01, suspended while a guided video is open (only once genuinely begun)', () => {
    expect(breatheSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(breatheSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
    expect(breatheSource).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}\s*\n\s*suspended=\{hasBegun \? \(Boolean\(openVideo\) \|\| manuallyPaused\) : false\}\s*\n\s*hideToggle=\{!hasBegun\}\s*\n\s*\/>/);
    const mountCount = (breatheSource.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
  });

  it('MorningFlow.jsx (interactive stretch timer) renders ONE shared, stable player with a DISTINCT id (IS01), also suspended while a guided video is open or manually paused (only once genuinely begun)', () => {
    expect(morningFlowSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(morningFlowSource).toMatch(/const INTERACTIVE_STRETCHING_MUSIC_ID = 'IS01';/);
    expect(morningFlowSource).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_STRETCHING_MUSIC_ID\}\s*\n\s*suspended=\{hasBegun \? \(Boolean\(openVideo\) \|\| manuallyPaused\) : false\}\s*\n\s*hideToggle=\{!hasBegun\}\s*\n\s*\/>/);
    const mountCount = (morningFlowSource.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
  });

  it('IS01 and IB01 are never swapped between the two screens', () => {
    expect(breatheSource).not.toMatch(/IS01/);
    expect(morningFlowSource).not.toMatch(/'IB01'/);
  });
});

describe('Breathe.jsx / MorningFlow.jsx - pausing the exercise timer itself when a guided video opens', () => {
  for (const [name, source] of [['Breathe.jsx', breatheSource], ['MorningFlow.jsx', morningFlowSource]]) {
    it(`${name}: selecting a guided-video row sets videoOpenedDuringExercise from the click handler itself (never an effect)`, () => {
      expect(source).toMatch(/const \[videoOpenedDuringExercise, setVideoOpenedDuringExercise\] = useState\(false\);/);
      expect(source).toMatch(/const handleSelectVideo = \(id\) => \{\s*\n\s*setVideoOpenedDuringExercise\(true\);\s*\n\s*handleSelect\(id\);\s*\n\s*\};/);
      // Every video row uses the wrapper, never the raw handleSelect directly.
      const rowOnClicks = source.match(/onClick=\{\(\) => handle\w+\(id\)\}/g) ?? [];
      expect(rowOnClicks.length).toBeGreaterThan(0);
      for (const onClick of rowOnClicks) {
        expect(onClick).toMatch(/handleSelectVideo/);
      }
    });

    it(`${name}: videoOpenedDuringExercise and the new manuallyPaused flag converge into one isInterrupted flag, and the running timer's own effect bails out on it - preserving the exact remaining time/phase either way`, () => {
      // manuallyPaused now also seeds true when resuming from a review-
      // pause snapshot (timedExercisePause.js) - still false on any
      // ordinary fresh mount.
      expect(source).toMatch(/const \[manuallyPaused, setManuallyPaused\] = useState\(\(\) => Boolean\(pausedSnapshot\)\);/);
      expect(source).toMatch(/const isInterrupted = videoOpenedDuringExercise \|\| manuallyPaused;/);
      expect(source).toMatch(/if \([^)]*isInterrupted[^)]*\) return;/);
      // handleResumeExercise itself never touches the countdown/phase state
      // (secondsLeft/breatheState on Breathe.jsx, timeLeft/activeStep on
      // MorningFlow.jsx) - only the guard above ever does, by simply not
      // running while paused. Resuming is "let the same effect start
      // ticking again from whatever state was already there", not a reset.
      const resumeBody = source.match(/const handleResumeExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(resumeBody).not.toMatch(/setSecondsLeft|setBreatheState|setTimeLeft|setActiveStep/);
    });

    it(`${name}: closing the video does not clear videoOpenedDuringExercise/manuallyPaused - only handleResumeExercise/handleResumeWithMusic do, both wired only to ExercisePausedPanel's own props`, () => {
      expect(source).toMatch(/const handleResumeExercise = \(\) => \{\s*\n\s*setVideoOpenedDuringExercise\(false\);\s*\n\s*setManuallyPaused\(false\);\s*\n\s*\};/);
      expect(source).toMatch(/onResumeExercise=\{handleResumeExercise\}/);
      // closeVideo (passed to BetaVideoModal's onClose) must never itself
      // reference setVideoOpenedDuringExercise - only the two dedicated
      // resume actions may.
      expect(source).not.toMatch(/onClose=\{[^}]*setVideoOpenedDuringExercise/);
    });

    // Build 15 — neither MorningFlow.jsx nor Breathe.jsx has a
    // "musicChoiceMade"/"awaitingMusicChoice" concept any more (see
    // musicEntryChoice.test.js's own updated coverage): each pre-start
    // screen resolves the music preference before hasBegun is ever true,
    // so once the exercise is running there is nothing left to "await".
    it(`${name}: the paused panel (and its two resume actions) render whenever interrupted (video or manual pause) and no video is currently open, and only once genuinely begun - no separate "awaiting music choice" gate exists here`, () => {
      expect(source).toMatch(/\{hasBegun && !isRepeatGated && isInterrupted && !openVideo && \(\s*\n\s*<ExercisePausedPanel/);
      expect(source).not.toMatch(/musicChoiceMade|awaitingMusicChoice/);
    });

    it(`${name}: a persistent "Pause Exercise" button is reachable whenever the exercise is actually running (not interrupted, no video open, genuinely begun)`, () => {
      expect(source).toMatch(/const handlePauseExercise = \(\) => setManuallyPaused\(true\);/);
      expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isInterrupted && !openVideo && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{handlePauseExercise\}/);
      expect(source).toMatch(/Pause Exercise/);
      const musicIndex = source.indexOf('<InteractiveAmbientMusic');
      const pauseButtonIndex = source.indexOf('onClick={handlePauseExercise}');
      expect(musicIndex).toBeGreaterThan(-1);
      expect(pauseButtonIndex).toBeGreaterThan(musicIndex);
    });

    it(`${name}: the panel sits immediately after InteractiveAmbientMusic (the one, stable, never-remounted instance) and strictly before the ACTIVE-state guided-video row - visible without scrolling past the video catalogue`, () => {
      // Build 15 release-quality pass — both screens now also render an
      // earlier, pre-start copy of their guided-video rows (behind a
      // collapsed-by-default disclosure), so a plain indexOf would find
      // that earlier, pre-Begin occurrence instead of the active-state
      // one this check is actually about. lastIndexOf targets the
      // active-state occurrence specifically, which always comes after
      // ExercisePausedPanel in the source regardless of how many earlier
      // pre-start copies exist.
      const musicIndex = source.indexOf('<InteractiveAmbientMusic');
      const panelIndex = source.indexOf('<ExercisePausedPanel');
      const videoRowIndex = source.lastIndexOf('<BetaVideoRow');
      expect(musicIndex).toBeGreaterThan(-1);
      expect(panelIndex).toBeGreaterThan(musicIndex);
      expect(videoRowIndex).toBeGreaterThan(panelIndex);
    });

    it(`${name}: the ordinary "Continue"/"Next Movement"/"Next Step" control is hidden while interrupted, so it never appears alongside the Pause button or the paused panel`, () => {
      expect(source).toMatch(/\{!isInterrupted && \(\s*\n\s*<button\s*\n\s*onClick=\{handle(NextStep|Complete)\}/);
    });

    it(`${name}: "Resume with Music" starts this screen's own ambient loop via the ref InteractiveAmbientMusic exposes, only from this dedicated handler - never automatically`, () => {
      expect(source).toMatch(/const musicPlayerRef = useRef\(null\);/);
      expect(source).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}/);
      expect(source).toMatch(/const handleResumeWithMusic = \(\) => \{\s*\n\s*setVideoOpenedDuringExercise\(false\);\s*\n\s*setManuallyPaused\(false\);\s*\n\s*musicPlayerRef\.current\?\.start\(\);\s*\n\s*\};/);
      expect(source).toMatch(/onResumeWithMusic=\{handleResumeWithMusic\}/);
      // No useEffect anywhere in the file calls start() on the ref - the
      // only call site is the click handler above.
      const effectBodies = source.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/g) ?? [];
      for (const body of effectBodies) {
        expect(body).not.toMatch(/musicPlayerRef/);
      }
    });

    it(`${name}: "Resume with Music" is hidden (not merely disabled) when this screen's ambient loop isn't currently eligible - never a button that would silently do nothing`, () => {
      expect(source).toMatch(/const musicEligible = isInteractiveMusicEligible\(\{/);
      expect(source).toMatch(/showResumeWithMusic=\{musicEligible\}/);
    });
  }
});

describe('ExercisePausedPanel.jsx - the shared paused-for-video panel itself', () => {
  const panelSource = read('./ExercisePausedPanel.jsx');

  it('renders the exact required copy, never framed as an error', () => {
    expect(panelSource).toMatch(/Exercise paused/);
    expect(panelSource).toMatch(/Your timer and background music were stopped while you viewed the guided session\./);
  });

  it('Resume Exercise is always rendered; Resume with Music only when showResumeWithMusic is true', () => {
    expect(panelSource).toMatch(/onClick=\{onResumeExercise\}[\s\S]*?Resume Exercise/);
    expect(panelSource).toMatch(/\{showResumeWithMusic && \(/);
    expect(panelSource).toMatch(/onClick=\{onResumeWithMusic\}[\s\S]*?Resume with Music/);
  });
});

describe('InteractiveAmbientMusic.jsx exposes start() via ref, and re-checks `suspended` after its own async gap', () => {
  it('is wrapped in forwardRef and exposes exactly { start } via useImperativeHandle, called unconditionally (before the eligible early-return, not after)', () => {
    expect(playerSource).toMatch(/useImperativeHandle\(ref, \(\) => \(\{ start \}\)\);/);
    const imperativeIndex = playerSource.indexOf('useImperativeHandle(ref');
    const eligibleReturnIndex = playerSource.indexOf('if (!eligible) return null;');
    expect(imperativeIndex).toBeGreaterThan(-1);
    expect(eligibleReturnIndex).toBeGreaterThan(imperativeIndex);
  });

  it('start() re-checks a suspended-mirroring ref AFTER its await, before ever touching the <audio> element - the actual fix for music starting under/after a video opened mid-fetch', () => {
    expect(playerSource).toMatch(/const suspendedRef = useRef\(suspended\);\s*\n\s*suspendedRef\.current = suspended;/);
    const startBody = playerSource.match(/const start = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const awaitIndex = startBody.indexOf('await requestBetaVideoUrl');
    const suspendedCheckIndex = startBody.indexOf('if (suspendedRef.current) return;');
    const audioSrcIndex = startBody.indexOf('audio.src = url;');
    expect(awaitIndex).toBeGreaterThan(-1);
    expect(suspendedCheckIndex).toBeGreaterThan(awaitIndex);
    expect(audioSrcIndex).toBeGreaterThan(suspendedCheckIndex);
  });
});
