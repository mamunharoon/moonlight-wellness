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

  // Build 11 RC fix: a guest tapping "Start with Music" used to reach
  // InteractiveAmbientMusic's own start() - which cannot succeed for a
  // guest - and land on its generic "Music unavailable right now"
  // failure copy, indistinguishable from a real loading/network error.
  // isGuest replaces the attempt with a direct, honest "Sign In" state
  // instead. Guest authorization/media access itself is unchanged - a
  // guest still cannot play the music - only what they're told changes.
  describe('guest lock state (Build 11 RC fix)', () => {
    it('defaults isGuest to false - every existing non-guest caller (none of which pass it) keeps today\'s exact behaviour', () => {
      expect(choiceSource).toMatch(/isGuest = false/);
    });

    it('shows the exact required "Sign in to use background music." copy for a guest instead of the ordinary subtitle', () => {
      expect(choiceSource).toMatch(/isGuest \? 'Sign in to use background music\.' : 'You can switch it off at any time\.'/);
    });

    it('replaces the "Start with Music" button with "Sign In" for a guest - never renders onStartWithMusic as reachable for one', () => {
      const block = choiceSource.match(/\{isGuest \? \([\s\S]*?\) : \([\s\S]*?\)\}/)?.[0] ?? '';
      expect(block).toMatch(/onClick=\{onSignIn\}[\s\S]*?Sign In/);
      expect(block).toMatch(/onClick=\{onStartWithMusic\}[\s\S]*?Start with Music/);
    });

    it('"Continue Without Music" is unaffected either way - it sits outside the isGuest branch', () => {
      expect(choiceSource).toMatch(/onClick=\{onContinueWithoutMusic\}[\s\S]*?Continue Without Music/);
      const beforeBranch = choiceSource.slice(0, choiceSource.indexOf('{isGuest ?'));
      expect(beforeBranch).toMatch(/onContinueWithoutMusic/);
    });

    it('never calls onStartWithMusic when isGuest is true - the two are mutually exclusive branches, not a fallback', () => {
      const guestBranch = choiceSource.match(/isGuest \? \(([\s\S]*?)\) : \(/)?.[1] ?? '';
      expect(guestBranch).not.toMatch(/onStartWithMusic/);
    });
  });
});

describe('ExercisePausedPanel.jsx - "Resume with Music" has the same guest lock state (Build 11 RC fix)', () => {
  it('defaults isGuest to false - every existing non-guest caller keeps today\'s exact behaviour', () => {
    expect(pausedPanelSource).toMatch(/isGuest = false/);
  });

  it('replaces "Resume with Music" with a Sign In action for a guest, only when the button would otherwise show at all', () => {
    const block = pausedPanelSource.match(/\{showResumeWithMusic && \(\s*\n\s*isGuest \? \(([\s\S]*?)\) : \(([\s\S]*?)\)\s*\n\s*\)\}/);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/onClick=\{onSignIn\}/);
    expect(block[1]).not.toMatch(/onResumeWithMusic/);
    expect(block[2]).toMatch(/onClick=\{onResumeWithMusic\}/);
  });

  it('"Resume Exercise" (timer only, no music) is unaffected either way - it sits outside the showResumeWithMusic block entirely', () => {
    const beforeBlock = pausedPanelSource.slice(0, pausedPanelSource.indexOf('{showResumeWithMusic'));
    expect(beforeBlock).toMatch(/onClick=\{onResumeExercise\}/);
  });
});

describe.each([
  ['Breathe.jsx', breatheSource, 'secondsLeft'],
  ['MorningFlow.jsx', morningFlowSource, 'timeLeft'],
  ['EveningBreathing.jsx', eveningBreathingSource, 'secondsLeft'],
  ['QuietBreathing.jsx', quietBreathingSource, 'secondsLeft']
])('%s - the entry choice gates the countdown effect itself', (name, source) => {
  it('has its own musicChoiceMade state, defaulting to false on a fresh mount (Breathe/MorningFlow/EveningBreathing seed it from a review-pause snapshot instead, when one exists - see timedExercisePause.js)', () => {
    expect(source).toMatch(/const \[musicChoiceMade, setMusicChoiceMade\] = useState\((?:false|\(\) => Boolean\(pausedSnapshot\?\.musicChoiceMade\))\);/);
  });

  it('awaitingMusicChoice is true only when music is actually eligible AND no choice has been made yet - a screen with no eligible music never blocks its timer', () => {
    expect(source).toMatch(/const awaitingMusicChoice = musicEligible && !musicChoiceMade;/);
  });

  it("the countdown effect's own guard includes awaitingMusicChoice, and it's in that effect's dependency array", () => {
    const guardLine = source.match(/if \([^)]*awaitingMusicChoice[^)]*\) return;/);
    expect(guardLine).not.toBeNull();
    const depsWithFlag = source.match(/\}, \[[^\]]*awaitingMusicChoice[^\]]*\]\);/g) ?? [];
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

  it('passes isGuest and a sign-in handler to MusicEntryChoice - a guest never reaches the entry-choice "Start with Music" attempt (Build 11 RC guest-music-wording fix)', () => {
    const block = source.match(/<MusicEntryChoice[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/isGuest=\{isGuest\}/);
    expect(block).toMatch(/onSignIn=\{confirmSignIn(ForMusic)?\}/);
  });
});

describe('Breathe.jsx / MorningFlow.jsx - the entry choice and ExercisePausedPanel never both apply to the same interruption', () => {
  for (const [name, source] of [['Breathe.jsx', breatheSource], ['MorningFlow.jsx', morningFlowSource]]) {
    it(`${name}: ExercisePausedPanel only renders once musicChoiceMade is already true - an interruption (video or manual pause) before the initial choice resolves back to the choice on close, never the panel`, () => {
      expect(source).toMatch(/\{musicChoiceMade && isInterrupted && !openVideo && \(\s*\n\s*<ExercisePausedPanel/);
    });

    it(`${name}: the ordinary manual controls (Pause/Continue or Next Step) are also hidden while awaiting the initial choice, not just while the paused panel shows`, () => {
      expect(source).toMatch(/&& !awaitingMusicChoice && \(/);
    });
  }
});

describe.each([
  ['Breathe.jsx', breatheSource],
  ['MorningFlow.jsx', morningFlowSource],
  ['EveningBreathing.jsx', eveningBreathingSource]
])('%s - passes isGuest and a sign-in handler to ExercisePausedPanel too (Build 11 RC guest-music-wording fix)', (name, source) => {
  it('the ExercisePausedPanel usage is wired with isGuest and onSignIn', () => {
    const block = source.match(/<ExercisePausedPanel[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/isGuest=\{isGuest\}/);
    expect(block).toMatch(/onSignIn=\{confirmSignIn(ForMusic)?\}/);
  });

  it('imports useAuth to source isGuest', () => {
    expect(source).toMatch(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
  });
});
