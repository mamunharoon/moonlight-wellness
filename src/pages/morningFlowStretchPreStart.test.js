// Build 15 — Morning Stretch pre-start/movement-selection screen. No DOM
// rendering is available in this repo's Vitest (see other regression
// guards in this codebase for the same note) - real execution for the
// one genuinely pure/importable piece (formatTotalDuration), source-level
// checks for everything else, matching this codebase's own established
// precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatTotalDuration } from '../lib/formatDuration';

// Morning Visual Uplift (Build 16) — normalises CRLF to LF right after
// reading. MorningFlow.jsx has a pre-existing, repo-wide mixed-line-
// ending situation (git diff --check already flags it, along with
// several other files, as wanting CRLF on the next checkout) - this
// file's own literal multi-line search strings below are written with
// plain \n and would otherwise silently stop matching (indexOf returning
// -1) purely depending on which line-ending a given checkout/stash
// round-trip happens to leave a boundary in, with no relation to the
// actual code changing. Normalising here makes every assertion below
// depend only on real content, never on incidental line-ending noise.
const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8').replace(/\r\n/g, '\n');
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

  it('formats a non-exact minute or more as rounded minutes, with "~" signalling real rounding', () => {
    expect(formatTotalDuration(80)).toBe('~1 min');
    expect(formatTotalDuration(160)).toBe('~3 mins');
  });

  // Build 15 Box/Coherent addition — exact-minute correction: a genuine
  // whole-minute total never carries "~" (nothing was rounded). This is
  // a real, reachable state here too, not just a Breathing-pattern
  // concern: exactly 3 of the 4 movements selected, at the standard 20s
  // each, totals exactly 60s.
  it('formats an EXACT whole-minute total with no "~" - the total was not rounded, so the copy must not imply it was', () => {
    expect(formatTotalDuration(60)).toBe('1 min');
    expect(formatTotalDuration(120)).toBe('2 mins');
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
    // Build 15 Stretch pre-start restructure — the duration label now
    // passes through MovementCheckboxRow's own `durationLabel` prop as a
    // template literal, rather than inline JSX text.
    const durationDisplays = source.match(/durationLabel=\{`0:\$\{getStepDuration\(\)\.toString\(\)\.padStart\(2, '0'\)\}`\}/g) ?? [];
    expect(durationDisplays.length).toBeGreaterThan(0);
  });

  it('never fabricates a named music track ("Calm Dawn Acoustic" or similar) - only the real, shared MusicPreferenceToggle (default label "Background music") is used', () => {
    expect(source).not.toMatch(/Calm Dawn Acoustic|Ambient Music —/);
    expect(source).toMatch(/<MusicPreferenceToggle/);
    expect(source).toMatch(/import \{ MusicPreferenceToggle \} from '\.\.\/components\/MusicPreferenceToggle';/);
  });

  it('does not offer "Customise Moves & Duration" - the visible movement selection IS the customisation, and duration is not independently customisable', () => {
    expect(source).not.toMatch(/Customise Moves/i);
  });

  it('uses the approved eyebrow/heading/support copy - the static fallback survives for the active/repeat-gated states, dynamic copy takes over pre-start', () => {
    expect(source).toMatch(/Morning Movement/);
    expect(source).toMatch(/Gentle Morning Stretch/);
    expect(source).toMatch(/Ease into the day with a few gentle movements\./);
  });
});

// Release-quality Morning Stretch (Build 15) — dynamic explanatory copy
// and Begin label, exact approved wording for every reachable selected
// count (1-4). getPreStartCopy/beginLabel are plain functions/values
// derived from selectedCount, so real execution is possible here without
// any DOM rendering.
describe('Dynamic pre-start copy and Begin label - real execution', () => {
  // A faithful, minimal re-implementation matching MorningFlow.jsx's own
  // getPreStartCopy/beginLabel exactly - verified against the real source
  // text below so a future edit to either one is caught either way.
  const getPreStartCopy = (selectedCount) => {
    if (selectedCount === 4) return 'All four movements are selected. Begin now, or choose the movements that feel right today.';
    if (selectedCount === 1) return 'One movement is selected. Begin now, or choose a different movement below.';
    return `${selectedCount} movements are selected. Begin now, or choose different movements below.`;
  };
  const beginLabel = (selectedCount) => `Begin with ${selectedCount} movement${selectedCount === 1 ? '' : 's'}`;

  it('4 selected: "All four movements are selected..." / "Begin with 4 movements"', () => {
    expect(getPreStartCopy(4)).toBe('All four movements are selected. Begin now, or choose the movements that feel right today.');
    expect(beginLabel(4)).toBe('Begin with 4 movements');
  });

  it('2 or 3 selected (plural, not "all four"): "{count} movements are selected..." / "Begin with {count} movements"', () => {
    expect(getPreStartCopy(3)).toBe('3 movements are selected. Begin now, or choose different movements below.');
    expect(getPreStartCopy(2)).toBe('2 movements are selected. Begin now, or choose different movements below.');
    expect(beginLabel(3)).toBe('Begin with 3 movements');
    expect(beginLabel(2)).toBe('Begin with 2 movements');
  });

  it('1 selected (singular "One movement"): "One movement is selected..." / "Begin with 1 movement" - never "1-Movement Stretch"', () => {
    expect(getPreStartCopy(1)).toBe('One movement is selected. Begin now, or choose a different movement below.');
    expect(beginLabel(1)).toBe('Begin with 1 movement');
    expect(beginLabel(1)).not.toMatch(/1-Movement Stretch/i);
  });

  it('the real source defines getPreStartCopy/beginLabel with this exact wording, driven by selectedCount - not a hand-typed duplicate elsewhere', () => {
    expect(source).toMatch(/if \(selectedCount === 4\) return 'All four movements are selected\. Begin now, or choose the movements that feel right today\.';/);
    expect(source).toMatch(/if \(selectedCount === 1\) return 'One movement is selected\. Begin now, or choose a different movement below\.';/);
    expect(source).toMatch(/return `\$\{selectedCount\} movements are selected\. Begin now, or choose different movements below\.`;/);
    expect(source).toMatch(/const beginLabel = `Begin with \$\{selectedCount\} movement\$\{selectedCount === 1 \? '' : 's'\}`;/);
  });

  it('the heading paragraph renders getPreStartCopy() only pre-start (!isRepeatGated && !hasBegun), the static fallback otherwise', () => {
    expect(source).toMatch(/\{!isRepeatGated && !hasBegun \? getPreStartCopy\(\) : 'Ease into the day with a few gentle movements\.'\}/);
  });

  it('the Begin button renders the dynamic beginLabel, never the old static "Begin Stretching"', () => {
    expect(source).toMatch(/<span>\{beginLabel\}<\/span>/);
    expect(source).not.toMatch(/<span>Begin Stretching<\/span>/);
  });
});

// Release-quality Morning Stretch (Build 15) — compact pre-start order:
// Back/Progress -> heading -> summary -> music -> Begin -> Choose
// movements disclosure -> Explore guided stretching sessions disclosure
// -> Skip -> Exit routine. Verified by comparing each landmark's own
// index() in the pre-start branch's source text, in the approved order.
describe('Compact Stretch pre-start order', () => {
  const preStartBranch = source.slice(source.indexOf(': !hasBegun ? ('), source.indexOf(') : (\n        <>\n          {/* Progress visual bar */}'));

  it('landmarks appear in the exact approved order: summary -> music -> Begin -> Choose movements -> guided sessions -> Skip -> Exit', () => {
    const iSummary = preStartBranch.indexOf('total');
    const iMusic = preStartBranch.indexOf('<MusicPreferenceToggle');
    const iBegin = preStartBranch.indexOf('onClick={handleBeginStretching}');
    const iChooseMovements = preStartBranch.indexOf('Choose movements —');
    const iGuidedSessions = preStartBranch.indexOf('Explore guided stretching sessions —');
    const iSkip = preStartBranch.indexOf('Skip this step');
    const iExit = preStartBranch.indexOf('Exit routine');

    for (const idx of [iSummary, iMusic, iBegin, iChooseMovements, iGuidedSessions, iSkip, iExit]) {
      expect(idx).toBeGreaterThanOrEqual(0);
    }
    expect(iSummary).toBeLessThan(iMusic);
    expect(iMusic).toBeLessThan(iBegin);
    expect(iBegin).toBeLessThan(iChooseMovements);
    expect(iChooseMovements).toBeLessThan(iGuidedSessions);
    expect(iGuidedSessions).toBeLessThan(iSkip);
    expect(iSkip).toBeLessThan(iExit);
  });

  it('Begin appears before both disclosures, and both disclosures appear before Skip/Exit', () => {
    const iBegin = preStartBranch.indexOf('onClick={handleBeginStretching}');
    const iChooseMovements = preStartBranch.indexOf('Choose movements —');
    const iGuidedSessions = preStartBranch.indexOf('Explore guided stretching sessions —');
    const iSkip = preStartBranch.indexOf('Skip this step');
    expect(iBegin).toBeLessThan(iChooseMovements);
    expect(iBegin).toBeLessThan(iGuidedSessions);
    expect(iChooseMovements).toBeLessThan(iSkip);
    expect(iGuidedSessions).toBeLessThan(iSkip);
  });
});

// Release-quality Morning Stretch (Build 15) — "Choose movements" and
// "Explore guided stretching sessions" disclosures: collapsed by
// default, real conditional rendering (never merely visually hidden),
// never forced open by Begin, correct aria-expanded/aria-controls,
// never navigate.
describe('Stretch pre-start disclosures - collapse/expand behaviour', () => {
  it('both disclosures default to collapsed (useState(false))', () => {
    expect(source).toMatch(/const \[movementsOpen, setMovementsOpen\] = useState\(false\);/);
    expect(source).toMatch(/const \[guidedSessionsOpen, setGuidedSessionsOpen\] = useState\(false\);/);
  });

  it('movement rows and the guided-session rows are genuinely conditionally rendered (unmounted when collapsed), never just visually hidden', () => {
    expect(source).toMatch(/\{movementsOpen && \(\s*\n\s*<div id="stretch-choose-movements"/);
    expect(source).toMatch(/\{guidedSessionsOpen && \(\s*\n\s*<div id="stretch-guided-sessions"/);
    expect(source).toMatch(/\{guidedSessionsOpen && \(\s*\n\s*<div id="stretch-guided-sessions-active"/);
  });

  it('handleBeginStretching never touches movementsOpen/guidedSessionsOpen - Begin never forces a disclosure open (or closed)', () => {
    const body = source.match(/const handleBeginStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/setMovementsOpen|setGuidedSessionsOpen/);
  });

  it('both disclosure triggers are real toggle buttons with correct aria-expanded/aria-controls, never a link/navigation', () => {
    expect(source).toMatch(/onClick=\{\(\) => setMovementsOpen\(\(v\) => !v\)\}\s*\n\s*aria-expanded=\{movementsOpen\}\s*\n\s*aria-controls="stretch-choose-movements"/);
    expect(source).toMatch(/onClick=\{\(\) => setGuidedSessionsOpen\(\(v\) => !v\)\}\s*\n\s*aria-expanded=\{guidedSessionsOpen\}\s*\n\s*aria-controls="stretch-guided-sessions"/);
    expect(source).not.toMatch(/onClick=\{\(\) => setMovementsOpen[\s\S]{0,80}navigate\(/);
  });

  it('the guided-sessions disclosure header count comes from STRETCHING_SESSION_VIDEOS.length, never a hand-typed "5"', () => {
    const matches = source.match(/Explore guided stretching sessions — \{STRETCHING_SESSION_VIDEOS\.length\} available/g) ?? [];
    // Appears twice: once in the pre-start branch, once in the active-state block.
    expect(matches.length).toBe(2);
  });

  it('the Choose-movements disclosure header count comes from the live selectedCount, never a hand-typed number', () => {
    expect(source).toMatch(/Choose movements — \{selectedCount\} selected/);
  });

  it('the guided-sessions disclosure remains reachable both pre-start and once hasBegun is true, sharing one state variable (opening it pre-start survives tapping Begin)', () => {
    const guidedSessionsOpenUsages = source.match(/guidedSessionsOpen/g) ?? [];
    // setGuidedSessionsOpen(false) init + pre-start button/panel + active button/panel references.
    expect(guidedSessionsOpenUsages.length).toBeGreaterThanOrEqual(6);
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && \(\s*\n\s*<div className="space-y-2">\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setGuidedSessionsOpen/);
  });
});

// Release-quality Morning Stretch (Build 15) — opening/closing media from
// inside the guided-sessions disclosure must never advance or complete
// the timed routine, and must never itself navigate away from Stretch.
describe('Guided-session media never advances or completes the timed routine', () => {
  it('handleSelectVideo only marks videoOpenedDuringExercise and opens the protected-video flow - it never calls advanceStep/navigate/setJourneyStep', () => {
    const body = source.match(/const handleSelectVideo = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setVideoOpenedDuringExercise\(true\);/);
    expect(body).toMatch(/handleSelect\(id\);/);
    expect(body).not.toMatch(/advanceStep|navigate\(|setJourneyStep/);
  });

  it('closing the video (BetaVideoModal onClose) is the existing closeVideo handler - it returns to this same Stretch screen, no route change', () => {
    expect(source).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{closeVideo\} \/>/);
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

  it('InteractiveAmbientMusic is ONE stable instance (never two separate mount points across the pre-start/active transition - a real bug found and fixed this phase: a ref-triggered start() on an instance about to unmount orphans the audio), hidden pre-start via hideToggle, with nothing calling .start() outside handleBeginStretching/handleResumeWithMusic', () => {
    expect(source).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_STRETCHING_MUSIC_ID\}\s*\n\s*suspended=\{hasBegun \? \(Boolean\(openVideo\) \|\| manuallyPaused\) : false\}\s*\n\s*hideToggle=\{!hasBegun\}\s*\n\s*\/>/);
    const mountCount = (source.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
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
  // Build 15 Stretch pre-start restructure — movement rows moved from an
  // inline role="switch" button to the new, dedicated MovementCheckboxRow
  // component (real checkbox semantics), since multi-select inclusion
  // reads as ambiguous under switch framing. See movementCheckboxRow.test.js
  // for MovementCheckboxRow.jsx's own full behavioural coverage.
  it('movement rows render via MovementCheckboxRow, never role="switch"/role="radio"/a native radio input, in the whole file', () => {
    const preStartBranch = source.slice(source.indexOf('role="group" aria-label="Choose your movements"'), source.indexOf('{lastMovementNotice'));
    expect(preStartBranch).toMatch(/<MovementCheckboxRow/);
    expect(source).not.toMatch(/role="switch"/);
    expect(source).not.toMatch(/role="radio"|type="radio"/);
    expect(source).toMatch(/import \{ MovementCheckboxRow \} from '\.\.\/components\/MovementCheckboxRow';/);
  });

  it('each row is wired with isSelected/onToggle from the same Set-based selection state, canonical steps order preserved (never re-sorted by selection)', () => {
    const rowBlock = source.match(/\{steps\.map\(\(step, idx\) => \(\s*\n\s*<MovementCheckboxRow[\s\S]*?\/>\s*\n\s*\)\)\}/)?.[0] ?? '';
    expect(rowBlock).toMatch(/isSelected=\{selectedMovements\.has\(idx\)\}/);
    expect(rowBlock).toMatch(/onToggle=\{\(\) => handleToggleMovement\(idx\)\}/);
    expect(rowBlock).toMatch(/title=\{step\.title\}/);
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
  it('STRETCHING_SESSION_VIDEOS (S01-S05) is a distinct, exactly-5-entry array, never merged into steps/orderedActiveSteps', () => {
    expect(source).toMatch(/const STRETCHING_SESSION_VIDEOS = \[/);
    const block = source.match(/const STRETCHING_SESSION_VIDEOS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    const idMatches = [...block.matchAll(/id: '(S0\d)'/g)].map((m) => m[1]);
    expect(idMatches).toEqual(['S01', 'S02', 'S03', 'S04', 'S05']);
  });

  // Build 15 Stretch pre-start restructure — now rendered from inside the
  // "Explore guided stretching sessions" disclosure in BOTH the pre-start
  // branch and the active-state block (two separate .map() call sites,
  // one per branch), sharing one `guidedSessionsOpen` state - never
  // rendered unconditionally any more.
  it('is rendered exactly twice (pre-start disclosure + active-state disclosure), both gated behind guidedSessionsOpen, never unconditionally', () => {
    const mapCalls = source.match(/\{STRETCHING_SESSION_VIDEOS\.map\(\(\{ id, blurb \}\) => \{/g) ?? [];
    expect(mapCalls.length).toBe(2);
  });
});
