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

const playerSource = read('./InteractiveAmbientMusic.jsx');
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
    expect(playerSource).toMatch(/onPlay=\{\(\) => setMusicEnabledState\(true\)\}/);
    expect(playerSource).toMatch(/onPause=\{\(\) => setMusicEnabledState\(false\)\}/);
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

  it('a guest transition (defensive sign-out guard) only ever calls the native .pause() DOM method inside its effect - never setState in an effect', () => {
    expect(playerSource).toMatch(/useEffect\(\(\) => \{\s*\n\s*if \(!isGuest\) return;\s*\n\s*audioRef\.current\?\.pause\(\);\s*\n\s*\}, \[isGuest\]\);/);
  });

  it('the visible toggle state can never show "on" for a guest or a suspended screen, even for one stale render', () => {
    expect(playerSource).toMatch(/const isChecked = musicEnabled && !isGuest && !suspended;/);
  });
});

describe('`suspended` prop - stop before an optional guided video opens (Breathe.jsx/MorningFlow.jsx)', () => {
  it('defaults to false, so EveningBreathing.jsx/QuietBreathing.jsx (which never pass it) are unaffected', () => {
    expect(playerSource).toMatch(/export const InteractiveAmbientMusic = \(\{ musicVariantId, suspended = false \}\) => \{/);
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

describe('Guest restrictions match the agreed onboarding policy - intercept at the point of use, never silently allow', () => {
  it('a guest tap opens the same shared SignInPromptDialog used everywhere else, instead of starting playback', () => {
    expect(playerSource).toMatch(/const handleToggle = \(\) => \{[\s\S]*?if \(isGuest\) \{\s*\n\s*setShowSignInPrompt\(true\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('stashes a same-page pending redirect before navigating to /auth, consistent with every other restricted action', () => {
    expect(playerSource).toMatch(/setPendingContent\(\{ returnPath: `\$\{location\.pathname\}\$\{location\.search\}` \}\);/);
  });
});

describe('Shared by every structurally-similar interactive timed screen', () => {
  it('EveningBreathing.jsx renders the shared player with IB01, never passing `suspended` (no video rows on that page)', () => {
    expect(eveningBreathingSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(eveningBreathingSource).toMatch(/<InteractiveAmbientMusic musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} \/>/);
    expect(eveningBreathingSource).not.toMatch(/suspended=/);
  });

  it('QuietBreathing.jsx renders the same shared player with IB01, not an independent copy, and also never passes `suspended`', () => {
    expect(quietBreathingSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(quietBreathingSource).toMatch(/<InteractiveAmbientMusic musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} \/>/);
    expect(quietBreathingSource).not.toMatch(/suspended=/);
  });

  it('both reserve the exact same shared breathing/grounding asset id - one loop serves both screens', () => {
    expect(eveningBreathingSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
    expect(quietBreathingSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
  });

  it('Breathe.jsx (Morning grounding/breathing timer - confirmed no narration during the ring itself) renders the shared player with IB01, suspended while a guided video is open', () => {
    expect(breatheSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(breatheSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
    expect(breatheSource).toMatch(/<InteractiveAmbientMusic musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} suspended=\{Boolean\(openVideo\)\} \/>/);
  });

  it('MorningFlow.jsx (interactive stretch timer) renders the shared player with a DISTINCT id (IS01), also suspended while a guided video is open', () => {
    expect(morningFlowSource).toMatch(/import \{ InteractiveAmbientMusic \} from '\.\.\/components\/InteractiveAmbientMusic';/);
    expect(morningFlowSource).toMatch(/const INTERACTIVE_STRETCHING_MUSIC_ID = 'IS01';/);
    expect(morningFlowSource).toMatch(/<InteractiveAmbientMusic musicVariantId=\{INTERACTIVE_STRETCHING_MUSIC_ID\} suspended=\{Boolean\(openVideo\)\} \/>/);
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

    it(`${name}: the running timer's own effect bails out while videoOpenedDuringExercise is true`, () => {
      expect(source).toMatch(/if \([^)]*videoOpenedDuringExercise[^)]*\) return;/);
    });

    it(`${name}: closing the video does not clear videoOpenedDuringExercise - only handleResumeExercise does, and it is only ever wired to a button's own onClick`, () => {
      expect(source).toMatch(/const handleResumeExercise = \(\) => \{\s*\n\s*setVideoOpenedDuringExercise\(false\);\s*\n\s*\};/);
      expect(source).toMatch(/onClick=\{handleResumeExercise\}/);
      // closeVideo (passed to BetaVideoModal's onClose) must never itself
      // reference setVideoOpenedDuringExercise - only the dedicated Resume
      // Exercise button may.
      expect(source).not.toMatch(/onClose=\{[^}]*setVideoOpenedDuringExercise/);
    });

    it(`${name}: "Resume Exercise" is shown only while a video was opened AND none is currently open`, () => {
      expect(source).toMatch(/videoOpenedDuringExercise && !openVideo \? \(/);
      expect(source).toMatch(/Resume Exercise/);
    });
  }
});
