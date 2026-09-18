// Regression guard for InteractiveBreathingMusic.jsx (Evening
// Breathing / Quiet Breathing ambient loop). No DOM/component rendering
// is available in this repo's Vitest (see Home.routineState.test.js's
// own note) - these are source-level checks, matching every other
// regression guard in this codebase for exactly that reason. Pure
// eligibility logic itself is unit-tested directly in
// backgroundMusicSelection.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const playerSource = read('./InteractiveBreathingMusic.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');

describe('Exactly one <audio> element - no narration exists on these screens', () => {
  it('renders exactly one <audio> tag, no <video>', () => {
    // Matches only the actual JSX tag opening (ref={audioRef} follows
    // it), not this file's own prose mentions of "<audio>" in doc comments.
    const audioTags = playerSource.match(/<audio ref=\{audioRef\}/g) ?? [];
    expect(audioTags.length).toBe(1);
    expect(playerSource).not.toMatch(/<video[\s>]/);
  });
});

describe('Music defaults off, uses the same shared persisted preference', () => {
  it('musicEnabled always starts false on a fresh mount - never seeded from getMusicPreference()', () => {
    expect(playerSource).toMatch(/const \[musicEnabled, setMusicEnabledState\] = useState\(false\);/);
    // getMusicPreference is discussed in this file's own doc comment
    // (explaining why it's deliberately NOT used) but must never actually
    // be imported/called - checked against the import line specifically,
    // not the whole file, for exactly that reason.
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

describe('Feature flag + registered-asset gating (missing music variants fall back safely)', () => {
  it('eligibility is resolved via the shared isInteractiveMusicEligible guard, not a local re-implementation', () => {
    expect(playerSource).toMatch(/import \{ isInteractiveMusicEligible \} from '\.\.\/lib\/backgroundMusicSelection';/);
    expect(playerSource).toMatch(/const eligible = isInteractiveMusicEligible\(\{ musicVariantId, featureEnabled: featureOn, getEntryById: getBetaVideoById \}\);/);
  });

  it('renders nothing at all when ineligible (today\'s real state - no manifest entry exists for any interactive-breathing id)', () => {
    expect(playerSource).toMatch(/if \(!eligible\) return null;/);
  });
});

describe('Start only after a user gesture (iOS autoplay rules)', () => {
  it('audio.play() is only ever called from inside start(), which is only ever called from handleToggle - never from an effect or on mount', () => {
    const playCalls = playerSource.match(/\.play\(\)/g) ?? [];
    expect(playCalls.length).toBe(1);
    expect(playerSource).toMatch(/const start = async \(\) => \{/);
    expect(playerSource).toMatch(/const handleToggle = \(\) => \{[\s\S]*?start\(\);/);
  });

  it('sets a low default volume appropriate for a breathing background, not full volume', () => {
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
  it('a load/playback failure sets loadError and stops, never throws or blocks the breathing cycle', () => {
    expect(playerSource).toMatch(/\} catch \{\s*\n[\s\S]*?setLoadError\(true\);\s*\n\s*setMusicEnabledState\(false\);/);
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

  it('a guest transition (defensive sign-out guard) pauses the element without a synchronous setState-in-effect', () => {
    expect(playerSource).toMatch(/useEffect\(\(\) => \{\s*\n\s*if \(!isGuest\) return;\s*\n\s*audioRef\.current\?\.pause\(\);\s*\n\s*\}, \[isGuest\]\);/);
  });

  it('the visible toggle state itself can never show "on" for a guest, even for one stale render', () => {
    expect(playerSource).toMatch(/const isChecked = musicEnabled && !isGuest;/);
  });
});

describe('Guest restrictions match the agreed onboarding policy - intercept at the point of use, never silently allow', () => {
  it('a guest tap opens the same shared SignInPromptDialog used everywhere else, instead of starting playback', () => {
    expect(playerSource).toMatch(/const handleToggle = \(\) => \{\s*\n\s*if \(isGuest\) \{\s*\n\s*setShowSignInPrompt\(true\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('stashes a same-page pending redirect before navigating to /auth, consistent with every other restricted action', () => {
    expect(playerSource).toMatch(/setPendingContent\(\{ returnPath: `\$\{location\.pathname\}\$\{location\.search\}` \}\);/);
  });
});

describe('Shared by both structurally-identical non-narrated interactive breathing screens', () => {
  it('EveningBreathing.jsx renders the shared player', () => {
    expect(eveningBreathingSource).toMatch(/import \{ InteractiveBreathingMusic \} from '\.\.\/components\/InteractiveBreathingMusic';/);
    expect(eveningBreathingSource).toMatch(/<InteractiveBreathingMusic musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} \/>/);
  });

  it('QuietBreathing.jsx renders the same shared player, not an independent copy', () => {
    expect(quietBreathingSource).toMatch(/import \{ InteractiveBreathingMusic \} from '\.\.\/components\/InteractiveBreathingMusic';/);
    expect(quietBreathingSource).toMatch(/<InteractiveBreathingMusic musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} \/>/);
  });

  it('both reserve the exact same shared asset id - one loop serves both screens', () => {
    expect(eveningBreathingSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
    expect(quietBreathingSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
  });

  it('Breathe.jsx (Morning breathing - already narrated) does NOT get this independent player placed beneath its existing narration', () => {
    expect(breatheSource).not.toMatch(/InteractiveBreathingMusic/);
    expect(breatheSource).toMatch(/useProtectedVideo/);
  });

  it('MorningFlow.jsx has no breathing cycle of its own (it is the Stretching stage) - confirmed not to need this player either', () => {
    expect(morningFlowSource).not.toMatch(/InteractiveBreathingMusic/);
    expect(morningFlowSource).not.toMatch(/BreathingRing/);
  });
});
