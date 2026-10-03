// WakeWise DEV — Morning Stretch silent-music fix, focused coverage.
//
// Root cause (traced live on a physical iPhone): handleBeginStretching
// used to call only preload() (a network fetch, never touching playback)
// and defer the real, audible start() call to usePreparationCountdown's
// own onComplete - which fires from a setInterval tick + effect, 5 real
// seconds after the Begin tap, not a synchronous continuation of it.
// iOS/WKWebView's gesture-before-unmuted-playback rule does not survive
// that gap, so audio.play() was silently rejected - the toggle still
// rendered checked (musicPreferenceOn stayed true), but no sound ever
// played and InteractiveAmbientMusic's own musicEnabled (driven only by a
// genuine native `play` event) never actually flipped true either, since
// that event never fired.
//
// Fix (identical, already-approved shape to QuietBreathing.jsx's own
// Anytime Breathing silent-music fix - see InteractiveAmbientMusic.jsx's
// own start()/unmute() doc comment for the full root-cause trace):
// handleBeginStretching now calls the real, gesture-linked start(true)
// (muted) synchronously within the actual tap; the countdown's own
// onComplete then just unmute()s - a plain property set, no gesture
// requirement of its own, safe to call from that deferred callback.
//
// No DOM/component rendering is available in this repo's Vitest
// (environment: 'node' - see vite.config.js), matching every other
// regression guard for InteractiveAmbientMusic/MorningFlow/Breathe/
// QuietBreathing/EveningBreathing - source-level checks throughout.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8').replace(/\r\n/g, '\n');

const morningFlowSource = read('./MorningFlow.jsx');
const anytimeResetSource = read('./AnytimeReset.jsx');
const quietBreathingSource = read('./QuietBreathing.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');
const eveningWindDownSource = read('./EveningWindDown.jsx');
const playerSource = read('../components/InteractiveAmbientMusic.jsx');

const handleBegin = () => morningFlowSource.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
const countdownBlock = () => morningFlowSource.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';

describe('1. Default music preference — On when nothing has ever been saved', () => {
  it('musicPreference.js defaults to true for an absent/unset key (WakeWise approved policy) — MorningFlow seeds musicPreferenceOn from this exact function for a non-guest', () => {
    const musicPreferenceLibSource = read('../lib/musicPreference.js');
    expect(musicPreferenceLibSource).toMatch(/if \(stored === null\) return true;/);
    expect(morningFlowSource).toMatch(/return musicEligible && getMusicPreference\(\);/);
  });
});

describe('2. Saved Off preference is respected', () => {
  it('a stored "false" is never overridden — getMusicPreference() returns exactly what was saved, and MorningFlow never forces it true', () => {
    const musicPreferenceLibSource = read('../lib/musicPreference.js');
    expect(musicPreferenceLibSource).toMatch(/return stored === 'true';/);
    expect(morningFlowSource).not.toMatch(/setMusicPreferenceOn\(true\)/);
  });

  it('when musicPreferenceOn is false, handleBeginStretching never calls start(true) — no playback is initiated at all for a user who chose Off', () => {
    const body = handleBegin();
    const musicBlock = body.match(/if \(musicEligible && musicPreferenceOn\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(musicBlock).toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
    // The call is genuinely gated on musicPreferenceOn - not issued unconditionally.
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn\) \{/);
  });
});

describe('3. Playback is initiated synchronously from the real Begin gesture, not deferred', () => {
  it('handleBeginStretching calls start(true) directly in its own body — never merely preload() — before starting the countdown', () => {
    const body = handleBegin();
    expect(body).toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
    expect(body).not.toMatch(/musicPlayerRef\.current\?\.preload\(\)/);
    // start(true) happens before countdown.start() in source order, i.e.
    // within the same synchronous call, not after some later async gap.
    expect(body.indexOf('musicPlayerRef.current?.start(true);')).toBeLessThan(body.indexOf('countdown.start();'));
  });

  it('InteractiveAmbientMusic.start() performs the real audio.play() synchronously reachable from this call chain — never merely a network preload', () => {
    expect(playerSource).toMatch(/const start = async \(muted = false\) => \{/);
    expect(playerSource).toMatch(/await audio\.play\(\);/);
  });
});

describe('4. Countdown completion only unmutes — never issues a second, ungestured play() call', () => {
  it('the countdown\'s onComplete calls unmute(), never start()', () => {
    const block = countdownBlock();
    expect(block).toMatch(/musicPlayerRef\.current\?\.unmute\(\);/);
    expect(block).not.toMatch(/musicPlayerRef\.current\?\.start\(\);/);
    expect(block).not.toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
  });

  it('unmute() itself is a plain property assignment with no play() call of its own — safe to invoke from a deferred/setInterval-derived callback', () => {
    const body = playerSource.match(/const unmute = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/audio\.muted = false;/);
    expect(body).not.toMatch(/\.play\(\)/);
  });
});

describe('5. The toggle reflects genuine playback state, never an assumed one', () => {
  it('musicEnabled (the value the toggle renders as isChecked) is set only by the <audio> element\'s own native onPlay/onPause events, never assigned directly from start()/unmute()', () => {
    const setCalls = playerSource.match(/setMusicEnabledState\(/g) ?? [];
    expect(setCalls.length).toBe(2);
    expect(playerSource).toMatch(/onPlay=\{\(\) => \{\s*\n\s*setMusicEnabledState\(true\);/);
    expect(playerSource).toMatch(/onPause=\{\(\) => setMusicEnabledState\(false\)\}/);
    const startBody = playerSource.match(/const start = async \(muted = false\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).not.toMatch(/setMusicEnabledState/);
    const unmuteBody = playerSource.match(/const unmute = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(unmuteBody).not.toMatch(/setMusicEnabledState/);
  });

  it('a muted play() still fires the real native `play` event — isChecked becomes true the instant genuine playback begins, even while inaudible during the countdown, never lying about "on" with nothing actually playing', () => {
    // The <audio> element's onPlay fires for ANY successful play() call,
    // muted or not - there is no separate "muted play" event, so a
    // start(true) that succeeds already flips musicEnabled true (the
    // element genuinely IS playing, just silently) before unmute()
    // reveals it - never a fabricated "on" state with no real playback.
    // First-use silent-music fix — `audio.muted` is now set from
    // `unmuteRequestedRef.current ? false : muted` rather than the bare
    // `muted` argument, so an unmute() that already arrived while this
    // call's own signed-URL fetch was still in flight (a slow/cold first
    // request) correctly wins instead of being silently overwritten back
    // to muted the moment this line finally runs - see
    // InteractiveAmbientMusic.jsx's own unmuteRequestedRef doc comment for
    // the full root-cause trace. The underlying contract this test name
    // describes (a muted play() still fires the real native `play` event)
    // is completely unaffected by this - `muted` is still exactly what
    // reaches `audio.muted` on the normal, fast-network path.
    expect(playerSource).toMatch(/audio\.muted = unmuteRequestedRef\.current \? false : muted;/);
    expect(playerSource).toMatch(/await audio\.play\(\);/);
  });
});

describe('6. Turning music Off stops immediately; turning it back On resumes correctly', () => {
  it('the active-view toggle (InteractiveAmbientMusic\'s own handleToggle, shared by every surface including MorningFlow) calls stop() immediately when turning off, start() when turning on', () => {
    const body = playerSource.match(/const handleToggle = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(musicEnabled\) \{\s*\n\s*setMusicPreferenceForUser\(false, \{ isGuest \}\);\s*\n\s*stop\(\);/);
    expect(body).toMatch(/\} else \{\s*\n\s*setMusicPreferenceForUser\(true, \{ isGuest \}\);\s*\n\s*start\(\);/);
  });

  it('stop() is a plain pause() — the real onPause native event is what actually flips the toggle off, never an assumed state', () => {
    const body = morningFlowSource.includes('const stop = ()') ? '' : playerSource.match(/const stop = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/audioRef\.current\?\.pause\(\);/);
  });
});

describe('7. Movement transitions never create duplicate audio elements or restart music unexpectedly', () => {
  it('InteractiveAmbientMusic is mounted exactly once in MorningFlow.jsx — one stable instance across the whole pre-start -> active -> movement-transition lifecycle, never remounted', () => {
    const mountCount = (morningFlowSource.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
  });

  it('handleNextStep (the manual "Next Movement"/"Continue" tap that transitions between movements) never touches musicPlayerRef at all — no start/stop/preload/unmute call', () => {
    const body = morningFlowSource.match(/const handleNextStep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    // The only music-adjacent call inside handleNextStep is the
    // completion-triggered stop() (natural end of the whole sequence),
    // never a start()/restart tied to an ordinary movement transition.
    const nonCompletionPath = body.split('if (completed)')[0];
    expect(nonCompletionPath).not.toMatch(/musicPlayerRef/);
  });

  it('the <audio> element inside InteractiveAmbientMusic.jsx is rendered exactly once, unconditionally - its identity never changes across a movement transition', () => {
    const audioTags = playerSource.match(/<audio\s*\n\s*ref=\{audioRef\}/g) ?? [];
    expect(audioTags.length).toBe(1);
  });
});

describe('8. Pause/resume via "Pause Exercise" / "Resume Exercise" (ExercisePausedPanel)', () => {
  it('handlePauseExercise captures the real, live playback state (isPlaying()) before pausing — never assumes music was on', () => {
    const body = morningFlowSource.match(/const handlePauseExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
  });

  it('handleResume only restarts music if it was genuinely playing before the pause, via a real synchronous start() call from this click handler (not start(true) - this is its own direct gesture, no countdown gap follows it)', () => {
    const body = morningFlowSource.match(/const handleResume = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(wasMusicPlayingRef\.current\) \{/);
    expect(body).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
  });
});

describe('9. Back confirmation pauses and resumes correctly', () => {
  it('handleBackFromActive captures live playback state before opening the confirmation dialog; suspended prop pauses while it is open', () => {
    const body = morningFlowSource.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    expect(morningFlowSource).toMatch(/suspended=\{hasBegun \? \(isCompleted \|\| Boolean\(openVideo\) \|\| manuallyPaused \|\| backConfirmOpen\) : false\}/);
  });

  it('keepStretching resumes music via a real start() call only if it was genuinely playing before the dialog opened', () => {
    const body = morningFlowSource.match(/const keepStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(wasMusicPlayingRef\.current\) \{/);
    expect(body).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
  });
});

describe('10. Completion, early-exit, and unmount all stop and release audio', () => {
  it('natural completion (timer reaching zero) stops music synchronously in the same callback that flips isCompleted', () => {
    expect(morningFlowSource).toMatch(/stopStretchInterval\(\);\s*\n\s*musicPlayerRef\.current\?\.stop\(\);\s*\n\s*setCompletionGreeting\(getCompletionGreeting\(\{ journey: 'morning', practice: 'stretching' \}\)\);\s*\n\s*setIsCompleted\(true\);/);
  });

  it('manual completion (handleNextStep reaching the final movement) also stops music the same way', () => {
    const body = morningFlowSource.match(/const handleNextStep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
  });

  it('leaveStretch (the one confirmed early-exit path) stops music and clears the "was playing" ref', () => {
    const body = morningFlowSource.match(/const leaveStretch = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(body).toMatch(/wasMusicPlayingRef\.current = false;/);
  });

  it('InteractiveAmbientMusic.jsx releases the real <audio> element on unmount (covers every navigation away from this screen: Continue/Skip/Exit/Back)', () => {
    expect(playerSource).toMatch(/audio\.pause\(\);\s*\n\s*audio\.removeAttribute\('src'\);\s*\n\s*audio\.load\(\);/);
  });
});

describe('11. A second Morning Stretch session in the same visit behaves consistently', () => {
  it('hasBegunOnceRef is reset to false on early exit (leaveStretch) so a subsequent Begin tap is not silently swallowed by the double-tap guard', () => {
    const body = morningFlowSource.match(/const leaveStretch = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
  });

  it('a second genuine Begin tap calls the real start(true) again, exactly like the first - no special-cased "already started once" branch that would skip playback', () => {
    // handleBeginStretching's own music-start branch is unconditional on
    // eligibility/preference, never on whether this is the first or a
    // later call within the same mount - hasBegunOnceRef only guards
    // against a rapid double-tap of the SAME gesture, not a second
    // deliberate run.
    const body = handleBegin();
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn\) \{\s*\n\s*musicPlayerRef\.current\?\.start\(true\);\s*\n\s*\}/);
  });

  it('InteractiveAmbientMusic\'s own start() always re-resolves a fresh signed URL after a stop()+start() cycle (isPreloadedRef is cleared before every real play()), so a second session never silently reuses a possibly-expired URL from the first', () => {
    // First-use silent-music fix — tolerant of the race-condition doc
    // comment/unmuteRequestedRef check now between these two lines; the
    // real property under test (isPreloadedRef cleared BEFORE the real
    // audio.muted assignment, every single start() call) is unchanged.
    expect(playerSource).toMatch(/isPreloadedRef\.current = false;[\s\S]*?audio\.muted = unmuteRequestedRef\.current \? false : muted;/);
  });
});

describe('12. Anytime is completely unchanged by this fix; journey routes/independent surfaces untouched', () => {
  // WakeWise DEV — iOS audio-start correction, applied consistently:
  // EveningBreathing.jsx (and Breathe.jsx) were found to have the
  // identical structurally-unsafe pattern and were ALSO corrected in a
  // follow-up pass - see breathingMusicFix.test.js for their own dedicated
  // coverage. Only QuietBreathing.jsx (Anytime) was explicitly excluded
  // from that follow-up, per the approved brief ("Do not change
  // QuietBreathing.jsx; it already has the approved behavior").
  it('QuietBreathing.jsx (Anytime) already used the correct start(true)/unmute() shape before this fix, and remains byte-for-byte the same pattern - untouched by either pass', () => {
    const body = quietBreathingSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
    const block = quietBreathingSource.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(block).toMatch(/musicPlayerRef\.current\?\.unmute\(\);/);
  });

  it('EveningBreathing.jsx now also uses the real start(true)/unmute() shape - see breathingMusicFix.test.js for the full, dedicated coverage of this follow-up correction', () => {
    const body = eveningBreathingSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicPlayerRef\.current\?\.start\(true\);/);
    expect(body).not.toMatch(/musicPlayerRef\.current\?\.preload\(\)/);
  });

  it('EveningWindDown.jsx and AnytimeReset.jsx do not reference MorningFlow.jsx\'s music handlers at all - fully independent surfaces', () => {
    expect(eveningWindDownSource).not.toMatch(/handleBeginStretching|createStretchSession/);
    expect(anytimeResetSource).not.toMatch(/handleBeginStretching|createStretchSession/);
  });

  it('InteractiveAmbientMusic.jsx itself (the shared component every surface uses) was never modified by any of these fixes - start()/unmute()/preload() already supported the muted-start pattern before this pass (proven by QuietBreathing.jsx already using it); only WHICH functions each page calls, and when, ever changed', () => {
    expect(playerSource).toMatch(/const start = async \(muted = false\) => \{/);
    expect(playerSource).toMatch(/const unmute = \(\) => \{/);
    expect(playerSource).toMatch(/const preload = \(\) => \{/);
  });
});
