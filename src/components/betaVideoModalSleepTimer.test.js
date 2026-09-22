// Regression guard for the Sleep Soundscapes timer fix. No DOM/component
// rendering is available in this repo's Vitest (see Home.routineState.
// test.js's own note) - source-level checks, matching every other
// regression guard in this codebase for exactly that reason, plus a
// direct unit test of the one genuinely pure piece (formatRemaining is
// not exported, so its exact regex/behaviour is locked in via source
// inspection instead).
//
// Release-blocking fix: the previous 'continuous' (no auto-stop) option
// let a Sleep Soundscape play indefinitely - removed entirely, replaced
// with a fixed 10/15/30/60-minute choice (15 default), a genuine live
// countdown tied to the <video> element's own native play/pause events
// (so it freezes correctly during a real iOS interruption instead of
// continuing to count down against wall-clock time), and an 8-second
// volume fade (never touching the source asset) before the real stop.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./BetaVideoModal.jsx');

describe('Sleep Soundscapes timer options - no indefinite/continuous choice', () => {
  it('offers exactly 10/15/30/60 minutes, nothing else', () => {
    expect(source).toMatch(/const SLEEP_TIMER_MINUTES_OPTIONS = \[10, 15, 30, 60\];/);
    expect(source).not.toMatch(/'continuous'|===\s*'continuous'|sleepTimer === opt\.id/);
  });

  it('defaults to 15 minutes for both the selected duration and the initial remaining countdown', () => {
    expect(source).toMatch(/const DEFAULT_SLEEP_TIMER_MINUTES = 15;/);
    expect(source).toMatch(/const \[sleepTimerMinutes, setSleepTimerMinutes\] = useState\(DEFAULT_SLEEP_TIMER_MINUTES\);/);
    expect(source).toMatch(/const \[remainingMs, setRemainingMs\] = useState\(DEFAULT_SLEEP_TIMER_MINUTES \* 60 \* 1000\);/);
  });

  it('selecting a duration sets both the selection and a fresh full countdown, and clears any prior timerEnded state', () => {
    const body = source.match(/\{SLEEP_TIMER_MINUTES_OPTIONS\.map\(\(minutes\) => \([\s\S]*?\)\)\}/)?.[0] ?? '';
    expect(body).toMatch(/setSleepTimerMinutes\(minutes\);\s*\n\s*setRemainingMs\(minutes \* 60 \* 1000\);\s*\n\s*setTimerEnded\(false\);/);
    expect(body).toMatch(/\{minutes\} Min/);
  });
});

describe('Live countdown - tied to the <video> element\'s own native play/pause events', () => {
  it('tracks isVideoPlaying from real onPlay/onPause handlers, not an assumption', () => {
    expect(source).toMatch(/const \[isVideoPlaying, setIsVideoPlaying\] = useState\(false\);/);
    expect(source).toMatch(/onPause=\{\(\) => setIsVideoPlaying\(false\)\}/);
    expect(source).toMatch(/setIsVideoPlaying\(true\);/);
  });

  it('the countdown interval only runs while genuinely playing (isVideoPlaying), and stops decrementing at 0', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isSleepSound \|\| !hasStarted \|\| !isVideoPlaying \|\| timerEnded\) return;[\s\S]*?\n {2}\}, \[isSleepSound, hasStarted, isVideoPlaying, timerEnded\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/const next = Math\.max\(prev - 1000, 0\);/);
  });

  it('iOS-interruption fix: the countdown effect depends on isVideoPlaying, so any native pause (interruption or explicit) freezes it - it never uses a raw wall-clock setTimeout scheduled once at start', () => {
    expect(source).not.toMatch(/setTimeout\(/);
  });
});

describe('Gentle 8-second fade before stopping - never modifies the source asset', () => {
  it('fade duration is 8 seconds', () => {
    expect(source).toMatch(/const FADE_DURATION_MS = 8000;/);
  });

  it('volume is a pure function of remainingMs (no separate wall-clock fade timer, and no setState call in this effect at all), so a real pause during the fade freezes it exactly where it was', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isSleepSound \|\| !hasStarted \|\| remainingMs <= 0\) return;[\s\S]*?\n {2}\}, \[remainingMs, isSleepSound, hasStarted\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/video\.volume = remainingMs <= FADE_DURATION_MS \? Math\.max\(remainingMs \/ FADE_DURATION_MS, 0\) : 1;/);
    // deliberately no setState here (react-hooks/set-state-in-effect) -
    // the actual stop is handled inside the countdown interval's own
    // async tick instead, see the test above.
    expect(body).not.toMatch(/setTimerEnded|setRemainingMs|setRetryToken|setStatus|setHasStarted/);
  });

  it('reaching zero (inside the countdown interval\'s own tick, not a bare effect body) pauses playback, restores volume to 1 for the next play, and marks the timer ended', () => {
    const body = source.match(/if \(next <= 0\) \{[\s\S]*?setTimerEnded\(true\);\s*\n\s*\}/)?.[0] ?? '';
    expect(body).toMatch(/video\.pause\(\);/);
    expect(body).toMatch(/video\.volume = 1;/);
    expect(body).toMatch(/setTimerEnded\(true\);/);
  });

  it('never sets or reads a .src/track-swap style hack - only ever adjusts the existing element\'s own .volume, the source file itself is untouched', () => {
    const fadeSection = source.match(/\/\/ Gentle fade - volume is a pure function[\s\S]*?\}, \[remainingMs, isSleepSound, hasStarted\]\);/)?.[0] ?? '';
    expect(fadeSection).not.toBe('');
    expect(fadeSection).not.toMatch(/\.src\s*=/);
  });
});

describe('Stop - immediate, not a fade, and resets the remaining timer', () => {
  it('handleStop pauses immediately, restores volume, and resets remainingMs to the full selected duration', () => {
    const body = source.match(/const handleStop = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/video\.pause\(\);/);
    expect(body).toMatch(/video\.volume = 1;/);
    expect(body).toMatch(/setRemainingMs\(sleepTimerMinutes \* 60 \* 1000\);/);
  });

  // Found live: Stop tapped while the very first play() was still
  // resolving (readyState 0, no buffered metadata yet) threw
  // InvalidStateError from an unguarded currentTime assignment, which
  // aborted the pending play() promise and surfaced as a spurious
  // "Couldn't start playback" error despite the user only asking to Stop.
  it('only rewinds currentTime once the element actually has metadata (readyState > 0), avoiding InvalidStateError on an element with nothing buffered yet', () => {
    const body = source.match(/const handleStop = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(video\.readyState > 0\) video\.currentTime = 0;/);
  });
});

describe('Cleanup - closing, navigating away, signing out, or unmounting stops and releases the media', () => {
  it('handleClose pauses before unmounting (onClose)', () => {
    const body = source.match(/const handleClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/videoRef\.current\?\.pause\(\);/);
    expect(body).toMatch(/onClose\(\);/);
  });

  it('the existing unmount effect fully releases the element (pause, remove src, load) - untouched by this fix', () => {
    expect(source).toMatch(/video\.pause\(\);\s*\n\s*video\.removeAttribute\('src'\);\s*\n\s*video\.load\(\);/);
  });

  it('sign-out defensive guard - same pattern as InteractiveAmbientMusic.jsx: a guest transition pauses playback immediately', () => {
    expect(source).toMatch(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
    expect(source).toMatch(/const \{ isGuest \} = useAuth\(\);/);
    // Defect 2 fix (immersive fullscreen) extended this guard to also
    // exit fullscreen before pausing - see betaVideoModalFullscreen.
    // test.js for that coverage; this test only re-confirms the pause
    // itself still fires unconditionally on a guest transition.
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isGuest\) return;[\s\S]*?\n {2}\}, \[isGuest\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/video\.pause\(\);/);
  });
});

describe('Duplicate-player/timer guard - re-fetching (a genuinely different entry) resets all sleep-timer state', () => {
  it('the fetch effect resets remainingMs/sleepTimerMinutes/timerEnded/isVideoPlaying alongside hasStarted, so a stale countdown from a previous entry can never carry over', () => {
    const body = source.match(/const load = async \(\) => \{[\s\S]*?try \{/)?.[0] ?? '';
    expect(body).toMatch(/setRemainingMs\(DEFAULT_SLEEP_TIMER_MINUTES \* 60 \* 1000\);/);
    expect(body).toMatch(/setSleepTimerMinutes\(DEFAULT_SLEEP_TIMER_MINUTES\);/);
    expect(body).toMatch(/setTimerEnded\(false\);/);
    expect(body).toMatch(/setIsVideoPlaying\(false\);/);
  });
});

describe('"Play again" after the timer ends starts a genuinely fresh countdown, never continuing from zero', () => {
  it('onPlay resets remainingMs to the full selected duration specifically when resuming from timerEnded', () => {
    const body = source.match(/onPlay=\{\(\) => \{[\s\S]*?\n {16}\}\}/)?.[0] ?? '';
    expect(body).toMatch(/if \(timerEnded\) setRemainingMs\(sleepTimerMinutes \* 60 \* 1000\);/);
  });
});

describe('Remaining time is displayed clearly while playing', () => {
  it('renders a live "M:SS remaining" line, gated on hasStarted && !timerEnded, with aria-live for accessibility', () => {
    expect(source).toMatch(/\{hasStarted && !timerEnded && \(\s*\n\s*<p className="[^"]*" aria-live="polite">\s*\n\s*\{formatRemaining\(remainingMs\)\} remaining/);
  });

  it('formatRemaining computes M:SS with zero-padded seconds from milliseconds', () => {
    const body = source.match(/const formatRemaining = \(ms\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(body).toMatch(/const totalSeconds = Math\.max\(Math\.ceil\(ms \/ 1000\), 0\);/);
    expect(body).toMatch(/const minutes = Math\.floor\(totalSeconds \/ 60\);/);
    expect(body).toMatch(/const seconds = totalSeconds % 60;/);
    expect(body).toMatch(/return `\$\{minutes\}:\$\{String\(seconds\)\.padStart\(2, '0'\)\}`;/);
  });
});

describe('Updated copy - "loops until the timer ends" replaces "loops automatically"', () => {
  it('both the known-duration and unknown-duration source-line variants use the clearer wording', () => {
    expect(source).not.toMatch(/loops automatically/);
    expect(source).toMatch(/loops until the timer ends/);
    expect(source).toMatch(/'Loops until the timer ends\.'/);
  });
});
