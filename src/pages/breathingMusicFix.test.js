// WakeWise DEV — iOS audio-start correction, applied consistently to
// Breathe.jsx (Morning Breathing) and EveningBreathing.jsx (Evening
// Breathing). Focused coverage, mirroring morningStretchMusicFix.test.js's
// structure exactly.
//
// Root cause (identical structurally-unsafe pattern found on both
// surfaces, same defect class already found and fixed for Anytime
// Breathing and Morning Stretch - see InteractiveAmbientMusic.jsx's own
// start()/unmute() doc comment for the full root-cause trace):
// handleBeginBreathing used to call only preload() (a network fetch,
// never touching playback) and deferred the real, audible start() call to
// usePreparationCountdown's own onComplete - which fires from a
// setInterval tick + effect, 5 real seconds after the Begin tap, not a
// synchronous continuation of it. iOS/WKWebView's gesture-before-
// unmuted-playback rule does not survive that gap, so audio.play() was
// silently rejected on both screens.
//
// Fix (identical, already-approved shape to QuietBreathing.jsx's own
// Anytime Breathing fix and MorningFlow.jsx's own Morning Stretch fix):
// handleBeginBreathing now calls the real, gesture-linked start(true)
// (muted) synchronously within the actual tap; the countdown's own
// onComplete then just unmute()s - a plain property set, no gesture
// requirement of its own, safe to call from that deferred callback.
// QuietBreathing.jsx itself was NOT touched - it already had this shape.
//
// No DOM/component rendering is available in this repo's Vitest
// (environment: 'node' - see vite.config.js), matching every other
// regression guard for InteractiveAmbientMusic/MorningFlow/Breathe/
// QuietBreathing/EveningBreathing - source-level checks throughout.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8').replace(/\r\n/g, '\n');

const breatheSource = read('./Breathe.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');
const quietBreathingSource = read('./QuietBreathing.jsx');
const morningFlowSource = read('./MorningFlow.jsx');
const playerSource = read('../components/InteractiveAmbientMusic.jsx');

const SURFACES = [
  { name: 'Breathe.jsx (Morning Breathing)', source: breatheSource },
  { name: 'EveningBreathing.jsx (Evening Breathing)', source: eveningBreathingSource },
];

const handleBegin = (source) => source.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
const countdownBlock = (source) => source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';

describe('1. Default music preference — On when nothing has ever been saved', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: seeds musicPreferenceOn from getMusicPreference() (defaults true for an absent key - WakeWise approved policy), never forced for a non-guest`, () => {
      expect(source).toMatch(/return musicEligible && getMusicPreference\(\);/);
    });
  }
});

describe('2. Saved Off preference is respected', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: never overrides a stored preference - musicPreferenceOn is only ever set true by seeding or the toggle, never forced`, () => {
      expect(source).not.toMatch(/setMusicPreferenceOn\(true\)/);
    });

    it(`${name}: when musicPreferenceOn is false, handleBeginBreathing never calls start(true) - no playback is initiated for a user who chose Off`, () => {
      const body = handleBegin(source);
      expect(body).toMatch(/if \(musicEligible && musicPreferenceOn\) \{\s*\n\s*musicPlayerRef\.current\?\.start\(true\);\s*\n\s*\}/);
    });
  }
});

describe('3. Playback is initiated synchronously from the real Begin gesture, not deferred', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: handleBeginBreathing calls start(true) directly — never merely preload() — before starting the countdown`, () => {
      const body = handleBegin(source);
      expect(body).toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
      expect(body).not.toMatch(/musicPlayerRef\.current\?\.preload\(\)/);
      expect(body.indexOf('musicPlayerRef.current?.start(true);')).toBeLessThan(body.indexOf('countdown.start();'));
    });
  }

  it('InteractiveAmbientMusic.start() performs the real audio.play() synchronously reachable from this call chain — never merely a network preload', () => {
    expect(playerSource).toMatch(/const start = async \(muted = false\) => \{/);
    expect(playerSource).toMatch(/await audio\.play\(\);/);
  });
});

describe('4. Countdown completion only unmutes — never issues a second, ungestured play() call', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: the countdown's onComplete calls unmute(), never start()`, () => {
      const block = countdownBlock(source);
      expect(block).toMatch(/musicPlayerRef\.current\?\.unmute\(\);/);
      expect(block).not.toMatch(/musicPlayerRef\.current\?\.start\(\);/);
      expect(block).not.toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
    });
  }

  it('unmute() itself is a plain property assignment with no play() call of its own — safe to invoke from a deferred/setInterval-derived callback', () => {
    const body = playerSource.match(/const unmute = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/audio\.muted = false;/);
    expect(body).not.toMatch(/\.play\(\)/);
  });
});

describe('5. The toggle reflects genuine playback state, never an assumed one', () => {
  it('musicEnabled is set only by the <audio> element\'s own native onPlay/onPause events (shared by both surfaces via InteractiveAmbientMusic), never assigned directly from start()/unmute()', () => {
    const setCalls = playerSource.match(/setMusicEnabledState\(/g) ?? [];
    expect(setCalls.length).toBe(2);
    const startBody = playerSource.match(/const start = async \(muted = false\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).not.toMatch(/setMusicEnabledState/);
    const unmuteBody = playerSource.match(/const unmute = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(unmuteBody).not.toMatch(/setMusicEnabledState/);
  });
});

describe('6. Turning music Off stops immediately; turning it back On resumes correctly', () => {
  it('the active-view toggle (InteractiveAmbientMusic\'s own handleToggle, shared by both surfaces) calls stop() immediately when turning off, start() when turning on', () => {
    const body = playerSource.match(/const handleToggle = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(musicEnabled\) \{\s*\n\s*setMusicPreferenceForUser\(false, \{ isGuest \}\);\s*\n\s*stop\(\);/);
    expect(body).toMatch(/\} else \{\s*\n\s*setMusicPreferenceForUser\(true, \{ isGuest \}\);\s*\n\s*start\(\);/);
  });
});

describe('7. No duplicate audio elements across the whole lifecycle', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: InteractiveAmbientMusic is mounted exactly once — one stable instance across pre-start -> active, never remounted`, () => {
      const mountCount = (source.match(/<InteractiveAmbientMusic/g) ?? []).length;
      expect(mountCount).toBe(1);
    });
  }

  it('the <audio> element inside InteractiveAmbientMusic.jsx is rendered exactly once, unconditionally', () => {
    const audioTags = playerSource.match(/<audio\s*\n\s*ref=\{audioRef\}/g) ?? [];
    expect(audioTags.length).toBe(1);
  });
});

describe('8. Pause/resume works', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: handlePauseExercise captures the real, live playback state before pausing — never assumes music was on`, () => {
      const body = source.match(/const handlePauseExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    });

    it(`${name}: handleResume only restarts music if it was genuinely playing before the pause, via a real synchronous start() call — this is its own direct click-handler gesture, no countdown gap follows it`, () => {
      const body = source.match(/const handleResume = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).toMatch(/if \(wasMusicPlayingRef\.current\) \{/);
      expect(body).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
    });
  }
});

describe('9. Back confirmation pauses and resumes correctly', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: handleBackFromActive captures live playback state before opening the confirmation dialog`, () => {
      const body = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toBe('');
      expect(body).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    });

    it(`${name}: keepBreathing resumes music via a real start() call only if it was genuinely playing before the dialog opened`, () => {
      const body = source.match(/const keepBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).toMatch(/if \(wasMusicPlayingRef\.current\) \{/);
      expect(body).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
    });
  }
});

describe('10. Completion, early exit, and unmount all stop and release audio', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: natural completion (timer reaching zero) stops music synchronously in the same callback that flips isCompleted`, () => {
      expect(source).toMatch(/stopBreathingInterval\(\);\s*\n\s*musicPlayerRef\.current\?\.stop\(\);/);
    });

    it(`${name}: leaveExercise (the one confirmed early-exit path) stops music and clears the "was playing" ref, and resets the double-tap guard`, () => {
      const body = source.match(/const leaveExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
      expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    });
  }

  it('InteractiveAmbientMusic.jsx releases the real <audio> element on unmount (covers every navigation away: Continue/Skip/Exit/Back) — shared by both surfaces', () => {
    expect(playerSource).toMatch(/audio\.pause\(\);\s*\n\s*audio\.removeAttribute\('src'\);\s*\n\s*audio\.load\(\);/);
  });
});

describe('11. A second breathing session in the same visit behaves consistently', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: a second genuine Begin tap calls the real start(true) again, exactly like the first — no special-cased "already started once" branch that would skip playback`, () => {
      const body = handleBegin(source);
      expect(body).toMatch(/if \(musicEligible && musicPreferenceOn\) \{\s*\n\s*musicPlayerRef\.current\?\.start\(true\);\s*\n\s*\}/);
    });
  }

  it('InteractiveAmbientMusic\'s own start() always re-resolves a fresh signed URL after a stop()+start() cycle (isPreloadedRef cleared before every real play()), so a second session never silently reuses a possibly-expired URL from the first', () => {
    expect(playerSource).toMatch(/isPreloadedRef\.current = false;\s*\n\s*audio\.muted = muted;/);
  });
});

describe('12. Journey routes and completion behaviour are unchanged by this fix', () => {
  it('Breathe.jsx (Morning) still advances to /morning-meditate on completion — route/navigation untouched', () => {
    expect(breatheSource).toMatch(/navigate\('\/morning-meditate'\);/);
  });

  it('EveningBreathing.jsx still advances to /evening-meditate on completion — route/navigation untouched', () => {
    expect(eveningBreathingSource).toMatch(/navigate\('\/evening-meditate'\);/);
  });

  it('both surfaces still mirror completion into the Session Engine exactly once, guarded by hasMirroredExitRef — completion-recording logic untouched by this audio fix', () => {
    for (const source of [breatheSource, eveningBreathingSource]) {
      expect(source).toMatch(/if \(hasMirroredExitRef\.current\) return;\s*\n\s*hasMirroredExitRef\.current = true;/);
    }
  });
});

describe('13. QuietBreathing.jsx (Anytime) is untouched — it already had the approved behaviour', () => {
  it('still uses the exact same start(true)/unmute() shape as before this pass, byte-for-byte in the Begin handler and countdown block', () => {
    const body = handleBegin(quietBreathingSource);
    expect(body).toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
    const block = countdownBlock(quietBreathingSource);
    expect(block).toMatch(/musicPlayerRef\.current\?\.unmute\(\);/);
  });
});

describe('14. MorningFlow.jsx (Morning Stretch) remains consistent with this same fix', () => {
  it('uses the identical start(true)/unmute() shape — see morningStretchMusicFix.test.js for its own dedicated, focused coverage', () => {
    const body = morningFlowSource.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
  });
});
