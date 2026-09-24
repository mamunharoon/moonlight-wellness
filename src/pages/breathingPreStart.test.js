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
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase, formatCadence } from '../lib/breathingPatterns';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const breatheSource = read('./Breathe.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');

// ---------------------------------------------------------------------
// Shared config - real execution.
// ---------------------------------------------------------------------
describe('BREATHING_PATTERNS - exactly the five real, approved cadences (Build 15 Box/Coherent addition)', () => {
  it('contains exactly 5 patterns with the real ids/labels/totals, in the approved picker order', () => {
    expect(BREATHING_PATTERNS).toHaveLength(5);
    expect(BREATHING_PATTERNS.map((p) => p.id)).toEqual(['morning', 'evening', 'quiet', 'box', 'coherent']);
    expect(BREATHING_PATTERNS.map((p) => p.label)).toEqual([
      '4-4-6 Breathing',
      '4-7-8 Breathing',
      '4-4-8 Breathing',
      'Box Breathing',
      'Coherent Breathing'
    ]);
    expect(BREATHING_PATTERNS.map((p) => p.totalSeconds)).toEqual([56, 76, 64, 64, 60]);
  });

  // The original three patterns' own numbers are unchanged by this
  // addition - re-asserted explicitly, not just implied by the array
  // above, per the approved "byte-equivalent" requirement.
  it('the original three patterns retain their exact original cadence/timing, untouched by this addition', () => {
    const morning = getBreathingPatternById('morning');
    const evening = getBreathingPatternById('evening');
    const quiet = getBreathingPatternById('quiet');
    expect(morning).toMatchObject({ inhaleSeconds: 4, holdSeconds: 4, exhaleSeconds: 6, cycleSeconds: 14, totalCycles: 4, totalSeconds: 56 });
    expect(evening).toMatchObject({ inhaleSeconds: 4, holdSeconds: 7, exhaleSeconds: 8, cycleSeconds: 19, totalCycles: 4, totalSeconds: 76 });
    expect(quiet).toMatchObject({ inhaleSeconds: 4, holdSeconds: 4, exhaleSeconds: 8, cycleSeconds: 16, totalCycles: 4, totalSeconds: 64 });
  });

  it('Box Breathing: 4-4-4-4, 4 cycles, 64s total - the approved configuration exactly', () => {
    const box = getBreathingPatternById('box');
    expect(box).toMatchObject({
      inhaleSeconds: 4,
      holdSeconds: 4,
      exhaleSeconds: 4,
      holdAfterExhaleSeconds: 4,
      cycleSeconds: 16,
      totalCycles: 4,
      totalSeconds: 64
    });
  });

  it('Coherent Breathing: 5-5 with no hold at all, 6 cycles, 60s total - the approved configuration exactly', () => {
    const coherent = getBreathingPatternById('coherent');
    expect(coherent).toMatchObject({
      inhaleSeconds: 5,
      holdSeconds: 0,
      exhaleSeconds: 5,
      holdAfterExhaleSeconds: 0,
      cycleSeconds: 10,
      totalCycles: 6,
      totalSeconds: 60
    });
  });

  it('computed totals match cycleSeconds * totalCycles for every pattern, and every phase (including the new holdAfterExhaleSeconds) sums to exactly cycleSeconds - the totals were not hand-typed independently of the cadence', () => {
    for (const pattern of BREATHING_PATTERNS) {
      expect(pattern.cycleSeconds * pattern.totalCycles).toBe(pattern.totalSeconds);
      expect(pattern.inhaleSeconds + pattern.holdSeconds + pattern.exhaleSeconds + pattern.holdAfterExhaleSeconds).toBe(pattern.cycleSeconds);
    }
  });

  it('holdAfterExhaleSeconds is explicit (never undefined) on every pattern - 0 for every pattern except Box', () => {
    for (const pattern of BREATHING_PATTERNS) {
      expect(typeof pattern.holdAfterExhaleSeconds).toBe('number');
    }
    expect(getBreathingPatternById('box').holdAfterExhaleSeconds).toBe(4);
    for (const id of ['morning', 'evening', 'quiet', 'coherent']) {
      expect(getBreathingPatternById(id).holdAfterExhaleSeconds).toBe(0);
    }
  });

  it('only the morning pattern carries a supportingLabel ("Deep Belly Breath") - it is never applied to a pattern it wasn\'t written for, including the two new ones', () => {
    expect(getBreathingPatternById('morning').supportingLabel).toBe('Deep Belly Breath');
    expect(getBreathingPatternById('evening').supportingLabel).toBeNull();
    expect(getBreathingPatternById('quiet').supportingLabel).toBeNull();
    expect(getBreathingPatternById('box').supportingLabel).toBeNull();
    expect(getBreathingPatternById('coherent').supportingLabel).toBeNull();
  });

  it('getBreathingPatternById returns null for an unknown id, never throws, never fabricates a pattern', () => {
    expect(getBreathingPatternById('nonexistent')).toBeNull();
  });
});

describe('resolveBreathPhase - real execution, reproduces each screen\'s own original cutoffs exactly, plus the two new patterns', () => {
  const morning = getBreathingPatternById('morning');
  const evening = getBreathingPatternById('evening');
  const quiet = getBreathingPatternById('quiet');
  const box = getBreathingPatternById('box');
  const coherent = getBreathingPatternById('coherent');

  it('4-4-6 (Morning): inhale 0-3, hold 4-7, exhale 8-13 within each 14s cycle - byte-identical to before this addition', () => {
    expect(resolveBreathPhase(morning, 56)).toBe('Inhale'); // cycleTime 0
    expect(resolveBreathPhase(morning, 53)).toBe('Inhale'); // cycleTime 3
    expect(resolveBreathPhase(morning, 52)).toBe('Hold'); // cycleTime 4
    expect(resolveBreathPhase(morning, 49)).toBe('Hold'); // cycleTime 7
    expect(resolveBreathPhase(morning, 48)).toBe('Exhale'); // cycleTime 8
    expect(resolveBreathPhase(morning, 43)).toBe('Exhale'); // cycleTime 13
  });

  it('4-7-8 (Evening): inhale 0-3, hold 4-10, exhale 11-18 within each 19s cycle - byte-identical to before this addition', () => {
    expect(resolveBreathPhase(evening, 76)).toBe('Inhale'); // cycleTime 0
    expect(resolveBreathPhase(evening, 73)).toBe('Inhale'); // cycleTime 3
    expect(resolveBreathPhase(evening, 72)).toBe('Hold'); // cycleTime 4
    expect(resolveBreathPhase(evening, 66)).toBe('Hold'); // cycleTime 10
    expect(resolveBreathPhase(evening, 65)).toBe('Exhale'); // cycleTime 11
    expect(resolveBreathPhase(evening, 58)).toBe('Exhale'); // cycleTime 18
  });

  it('4-4-8 (Quiet): inhale 0-3, hold 4-7, exhale 8-15 within each 16s cycle - byte-identical to before this addition', () => {
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

  // Box Breathing: inhale 0-3, hold 4-7, exhale 8-11, hold(-empty) 12-15,
  // within each 16s cycle - the genuine fourth-phase case. Every boundary
  // immediately before/after a transition is checked explicitly
  // (3->4, 7->8, 11->12, 15->next-cycle 0), per the approved test plan.
  it('Box (4-4-4-4): all four phases in order, both holds labelled the same literal "Hold" (approved - no separate "Hold empty" terminology)', () => {
    expect(resolveBreathPhase(box, 64)).toBe('Inhale'); // cycleTime 0
    expect(resolveBreathPhase(box, 61)).toBe('Inhale'); // cycleTime 3 (last Inhale second)
    expect(resolveBreathPhase(box, 60)).toBe('Hold'); // cycleTime 4 (3->4 boundary: Inhale -> Hold)
    expect(resolveBreathPhase(box, 57)).toBe('Hold'); // cycleTime 7 (last Hold second)
    expect(resolveBreathPhase(box, 56)).toBe('Exhale'); // cycleTime 8 (7->8 boundary: Hold -> Exhale)
    expect(resolveBreathPhase(box, 53)).toBe('Exhale'); // cycleTime 11 (last Exhale second)
    expect(resolveBreathPhase(box, 52)).toBe('Hold'); // cycleTime 12 (11->12 boundary: Exhale -> second Hold)
    expect(resolveBreathPhase(box, 49)).toBe('Hold'); // cycleTime 15 (last second-Hold second)
  });

  it('Box: the cycle boundary (15 -> next-cycle 0) returns to Inhale, exactly like the original three patterns\' own cycle wrap', () => {
    expect(resolveBreathPhase(box, 48)).toBe('Inhale'); // cycleTime (64-48)%16 = 0, 2nd cycle starts
  });

  it('Box: all four complete cycles (4 total) reproduce the identical phase sequence', () => {
    // 3rd cycle starts at secondsLeft = 64 - 32 = 32; 4th at 64 - 48 = 16
    expect(resolveBreathPhase(box, 32)).toBe('Inhale');
    expect(resolveBreathPhase(box, 28)).toBe('Hold');
    expect(resolveBreathPhase(box, 24)).toBe('Exhale');
    expect(resolveBreathPhase(box, 20)).toBe('Hold');
    expect(resolveBreathPhase(box, 16)).toBe('Inhale');
    expect(resolveBreathPhase(box, 12)).toBe('Hold');
    expect(resolveBreathPhase(box, 8)).toBe('Exhale');
    expect(resolveBreathPhase(box, 4)).toBe('Hold');
  });

  // Coherent Breathing: inhale 0-4, exhale 5-9 within each 10s cycle -
  // 'Hold' is never returned at any point, for any secondsLeft value,
  // since holdSeconds is 0 (the zero-duration-phase-skipped guarantee).
  it('Coherent (5-5): inhale directly transitions to exhale, "Hold" never returned for any secondsLeft value across all 6 cycles', () => {
    expect(resolveBreathPhase(coherent, 60)).toBe('Inhale'); // cycleTime 0
    expect(resolveBreathPhase(coherent, 56)).toBe('Inhale'); // cycleTime 4 (last Inhale second)
    expect(resolveBreathPhase(coherent, 55)).toBe('Exhale'); // cycleTime 5 (4->5 boundary: Inhale -> Exhale directly, no Hold)
    expect(resolveBreathPhase(coherent, 51)).toBe('Exhale'); // cycleTime 9 (last Exhale second)
    expect(resolveBreathPhase(coherent, 50)).toBe('Inhale'); // cycleTime 0, 2nd cycle
    // Every single second across all 6 cycles (60 values) is Inhale or
    // Exhale - never Hold.
    for (let secondsLeft = 60; secondsLeft >= 1; secondsLeft--) {
      expect(resolveBreathPhase(coherent, secondsLeft)).not.toBe('Hold');
    }
  });
});

describe('formatCadence - real execution, the exact approved copy for every pattern', () => {
  it('the three original patterns keep their exact original cadence text - byte-identical to before this addition', () => {
    expect(formatCadence(getBreathingPatternById('morning'))).toBe('Inhale 4s · Hold 4s · Exhale 6s');
    expect(formatCadence(getBreathingPatternById('evening'))).toBe('Inhale 4s · Hold 7s · Exhale 8s');
    expect(formatCadence(getBreathingPatternById('quiet'))).toBe('Inhale 4s · Hold 4s · Exhale 8s');
  });

  it('Box Breathing shows all four segments, in phase order: Inhale 4s · Hold 4s · Exhale 4s · Hold 4s', () => {
    expect(formatCadence(getBreathingPatternById('box'))).toBe('Inhale 4s · Hold 4s · Exhale 4s · Hold 4s');
  });

  it('Coherent Breathing shows exactly two segments - never "Hold 0s", never an empty phase, never a pause placeholder', () => {
    const cadence = formatCadence(getBreathingPatternById('coherent'));
    expect(cadence).toBe('Inhale 5s · Exhale 5s');
    expect(cadence).not.toMatch(/Hold/);
    expect(cadence.split(' · ')).toHaveLength(2);
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
    // no hard-coded label duplicated locally, for any of the five patterns
    // (the file's own doc comments may mention these names in prose -
    // strip comments first, matching this codebase's established
    // convention, so only the actual rendered code is checked).
    const code = rowSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/4-4-6 Breathing|4-7-8 Breathing|4-4-8 Breathing|Box Breathing|Coherent Breathing/);
  });

  // Build 15 Box/Coherent addition — the guided-video section (a
  // separate, pre-existing feature, completely independent of the
  // interactive pattern picker above) is untouched by adding the two new
  // interactive patterns. B02/B04 remain real, reachable guided videos.
  it('the existing guided Box/Coherent breathing videos (B02/B04) remain in BREATHING_SESSION_VIDEOS, untouched by the new interactive patterns', () => {
    expect(breatheSource).toMatch(/\{ id: 'B02', blurb: 'A guided video for box breathing\.' \}/);
    expect(breatheSource).toMatch(/\{ id: 'B04', blurb: 'A guided video for coherent breathing\.' \}/);
    expect(breatheSource).toMatch(/\{BREATHING_SESSION_VIDEOS\.map\(\(\{ id, blurb \}\) => \{/);
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

  it('InteractiveAmbientMusic is ONE stable instance (never two separate mount points - see MorningFlow.jsx\'s own fix for why), hidden pre-start via hideToggle, and nothing calls .start() outside handleBeginBreathing/handleResumeWithMusic', () => {
    expect(breatheSource).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}\s*\n\s*suspended=\{hasBegun \? \(Boolean\(openVideo\) \|\| manuallyPaused\) : false\}\s*\n\s*hideToggle=\{!hasBegun\}\s*\n\s*\/>/);
    const mountCount = (breatheSource.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
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
// Evening Breathing (Build 15 Evening UX correction) - real pattern
// choice like Morning/standalone, defaulting to 4-7-8, using the Evening
// periwinkle accent, with the same pre-start Begin discipline.
// ---------------------------------------------------------------------
describe('EveningBreathing.jsx - real pattern choice, defaulting to 4-7-8, Evening-themed, same pre-start Begin discipline', () => {
  it('imports the shared BREATHING_PATTERNS/BreathingPatternRow, never a second, hand-typed pattern list', () => {
    expect(eveningBreathingSource).toMatch(/import \{ BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase \} from '\.\.\/lib\/breathingPatterns';/);
    expect(eveningBreathingSource).toMatch(/\{BREATHING_PATTERNS\.map\(\(pattern\) => \(/);
  });

  it('renders inside role="radiogroup", one BreathingPatternRow per real pattern with the Evening accent, single groupName so only one can be checked at a time', () => {
    expect(eveningBreathingSource).toMatch(/role="radiogroup" aria-label="Choose your breathing practice"/);
    expect(eveningBreathingSource).toMatch(/groupName="evening-breathing-pattern"/);
    expect(eveningBreathingSource).toMatch(/accent="evening"/);
  });

  it('defaults to the real Evening 4-7-8 pattern ("evening") - preserving the established recommendation while allowing another choice', () => {
    expect(eveningBreathingSource).toMatch(/const DEFAULT_PATTERN_ID = 'evening';/);
  });

  it('resolves tonight\'s selection from a review-round-trip snapshot first, then a persisted same-day selection, then the 4-7-8 default - never a second, hand-typed default fallback', () => {
    expect(eveningBreathingSource).toMatch(
      /const \[selectedPatternId, setSelectedPatternId\] = useState\(\s*\n\s*\(\) => pausedSnapshot\?\.patternId \?\? loadEveningBreathingPattern\(userId, today\) \?\? DEFAULT_PATTERN_ID\s*\n\s*\);/
    );
    expect(eveningBreathingSource).toMatch(/const activePattern = getBreathingPatternById\(selectedPatternId\) \?\? getBreathingPatternById\(DEFAULT_PATTERN_ID\);/);
  });

  it('selecting a pattern persists it via the dedicated Evening-only helper, scoped by userId and today\'s date - never a general cross-app preference', () => {
    expect(eveningBreathingSource).toMatch(/import \{ loadEveningBreathingPattern, saveEveningBreathingPattern \} from '\.\.\/lib\/eveningBreathingSelection';/);
    const body = eveningBreathingSource.match(/const handleSelectPattern = \(patternId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setSelectedPatternId\(patternId\);/);
    expect(body).toMatch(/saveEveningBreathingPattern\(userId, patternId, today\);/);
  });

  it('nothing starts on mount - hasBegun defaults to false (true only when resuming a paused snapshot), gating the countdown entirely', () => {
    expect(eveningBreathingSource).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => Boolean\(pausedSnapshot\)\);/);
    expect(eveningBreathingSource).toMatch(/if \(!hasBegun \|\| manuallyPaused \|\| isRepeatGated \|\| isConfirming\) return;/);
  });

  it('InteractiveAmbientMusic is ONE stable instance (never two separate mount points), hidden pre-start via hideToggle, and Begin is the only place (besides Resume with Music) that starts it', () => {
    expect(eveningBreathingSource).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}\s*\n\s*suspended=\{hasBegun \? manuallyPaused : false\}\s*\n\s*hideToggle=\{!hasBegun\}\s*\n\s*\/>/);
    const mountCount = (eveningBreathingSource.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
    const startCalls = eveningBreathingSource.match(/musicPlayerRef\.current\?\.start\(\);/g) ?? [];
    expect(startCalls.length).toBe(2);
  });

  it('Begin Breathing locks the selected pattern by resetting the countdown to its real total, sets hasBegun, guards against double taps, and starts music only if eligible+preferred+not-guest', () => {
    const body = eveningBreathingSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasBegunOnceRef\.current\) return;/);
    expect(body).toMatch(/setSecondsLeft\(activePattern\.totalSeconds\);/);
    expect(body).toMatch(/setHasBegun\(true\);/);
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn && !isGuest\) \{/);
  });

  it('the picker UI only renders while !hasBegun - once Begin fires, selectedPatternId can never change again for the active run (structural lock, no separate "locked" flag needed)', () => {
    const preStartBlock = eveningBreathingSource.match(/\) : !hasBegun \? \(([\s\S]*?)\n {6}\) : \(/)?.[1] ?? '';
    expect(preStartBlock).toMatch(/role="radiogroup"/);
    const activeBlock = eveningBreathingSource.slice(eveningBreathingSource.indexOf(') : (', eveningBreathingSource.indexOf('!hasBegun ?')));
    // BreathingRing (the active view) never itself renders a radiogroup.
    const activeViewOnly = activeBlock.slice(0, activeBlock.indexOf('InteractiveAmbientMusic'));
    expect(activeViewOnly).not.toMatch(/role="radiogroup"/);
  });

  it('uses the shared resolveBreathPhase, driven by the locked activePattern, for its own countdown - never a hand-rolled modulo', () => {
    expect(eveningBreathingSource).toMatch(/setBreatheState\(resolveBreathPhase\(activePattern, nextSec\)\);/);
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

  it('never renders a hand-typed cadence/duration preview string outside BreathingPatternRow - no second source of truth for the pattern label/cadence', () => {
    expect(eveningBreathingSource).not.toMatch(/Inhale \{PATTERN\.inhaleSeconds\}/);
    expect(eveningBreathingSource).not.toMatch(/const PATTERN = getBreathingPatternById/);
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
