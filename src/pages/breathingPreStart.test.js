// Build 15 — Breathing pre-start screens (Morning Breathe, Evening
// Breathing) and the shared breathing-pattern configuration. Standalone
// Breathe (QuietBreathing.jsx) is covered separately once that subphase
// lands. No DOM rendering available in this repo's Vitest - real
// execution for the pure/importable pieces (BREATHING_PATTERNS,
// resolveBreathPhase, getBreathingPatternById), source-level checks for
// everything else, matching this codebase's own established precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const breatheSource = read('./Breathe.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');

// ---------------------------------------------------------------------
// Shared config - real execution.
// ---------------------------------------------------------------------
describe('BREATHING_PATTERNS - exactly the three real, already-shipped cadences', () => {
  it('contains exactly 3 patterns with the real ids/labels/totals', () => {
    expect(BREATHING_PATTERNS).toHaveLength(3);
    expect(BREATHING_PATTERNS.map((p) => p.id)).toEqual(['morning', 'evening', 'quiet']);
    expect(BREATHING_PATTERNS.map((p) => p.label)).toEqual(['4-4-6 Breathing', '4-7-8 Breathing', '4-4-8 Breathing']);
    expect(BREATHING_PATTERNS.map((p) => p.totalSeconds)).toEqual([56, 76, 64]);
  });

  it('computed totals match cycleSeconds * totalCycles for every pattern - the totals were not hand-typed independently of the cadence', () => {
    for (const pattern of BREATHING_PATTERNS) {
      expect(pattern.cycleSeconds * pattern.totalCycles).toBe(pattern.totalSeconds);
      expect(pattern.inhaleSeconds + pattern.holdSeconds + pattern.exhaleSeconds).toBe(pattern.cycleSeconds);
    }
  });

  it('only the morning pattern carries a supportingLabel ("Deep Belly Breath") - it is never applied to a pattern it wasn\'t written for', () => {
    expect(getBreathingPatternById('morning').supportingLabel).toBe('Deep Belly Breath');
    expect(getBreathingPatternById('evening').supportingLabel).toBeNull();
    expect(getBreathingPatternById('quiet').supportingLabel).toBeNull();
  });

  it('getBreathingPatternById returns null for an unknown id, never throws, never fabricates a pattern', () => {
    expect(getBreathingPatternById('nonexistent')).toBeNull();
  });
});

describe('resolveBreathPhase - real execution, reproduces each screen\'s own original cutoffs exactly', () => {
  const morning = getBreathingPatternById('morning');
  const evening = getBreathingPatternById('evening');
  const quiet = getBreathingPatternById('quiet');

  it('4-4-6 (Morning): inhale 0-3, hold 4-7, exhale 8-13 within each 14s cycle', () => {
    expect(resolveBreathPhase(morning, 56)).toBe('Inhale'); // cycleTime 0
    expect(resolveBreathPhase(morning, 53)).toBe('Inhale'); // cycleTime 3
    expect(resolveBreathPhase(morning, 52)).toBe('Hold'); // cycleTime 4
    expect(resolveBreathPhase(morning, 49)).toBe('Hold'); // cycleTime 7
    expect(resolveBreathPhase(morning, 48)).toBe('Exhale'); // cycleTime 8
    expect(resolveBreathPhase(morning, 43)).toBe('Exhale'); // cycleTime 13
  });

  it('4-7-8 (Evening): inhale 0-3, hold 4-10, exhale 11-18 within each 19s cycle', () => {
    expect(resolveBreathPhase(evening, 76)).toBe('Inhale'); // cycleTime 0
    expect(resolveBreathPhase(evening, 73)).toBe('Inhale'); // cycleTime 3
    expect(resolveBreathPhase(evening, 72)).toBe('Hold'); // cycleTime 4
    expect(resolveBreathPhase(evening, 66)).toBe('Hold'); // cycleTime 10
    expect(resolveBreathPhase(evening, 65)).toBe('Exhale'); // cycleTime 11
    expect(resolveBreathPhase(evening, 58)).toBe('Exhale'); // cycleTime 18
  });

  it('4-4-8 (Quiet): inhale 0-3, hold 4-7, exhale 8-15 within each 16s cycle', () => {
    expect(resolveBreathPhase(quiet, 64)).toBe('Inhale'); // cycleTime 0
    expect(resolveBreathPhase(quiet, 61)).toBe('Inhale'); // cycleTime 3
    expect(resolveBreathPhase(quiet, 60)).toBe('Hold'); // cycleTime 4
    expect(resolveBreathPhase(quiet, 57)).toBe('Hold'); // cycleTime 7
    expect(resolveBreathPhase(quiet, 56)).toBe('Exhale'); // cycleTime 8
    expect(resolveBreathPhase(quiet, 49)).toBe('Exhale'); // cycleTime 15
  });

  it('cycles correctly: the phase pattern repeats identically in the second cycle as the first', () => {
    // Morning's 2nd cycle starts at secondsLeft = 56 - 14 = 42
    expect(resolveBreathPhase(morning, 42)).toBe('Inhale');
    expect(resolveBreathPhase(morning, 38)).toBe('Hold');
    expect(resolveBreathPhase(morning, 34)).toBe('Exhale');
  });
});

// ---------------------------------------------------------------------
// 15, 16. Morning Breathe - real choices shown before Start, correct
// single-selection (radio) semantics.
// ---------------------------------------------------------------------
describe('Breathe.jsx - real pattern choices before Start, single-select radio semantics', () => {
  it('imports the shared BREATHING_PATTERNS/BreathingPatternRow, never a second, hand-typed pattern list', () => {
    expect(breatheSource).toMatch(/import \{ BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase \} from '\.\.\/lib\/breathingPatterns';/);
    expect(breatheSource).toMatch(/\{BREATHING_PATTERNS\.map\(\(pattern\) => \(/);
  });

  it('renders inside role="radiogroup", one BreathingPatternRow per real pattern, single groupName so only one can be checked at a time', () => {
    expect(breatheSource).toMatch(/role="radiogroup" aria-label="Choose your breathing practice"/);
    expect(breatheSource).toMatch(/groupName="breathing-pattern"/);
  });

  it('defaults to the real Morning 4-4-6 pattern ("morning")', () => {
    expect(breatheSource).toMatch(/const DEFAULT_PATTERN_ID = 'morning';/);
    expect(breatheSource).toMatch(/const \[selectedPatternId, setSelectedPatternId\] = useState\(\(\) => pausedSnapshot\?\.patternId \?\? DEFAULT_PATTERN_ID\);/);
  });

  it('never fabricates a pattern name - BreathingPatternRow itself only ever renders pattern.label, sourced from the shared config', () => {
    const rowSource = read('../components/BreathingPatternRow.jsx');
    expect(rowSource).toMatch(/\{pattern\.label\}/);
    expect(rowSource).not.toMatch(/4-4-6 Breathing|4-7-8 Breathing|4-4-8 Breathing/); // no hard-coded label duplicated locally
  });
});

// ---------------------------------------------------------------------
// 17, 18, 19. Nothing starts on mount; Begin synchronises timer+phase+
// music; music can stop without resetting the exercise.
// ---------------------------------------------------------------------
describe('Breathe.jsx - nothing starts on mount, Begin synchronises everything', () => {
  it('hasBegun defaults to false (true only when resuming a paused snapshot) and gates the countdown effect entirely', () => {
    expect(breatheSource).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => Boolean\(pausedSnapshot\)\);/);
    expect(breatheSource).toMatch(/if \(!hasBegun \|\| isInterrupted \|\| isRepeatGated \|\| isConfirming\) return;/);
  });

  it('InteractiveAmbientMusic is mounted pre-start with hideToggle, and nothing calls .start() outside handleBeginBreathing/handleResumeWithMusic', () => {
    expect(breatheSource).toMatch(/<InteractiveAmbientMusic ref=\{musicPlayerRef\} musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} suspended=\{false\} hideToggle \/>/);
    const startCalls = breatheSource.match(/musicPlayerRef\.current\?\.start\(\);/g) ?? [];
    expect(startCalls.length).toBe(2);
  });

  it('handleBeginBreathing resets secondsLeft/breatheState, sets hasBegun, and starts music only if eligible+preferred+not-guest - all inside one handler, guarded against double taps', () => {
    const body = breatheSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasBegunOnceRef\.current\) return;/);
    expect(body).toMatch(/hasBegunOnceRef\.current = true;/);
    expect(body).toMatch(/setSecondsLeft\(activePattern\.totalSeconds\);/);
    expect(body).toMatch(/setBreatheState\('Inhale'\);/);
    expect(body).toMatch(/setHasBegun\(true\);/);
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn && !isGuest\) \{/);
  });

  it('the active countdown effect drives breatheState from the selected pattern via the shared resolveBreathPhase - never a second, hand-rolled modulo', () => {
    expect(breatheSource).toMatch(/setBreatheState\(resolveBreathPhase\(activePattern, nextSec\)\);/);
    expect(breatheSource).not.toMatch(/cycleTime/);
  });

  it('toggling the music preference switch never itself starts playback or resets the countdown - it only records intent', () => {
    const body = breatheSource.match(/const handleToggleMusicPreference = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/musicPlayerRef|setSecondsLeft|setBreatheState/);
  });
});

// ---------------------------------------------------------------------
// 21, 25, 26. Morning breathing advances only Morning; leaving stops
// timers/audio; completion remains idempotent.
// ---------------------------------------------------------------------
describe('Breathe.jsx - Session Engine boundary unchanged (Morning-only advancement, idempotent)', () => {
  it('advanceStep fires at most once, guarded by hasMirroredExitRef, only for morning-routine/breathe', () => {
    const advanceCalls = breatheSource.match(/\badvanceStep\(\);/g) ?? [];
    expect(advanceCalls.length).toBe(1);
    expect(breatheSource).toMatch(/if \(hasMirroredExitRef\.current\) return;\s*\n\s*hasMirroredExitRef\.current = true;\s*\n\s*if \(state\.status === 'playing' && currentStep\?\.id === 'breathe'\) \{/);
  });

  it('never references evening-wind-down or an Evening step id', () => {
    expect(breatheSource).not.toMatch(/evening-wind-down|'breathing'/);
  });
});

// ---------------------------------------------------------------------
// Evening Breathing - fixed pattern (no selector), pre-start preview,
// Begin gesture, unchanged fixed 4-7-8 cadence.
// ---------------------------------------------------------------------
describe('EveningBreathing.jsx - fixed 4-7-8 pattern, no selector, but the same pre-start Begin discipline', () => {
  it('uses the shared pattern config for its one fixed pattern - never a second hand-typed 4-7-8 definition', () => {
    expect(eveningBreathingSource).toMatch(/import \{ getBreathingPatternById, resolveBreathPhase \} from '\.\.\/lib\/breathingPatterns';/);
    expect(eveningBreathingSource).toMatch(/const PATTERN = getBreathingPatternById\('evening'\);/);
  });

  it('does not render BreathingPatternRow or any radiogroup - the pattern is a fixed preview, never a fabricated choice', () => {
    expect(eveningBreathingSource).not.toMatch(/BreathingPatternRow|radiogroup/);
  });

  it('shows the real cadence and real total duration in the pre-start preview', () => {
    expect(eveningBreathingSource).toMatch(/\{PATTERN\.label\}/);
    expect(eveningBreathingSource).toMatch(/Inhale \{PATTERN\.inhaleSeconds\}s · Hold \{PATTERN\.holdSeconds\}s · Exhale \{PATTERN\.exhaleSeconds\}s/);
    expect(eveningBreathingSource).toMatch(/\{formatTotalDuration\(PATTERN\.totalSeconds\)\}/);
  });

  it('nothing starts on mount - hasBegun defaults to false (true only when resuming a paused snapshot), gating the countdown entirely', () => {
    expect(eveningBreathingSource).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => Boolean\(pausedSnapshot\)\);/);
    expect(eveningBreathingSource).toMatch(/if \(!hasBegun \|\| manuallyPaused \|\| isRepeatGated \|\| isConfirming\) return;/);
  });

  it('InteractiveAmbientMusic is mounted pre-start with hideToggle, and Begin is the only place (besides Resume with Music) that starts it', () => {
    expect(eveningBreathingSource).toMatch(/<InteractiveAmbientMusic ref=\{musicPlayerRef\} musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} suspended=\{false\} hideToggle \/>/);
    const startCalls = eveningBreathingSource.match(/musicPlayerRef\.current\?\.start\(\);/g) ?? [];
    expect(startCalls.length).toBe(2);
  });

  it('Begin Breathing resets the countdown to the fixed pattern\'s total, sets hasBegun, guards against double taps, and starts music only if eligible+preferred+not-guest', () => {
    const body = eveningBreathingSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasBegunOnceRef\.current\) return;/);
    expect(body).toMatch(/setSecondsLeft\(PATTERN\.totalSeconds\);/);
    expect(body).toMatch(/setHasBegun\(true\);/);
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn && !isGuest\) \{/);
  });

  it('uses the shared resolveBreathPhase for its own countdown - never a hand-rolled modulo', () => {
    expect(eveningBreathingSource).toMatch(/setBreatheState\(resolveBreathPhase\(PATTERN, nextSec\)\);/);
    expect(eveningBreathingSource).not.toMatch(/cycleTime/);
  });

  it('advanceStep fires at most once, guarded, only for evening-wind-down/breathing - never touches Morning', () => {
    const advanceCalls = eveningBreathingSource.match(/\badvanceStep\(\);/g) ?? [];
    expect(advanceCalls.length).toBe(1);
    expect(eveningBreathingSource).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'breathing'\) \{/);
    expect(eveningBreathingSource).not.toMatch(/morning-routine/);
  });

  it('Prepare for Rest/Reflection/Gratitude/Review/Edit/Redo are untouched - the only exercise-advancement target is /prepare-for-rest (the pre-existing /auth sign-in redirect for guest music is unrelated and unchanged)', () => {
    const navigateTargets = [...eveningBreathingSource.matchAll(/navigate\('([^']+)'\)/g)].map((m) => m[1]);
    expect(new Set(navigateTargets)).toEqual(new Set(['/prepare-for-rest', '/auth']));
  });
});

// ---------------------------------------------------------------------
// Regression: both files never leave a duplicate InteractiveAmbientMusic
// call site, and pause/resume state (secondsLeft/breatheState) is never
// touched by handleResumeExercise - matching the existing, unchanged
// guided-video pause architecture (already covered in full by
// interactiveAmbientMusic.test.js - not duplicated here).
// ---------------------------------------------------------------------
describe('Regression - guided-video/pause architecture unchanged in Breathe.jsx', () => {
  it('videoOpenedDuringExercise/manuallyPaused/isInterrupted are still present and unchanged in shape', () => {
    expect(breatheSource).toMatch(/const isInterrupted = videoOpenedDuringExercise \|\| manuallyPaused;/);
  });
});
