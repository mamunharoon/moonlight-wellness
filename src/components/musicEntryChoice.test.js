// Regression guard for the "Add calming background music?" entry choice,
// asked once per visit on every interactive timed screen before its own
// countdown effect is allowed to start (Breathe.jsx, MorningFlow.jsx,
// EveningBreathing.jsx, QuietBreathing.jsx). Source-level checks, matching
// every other regression guard in this codebase (no component rendering
// available in this repo's Node-environment Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const choiceSource = read('./MusicEntryChoice.jsx');
const pausedPanelSource = read('./ExercisePausedPanel.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');

describe('MusicEntryChoice.jsx - the shared entry-choice card itself', () => {
  it('renders the exact required copy, never a browser/native confirm()', () => {
    expect(choiceSource).toMatch(/Add calming background music\?/);
    expect(choiceSource).toMatch(/You can switch it off at any time\./);
    expect(choiceSource).not.toMatch(/window\.confirm|window\.alert/);
  });

  it('both actions are real buttons wired to the two distinct callback props', () => {
    expect(choiceSource).toMatch(/onClick=\{onContinueWithoutMusic\}[\s\S]*?Continue Without Music/);
    expect(choiceSource).toMatch(/onClick=\{onStartWithMusic\}[\s\S]*?Start with Music/);
  });

  it('both buttons share one flex row (fit side by side at iPhone width), not stacked full-width', () => {
    expect(choiceSource).toMatch(/<div className="flex gap-2[^"]*">/);
  });

  // Guest pre-start-music correction, part 2 (Build 18) — the former
  // Build 11 RC "Sign In" substitute is removed. IB01 is server-
  // allowlisted for guests (GUEST_ALLOWED_IDS in
  // supabase/functions/_shared/betaVideoUrlAccess.ts, proven by
  // betaVideoUrlGuestAccess.test.js), so InteractiveAmbientMusic's own
  // start() genuinely succeeds for a guest - gating this button was
  // gating a guest out of audio they were always permitted to hear.
  describe('guest pre-start-music correction (Build 18)', () => {
    it('has no isGuest/onSignIn prop at all - the component signature is exactly ({ onStartWithMusic, onContinueWithoutMusic, accent = \'primary\' })', () => {
      expect(choiceSource).toMatch(/export const MusicEntryChoice = \(\{ onStartWithMusic, onContinueWithoutMusic, accent = 'primary' \}\) => \(/);
    });

    it('shows the same subtitle for every user - no guest-specific "Sign in" copy remains', () => {
      expect(choiceSource).toMatch(/You can switch it off at any time\./);
      expect(choiceSource).not.toMatch(/Sign in to use background music/);
    });

    it('"Start with Music" is an unconditional button wired directly to onStartWithMusic - never a Sign In substitute', () => {
      expect(choiceSource).toMatch(/onClick=\{onStartWithMusic\}[\s\S]*?Start with Music/);
      const codeOnly = choiceSource.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(codeOnly).not.toMatch(/isGuest|onSignIn|Sign In/);
    });

    it('"Continue Without Music" is unchanged - a plain button wired to onContinueWithoutMusic', () => {
      expect(choiceSource).toMatch(/onClick=\{onContinueWithoutMusic\}[\s\S]*?Continue Without Music/);
    });
  });
});

describe('ExercisePausedPanel.jsx - "Resume with Music" guest pre-start-music correction (Build 18)', () => {
  it('has no isGuest/onSignIn prop at all - the component signature is exactly ({ onResumeExercise, onResumeWithMusic, showResumeWithMusic })', () => {
    expect(pausedPanelSource).toMatch(/export const ExercisePausedPanel = \(\{ onResumeExercise, onResumeWithMusic, showResumeWithMusic \}\) => \(/);
  });

  it('"Resume with Music" is an unconditional button wired directly to onResumeWithMusic whenever showResumeWithMusic is true - never a Sign In substitute', () => {
    expect(pausedPanelSource).toMatch(/\{showResumeWithMusic && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{onResumeWithMusic\}/);
    const codeOnly = pausedPanelSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/isGuest|onSignIn|Sign In/);
  });

  it('"Resume Exercise" (timer only, no music) is unaffected either way - it sits outside the showResumeWithMusic block entirely', () => {
    const beforeBlock = pausedPanelSource.slice(0, pausedPanelSource.indexOf('{showResumeWithMusic'));
    expect(beforeBlock).toMatch(/onClick=\{onResumeExercise\}/);
  });
});

// Build 15 — MorningFlow.jsx (Stretch), Breathe.jsx (Morning Breathe),
// and EveningBreathing.jsx no longer use MusicEntryChoice's modal-style
// "choose before the timer starts anyway" pattern at all: each now has
// its own pre-start screen with a real, deliberate "Begin" gesture and a
// plain MusicPreferenceToggle switch (not a separate blocking prompt).
// See morningFlowStretchPreStart.test.js and
// breathingPreStart.test.js for that coverage. QuietBreathing.jsx's own
// existing (non-standalone, Support-embedded) usage is unaffected by
// this phase and keeps the exact MusicEntryChoice-gated design tested
// below - see breathingPreStart.test.js for its own new standalone-mode
// coverage.
describe.each([
  ['QuietBreathing.jsx', quietBreathingSource, 'secondsLeft']
])('%s - the entry choice gates the countdown effect itself', (name, source) => {
  it('has its own musicChoiceMade state, defaulting to false on a fresh mount (Breathe/MorningFlow/EveningBreathing seed it from a review-pause snapshot instead, when one exists - see timedExercisePause.js)', () => {
    expect(source).toMatch(/const \[musicChoiceMade, setMusicChoiceMade\] = useState\((?:false|\(\) => Boolean\(pausedSnapshot\?\.musicChoiceMade\))\);/);
  });

  it('awaitingMusicChoice is true only when music is actually eligible AND no choice has been made yet - a screen with no eligible music never blocks its timer', () => {
    expect(source).toMatch(/const awaitingMusicChoice = musicEligible && !musicChoiceMade;/);
  });

  it("the countdown effect's own guard is derived from awaitingMusicChoice (via the shared canRun gate, Build 15 - QuietBreathing.jsx also supports a standalone mode with its own separate hasBegun gate, so canRun = standalone ? hasBegun : !awaitingMusicChoice - non-standalone's own effective behaviour is unchanged: !awaitingMusicChoice alone), and canRun is in that effect's dependency array", () => {
    expect(source).toMatch(/const canRun = standalone \? \(hasBegun && !earlyEnded\) : !awaitingMusicChoice;/);
    expect(source).toMatch(/if \(!canRun\) return;/);
    const depsWithFlag = source.match(/\}, \[[^\]]*canRun[^\]]*\]\);/g) ?? [];
    expect(depsWithFlag.length).toBeGreaterThan(0);
  });

  it('never seeds the choice from a stored preference - musicChoiceMade only ever starts false, exactly like InteractiveAmbientMusic\'s own musicEnabled', () => {
    expect(source).not.toMatch(/useState\(getMusicPreference/);
  });

  it('Start with Music sets the choice AND starts this screen\'s own ambient loop via the same ref-exposed start() Resume-with-Music already uses (or, for the two screens with no paused-panel concept, its own dedicated musicPlayerRef)', () => {
    expect(source).toMatch(/const handleStartWithMusic = \(\) => \{\s*\n\s*setMusicChoiceMade\(true\);\s*\n\s*musicPlayerRef\.current\?\.start\(\);\s*\n\s*\};/);
  });

  it('Continue Without Music only ever sets the choice flag - never touches the ambient player at all', () => {
    const body = source.match(/const handleContinueWithoutMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setMusicChoiceMade\(true\);/);
    expect(body).not.toMatch(/musicPlayerRef|start\(\)/);
  });

  it('renders MusicEntryChoice only while awaitingMusicChoice, wired to both handlers (Breathe/MorningFlow/EveningBreathing also require !isRepeatGated - see reviewMode.test.js\'s own ordering-fix coverage)', () => {
    const block = source.match(/\{(?:!isRepeatGated && )?awaitingMusicChoice && \(\s*\n\s*<MusicEntryChoice[\s\S]*?\/>\s*\n\s*\)\}/)?.[0] ?? '';
    expect(block).toMatch(/onStartWithMusic=\{handleStartWithMusic\}/);
    expect(block).toMatch(/onContinueWithoutMusic=\{handleContinueWithoutMusic\}/);
  });

  it('passes neither isGuest nor onSignIn to MusicEntryChoice (Build 18 guest pre-start-music correction) - a guest reaches the real "Start with Music" attempt exactly like an authenticated user', () => {
    const block = source.match(/<MusicEntryChoice[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).not.toMatch(/isGuest=/);
    expect(block).not.toMatch(/onSignIn=/);
  });
});

describe('MusicEntryChoice.jsx - Anytime Reset Visual Uplift follow-up: accent is additive, default keeps every other caller byte-for-byte unchanged', () => {
  it('accent defaults to primary, whose style is undefined - Breathe.jsx/MorningFlow.jsx/EveningBreathing.jsx (none pass accent) get no inline style at all', () => {
    expect(choiceSource).toMatch(/accent = 'primary'/);
    expect(choiceSource).toMatch(/primary: undefined,/);
  });

  it('the anytime accent supplies a real mint borderColor via inline style (glass-panel\'s own border shorthand would otherwise silently override a Tailwind border-* class)', () => {
    expect(choiceSource).toMatch(/anytime: \{ borderColor: 'rgba\(127, 228, 208, 0\.35\)' \}/);
  });

  it('the anytime accent swaps "Start with Music" to real mint tokens (bg-tertiary/text-on-tertiary), never touching "Continue Without Music" - only the affirmative choice changes, matching MusicPreferenceToggle\'s own ON-track-only convention', () => {
    expect(choiceSource).toMatch(/anytime: 'flex-1 bg-tertiary text-on-tertiary py-3 rounded-full font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-lg'/);
    const continueButtonBlock = choiceSource.match(/onClick=\{onContinueWithoutMusic\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(continueButtonBlock).not.toMatch(/accent|tertiary/);
  });

  it('Breathe.jsx/MorningFlow.jsx/EveningBreathing.jsx no longer render MusicEntryChoice at all (Build 15 - each has its own pre-start screen instead), so none of them can pass accent either', () => {
    for (const source of [breatheSource, morningFlowSource, eveningBreathingSource]) {
      expect(source).not.toMatch(/<MusicEntryChoice/);
    }
  });

  it('QuietBreathing.jsx\'s own non-standalone usage (the real shared Gentle Reset/Support experience) passes accent="anytime"', () => {
    const block = quietBreathingSource.match(/<MusicEntryChoice[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/accent="anytime"/);
  });

  it('QuietBreathing.jsx never renders MusicEntryChoice in its standalone branch at all (standalone uses MusicPreferenceToggle instead) - the mint accent cannot leak into /breathe-standalone through this component', () => {
    const standaloneStart = quietBreathingSource.indexOf('if (standalone) {');
    const standaloneEnd = quietBreathingSource.indexOf('\n  return (\n    <EveningSceneShell', standaloneStart);
    const standaloneBlock = standaloneStart > -1 && standaloneEnd > -1 ? quietBreathingSource.slice(standaloneStart, standaloneEnd) : '';
    expect(standaloneBlock.length).toBeGreaterThan(0);
    expect(standaloneBlock).not.toMatch(/<MusicEntryChoice/);
  });

  it('QuietBreathing.jsx\'s non-standalone intro carries a small decorative mint icon (aria-hidden, no new copy) - BreathingRing immediately below stays unaccented', () => {
    const nonStandaloneBlock = quietBreathingSource.slice(quietBreathingSource.indexOf('\n  return (\n    <EveningSceneShell'));
    expect(nonStandaloneBlock).toMatch(/<span className="material-symbols-outlined text-tertiary text-3xl" aria-hidden="true">air<\/span>/);
    expect(nonStandaloneBlock).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} \/>/);
  });
});

// Build 15 — MorningFlow.jsx/Breathe.jsx no longer have an "awaiting the
// initial choice" state at all (see the describe.each block above) -
// each screen's own ExercisePausedPanel now renders whenever the
// exercise is genuinely interrupted, full stop, since by the time
// hasBegun is true (the only time ExercisePausedPanel can ever render)
// the music preference was already resolved on the pre-start screen.
describe.each([
  ['MorningFlow.jsx', morningFlowSource],
  ['Breathe.jsx', breatheSource]
])('%s - ExercisePausedPanel no longer gated on a music entry choice (Build 15)', (name, source) => {
  it('renders whenever interrupted and no video is open (only once genuinely begun), with no musicChoiceMade/awaitingMusicChoice concept left in the file', () => {
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && isInterrupted && !openVideo && \(\s*\n\s*<ExercisePausedPanel/);
    expect(source).not.toMatch(/musicChoiceMade|awaitingMusicChoice/);
  });

  it('the ordinary manual controls (Pause/Continue or Next Movement/Next Step) are hidden only while genuinely interrupted, not while awaiting any choice (there is none)', () => {
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isInterrupted && !openVideo && \(/);
  });
});

describe.each([
  ['Breathe.jsx', breatheSource],
  ['MorningFlow.jsx', morningFlowSource],
  ['EveningBreathing.jsx', eveningBreathingSource]
])('%s - passes neither isGuest nor onSignIn to ExercisePausedPanel (Build 18 guest pre-start-music correction)', (name, source) => {
  it('the ExercisePausedPanel usage carries only onResumeExercise/onResumeWithMusic/showResumeWithMusic - no isGuest, no onSignIn', () => {
    const block = source.match(/<ExercisePausedPanel[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).not.toMatch(/isGuest=/);
    expect(block).not.toMatch(/onSignIn=/);
    expect(block).toMatch(/onResumeExercise=\{handleResumeExercise\}/);
    expect(block).toMatch(/onResumeWithMusic=\{handleResumeWithMusic\}/);
  });

  it('still imports useAuth - isGuest remains needed elsewhere on this screen (the pre-start seed, and the shared setMusicPreferenceForUser call)', () => {
    expect(source).toMatch(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
  });
});
