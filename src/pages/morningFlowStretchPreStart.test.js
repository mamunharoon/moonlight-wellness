// Build 15 — Morning Stretch pre-start/movement-selection screen. No DOM
// rendering is available in this repo's Vitest (see other regression
// guards in this codebase for the same note) - real execution for the
// one genuinely pure/importable piece (formatTotalDuration), source-level
// checks for everything else, matching this codebase's own established
// precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatTotalDuration } from '../lib/stretchDuration';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./MorningFlow.jsx');

const REAL_MOVEMENTS = [
  { title: 'Reach to the Sky', desc: 'Extend your arms high and breathe deep.', icon: 'wb_sunny' },
  { title: 'Shoulder Rolls', desc: 'Roll your shoulders backward gently.', icon: 'rotate_right' },
  { title: 'Gentle Neck Stretch', desc: 'Slowly lower your ear to your shoulder.', icon: 'autorenew' },
  { title: 'Gentle Twist', desc: 'Slowly rotate your torso from side to side.', icon: 'spa' }
];

describe('formatTotalDuration - real execution', () => {
  it('formats under a minute as seconds', () => {
    expect(formatTotalDuration(20)).toBe('20s');
    expect(formatTotalDuration(40)).toBe('40s');
    expect(formatTotalDuration(59)).toBe('59s');
  });

  it('formats a minute or more as rounded minutes', () => {
    expect(formatTotalDuration(60)).toBe('~1 min');
    expect(formatTotalDuration(80)).toBe('~1 min');
    expect(formatTotalDuration(160)).toBe('~3 mins');
  });
});

// 1, 2. Real movements appear before Start; no invented movement.
describe('Item 1/2 - real movements only, exact approved wording, nothing fabricated', () => {
  it('the steps array contains exactly the 4 real, approved movements, in canonical order, with their real instructions/icons', () => {
    const block = source.match(/const steps = \[([\s\S]*?)\n {2}\];/)?.[1] ?? '';
    for (const movement of REAL_MOVEMENTS) {
      expect(block).toMatch(new RegExp(`title: '${movement.title}', desc: '${movement.desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}', icon: '${movement.icon}'`));
    }
    const titleMatches = [...block.matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
    expect(titleMatches).toEqual(REAL_MOVEMENTS.map((m) => m.title));
  });

  it('never uses the fabricated Stitch wording "Gentle Torso Twist" - the real title "Gentle Twist" is used instead', () => {
    expect(source).not.toMatch(/Gentle Torso Twist/);
    expect(source).toMatch(/Gentle Twist/);
  });

  it('never fabricates per-movement durations - every displayed movement duration comes from the one real getStepDuration() value, not a hand-typed number', () => {
    expect(source).not.toMatch(/0:20<\/span>.*0:30|0:30.*0:30.*0:40/s);
    const durationDisplays = source.match(/0:\{getStepDuration\(\)\.toString\(\)\.padStart\(2, '0'\)\}/g) ?? [];
    expect(durationDisplays.length).toBeGreaterThan(0);
  });

  it('never fabricates a named music track ("Calm Dawn Acoustic" or similar) - only the real "Background music" toggle wording is used', () => {
    expect(source).not.toMatch(/Calm Dawn Acoustic|Ambient Music —/);
    expect(source).toMatch(/Background music/);
  });

  it('does not offer "Customise Moves & Duration" - the visible movement selection IS the customisation, and duration is not independently customisable', () => {
    expect(source).not.toMatch(/Customise Moves/i);
  });

  it('uses the approved eyebrow/heading/support copy', () => {
    expect(source).toMatch(/Morning Movement/);
    expect(source).toMatch(/Gentle Morning Stretch/);
    expect(source).toMatch(/Ease into the day with a few gentle movements\./);
  });
});

// 3. Total duration is calculated from real data.
describe('Item 3 - total duration and selected count are calculated, never hard-coded', () => {
  it('totalSeconds is selectedCount * getStepDuration(), computed at render, not a literal', () => {
    expect(source).toMatch(/const selectedCount = selectedMovements\.size;/);
    expect(source).toMatch(/const totalSeconds = selectedCount \* getStepDuration\(\);/);
    expect(source).toMatch(/\{formatTotalDuration\(totalSeconds\)\} total/);
    expect(source).toMatch(/\{selectedCount\} movement\{selectedCount === 1 \? '' : 's'\} selected/);
  });

  it('getStepDuration reads the real global routineDuration setting (standard=20s, extended=40s) - never a hard-coded "Quick" concept the app doesn\'t have', () => {
    expect(source).toMatch(/const getStepDuration = \(\) => \(routineDuration === 'extended' \? 40 : 20\);/);
    expect(source).not.toMatch(/Quick/);
  });
});

// 4, 5, 6. Nothing starts on mount.
describe('Items 4/5/6 - timer, animation and music never start on mount', () => {
  it('the pre-start branch is gated on !hasBegun, and hasBegun defaults to false (true only when genuinely resuming a paused snapshot)', () => {
    expect(source).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => Boolean\(pausedSnapshot\)\);/);
    expect(source).toMatch(/\) : !hasBegun \? \(/);
  });

  it('the countdown effect refuses to run at all while !hasBegun (or with no locked activeSequence yet)', () => {
    expect(source).toMatch(/if \(!hasBegun \|\| !activeSequence \|\| isInterrupted \|\| isRepeatGated \|\| isConfirming\) return;/);
  });

  it('the active movement list (the only place a "current" highlighted movement/animation-style state renders) is entirely inside the hasBegun branch - never rendered pre-start', () => {
    const preStartBranch = source.slice(source.indexOf(': !hasBegun ? ('), source.indexOf(') : (\n        <>\n          {/* Progress visual bar */}'));
    expect(preStartBranch).not.toMatch(/Stretching Progress/);
  });

  it('InteractiveAmbientMusic is mounted pre-start with hideToggle (so its ref exists before Begin) but nothing calls .start() on it outside handleBeginStretching/handleResumeWithMusic', () => {
    expect(source).toMatch(/<InteractiveAmbientMusic ref=\{musicPlayerRef\} musicVariantId=\{INTERACTIVE_STRETCHING_MUSIC_ID\} suspended=\{false\} hideToggle \/>/);
    const startCalls = source.match(/musicPlayerRef\.current\?\.start\(\);/g) ?? [];
    // Exactly two legitimate call sites: handleBeginStretching and
    // handleResumeWithMusic - never a third, and never inside a useEffect.
    expect(startCalls.length).toBe(2);
    const effectBodies = source.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/g) ?? [];
    for (const body of effectBodies) {
      expect(body).not.toMatch(/musicPlayerRef/);
    }
  });

  it('the pre-start music preference switch is a plain local toggle (musicPreferenceOn) - flipping it never itself calls musicPlayerRef.start()', () => {
    const toggleBody = source.match(/const handleToggleMusicPreference = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(toggleBody).not.toMatch(/musicPlayerRef|\.start\(\)/);
  });
});

// 7, 8, 9, 10. Begin starts everything together, gated on eligibility/preference/guest, double-tap safe.
describe('Items 7/8/9/10 - Begin Stretching starts timer+animation+music together, exactly once', () => {
  it('locks the selected sequence, resets activeStep/timeLeft, and sets hasBegun - all inside one handler', () => {
    const body = source.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const sequence = \[\.\.\.selectedMovements\]\.sort\(\(a, b\) => a - b\);/);
    expect(body).toMatch(/setActiveSequence\(sequence\);/);
    expect(body).toMatch(/setActiveStep\(0\);/);
    expect(body).toMatch(/setTimeLeft\(getStepDuration\(\)\);/);
    expect(body).toMatch(/setHasBegun\(true\);/);
  });

  it('starts music only if eligible, preferred, and not a guest - disabled preference stays genuinely silent', () => {
    const body = source.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn && !isGuest\) \{\s*\n\s*musicPlayerRef\.current\?\.start\(\);\s*\n\s*\}/);
  });

  it('double-tap protection uses a ref (not state) checked and set before anything else runs', () => {
    expect(source).toMatch(/const hasBegunOnceRef = useRef\(false\);/);
    const body = source.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasBegunOnceRef\.current\) return;/);
    expect(body).toMatch(/hasBegunOnceRef\.current = true;/);
    // The guard is the very first statement, before any state mutation.
    expect(body.indexOf('if (hasBegunOnceRef.current) return;')).toBeLessThan(body.indexOf('setActiveSequence'));
  });

  it('Begin is disabled (defense in depth) when selection is empty, even though deselecting the last movement is already rejected elsewhere', () => {
    expect(source).toMatch(/disabled=\{selectedMovements\.size === 0\}/);
    const body = source.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(selectedMovements\.size === 0\) return;/);
  });
});

// Multi-select semantics (switches, not radios), default-all-selected,
// last-movement protection, canonical order.
describe('Movement multi-selection semantics', () => {
  it('each movement row uses role="switch"/aria-checked, never role="radio" or a native radio input - multiple movements may be selected', () => {
    const preStartBranch = source.slice(source.indexOf('role="group" aria-label="Choose your movements"'), source.indexOf('{lastMovementNotice'));
    expect(preStartBranch).toMatch(/role="switch"/);
    expect(preStartBranch).not.toMatch(/role="radio"|type="radio"/);
  });

  it('all 4 movements are selected by default', () => {
    expect(source).toMatch(/return new Set\(steps\.map\(\(_, i\) => i\)\);/);
  });

  it('deselecting the only remaining selected movement is rejected, not silently allowed, and shows a friendly message', () => {
    const body = source.match(/const handleToggleMovement = \(idx\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(prev\.has\(idx\) && prev\.size === 1\) \{/);
    expect(body).toMatch(/setLastMovementNotice\(true\);/);
    expect(body).toMatch(/return prev;/);
    expect(source).toMatch(/Keep at least one movement selected to begin\./);
  });

  it('a successful toggle clears the notice and mutates a real new Set (never mutating the previous one in place)', () => {
    const body = source.match(/const handleToggleMovement = \(idx\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setLastMovementNotice\(false\);/);
    expect(body).toMatch(/const next = new Set\(prev\);/);
  });

  it('canonical order is preserved regardless of selection order - the active run is built by sorting the selected indices ascending, never by toggle order', () => {
    const body = source.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/\[\.\.\.selectedMovements\]\.sort\(\(a, b\) => a - b\)/);
  });

  it('the active run renders only the included movements (orderedActiveSteps), built from the locked activeSequence - excluded movements never appear during the run', () => {
    expect(source).toMatch(/const orderedActiveSteps = activeSequence \? activeSequence\.map\(\(i\) => steps\[i\]\) : \[\];/);
    expect(source).toMatch(/\{orderedActiveSteps\.map\(\(step, idx\) => \{/);
  });

  it('progress is calculated from the selected count, not always 4 - "Movement X of Y" uses orderedActiveSteps.length', () => {
    expect(source).toMatch(/Movement \{activeStep \+ 1\} of \{orderedActiveSteps\.length\}/);
  });
});

// 7. Selection is never persisted outside the existing, already-isolated
// sessionStorage paused-exercise snapshot mechanism - so it can never
// leak across users/days, and Start Over/sign-out/a new day all clear it
// for free (a genuine remount with no matching snapshot).
describe('Selection persistence and isolation', () => {
  it('selectedMovements is never written to localStorage directly - the only place it is ever serialized is the existing, already sessionId+stepId-scoped savePausedExerciseState call', () => {
    expect(source).not.toMatch(/localStorage\.setItem\([^)]*selectedMovements/);
    const body = source.match(/onLeaveLiveStep: \(\) => savePausedExerciseState\('morning-routine', 'stretch', \{[\s\S]*?\}\)/)?.[0] ?? '';
    expect(body).toMatch(/selectedMovements: activeSequence \?\? \[\.\.\.selectedMovements\]/);
    expect(body).toMatch(/musicEnabled: musicPreferenceOn/);
  });

  it('a resumed snapshot restores the already-locked sequence and hasBegun=true, never re-showing the pre-start selection screen for an in-progress run', () => {
    expect(source).toMatch(/if \(pausedSnapshot\?\.selectedMovements\) return \[\.\.\.pausedSnapshot\.selectedMovements\]\.sort\(\(a, b\) => a - b\);/);
    expect(source).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => Boolean\(pausedSnapshot\)\);/);
  });

  it('the music preference is never seeded true for a guest, even if a stored preference exists', () => {
    const body = source.match(/const \[musicPreferenceOn, setMusicPreferenceOn\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).toMatch(/if \(isGuest\) return false;/);
  });

  it('imports getMusicPreference to genuinely honour a persisted preference now that a real Begin gesture exists (unlike InteractiveAmbientMusic\'s own always-off default)', () => {
    expect(source).toMatch(/import \{ getMusicPreference, setMusicPreference \} from '\.\.\/lib\/musicPreference';/);
    expect(source).toMatch(/return musicEligible && getMusicPreference\(\);/);
  });
});

// 13. Journey advances exactly once on genuine completion - unchanged
// one-shot-ref mechanism, still present and still the only advanceStep
// call site.
describe('Item 13 - advanceStep fires at most once, via the existing one-shot mirror ref', () => {
  it('mirrorStretchExitRef is the only thing that ever calls advanceStep, guarded by hasMirroredExitRef', () => {
    const advanceCalls = source.match(/\badvanceStep\(\);/g) ?? [];
    expect(advanceCalls.length).toBe(1);
    expect(source).toMatch(/if \(hasMirroredExitRef\.current\) return;\s*\n\s*hasMirroredExitRef\.current = true;/);
  });
});

// 14. Quick/Standard (standard/extended) behaviour remains correct.
describe('Item 14 - standard vs extended duration remains correct for both the summary and the active countdown', () => {
  it('getStepDuration is the single source both the pre-start summary and the active timer read - never two separate computations that could drift', () => {
    const getStepDurationCalls = source.match(/getStepDuration\(\)/g) ?? [];
    // Used by: totalSeconds, the per-row duration display, handleBeginStretching's
    // setTimeLeft, the countdown effect's own stepDur, and handleNextStep's stepDur.
    expect(getStepDurationCalls.length).toBeGreaterThanOrEqual(4);
  });
});

// Regression: guided-video interruption, pause/resume, cleanup, and the
// Session-Engine boundary are all unchanged from the pre-Build-15 file -
// covered in full by musicEntryChoice.test.js/interactiveAmbientMusic.test.js/
// reviewMode.test.js's own updated MorningFlow.jsx coverage; not
// duplicated here.
describe('Regression - Stretching Sessions videos remain separate from the timed movement selector', () => {
  it('STRETCHING_SESSION_VIDEOS (S01-S05) is a distinct array, rendered outside both the pre-start and active branches, never merged into steps/orderedActiveSteps', () => {
    expect(source).toMatch(/const STRETCHING_SESSION_VIDEOS = \[/);
    expect(source).toMatch(/\{STRETCHING_SESSION_VIDEOS\.map\(\(\{ id, blurb \}\) => \{/);
  });
});
