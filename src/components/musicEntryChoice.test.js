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
});

describe.each([
  ['Breathe.jsx', breatheSource, 'secondsLeft'],
  ['MorningFlow.jsx', morningFlowSource, 'timeLeft'],
  ['EveningBreathing.jsx', eveningBreathingSource, 'secondsLeft'],
  ['QuietBreathing.jsx', quietBreathingSource, 'secondsLeft']
])('%s - the entry choice gates the countdown effect itself', (name, source) => {
  it('has its own musicChoiceMade state, defaulting to false (never true on a fresh mount)', () => {
    expect(source).toMatch(/const \[musicChoiceMade, setMusicChoiceMade\] = useState\(false\);/);
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

  it('renders MusicEntryChoice only while awaitingMusicChoice, wired to both handlers', () => {
    expect(source).toMatch(/\{awaitingMusicChoice && \(\s*\n\s*<MusicEntryChoice onStartWithMusic=\{handleStartWithMusic\} onContinueWithoutMusic=\{handleContinueWithoutMusic\} \/>\s*\n\s*\)\}/);
  });
});

describe('Breathe.jsx / MorningFlow.jsx - the entry choice and ExercisePausedPanel never both apply to the same interruption', () => {
  for (const [name, source] of [['Breathe.jsx', breatheSource], ['MorningFlow.jsx', morningFlowSource]]) {
    it(`${name}: ExercisePausedPanel only renders once musicChoiceMade is already true - a video opened before the initial choice resolves back to the choice on close, never the panel`, () => {
      expect(source).toMatch(/\{musicChoiceMade && videoOpenedDuringExercise && !openVideo && \(\s*\n\s*<ExercisePausedPanel/);
    });

    it(`${name}: the ordinary manual controls (Pause/Continue or Next Step) are also hidden while awaiting the initial choice, not just while the paused panel shows`, () => {
      expect(source).toMatch(/&& !awaitingMusicChoice && \(/);
    });
  }
});
