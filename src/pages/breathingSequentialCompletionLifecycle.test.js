// Mobile correction #5 — every breathing pattern must follow one
// completion lifecycle. Physical-iPhone defect: after completing a first
// 4-4 pattern, music stopped and Continue appeared correctly; after
// completing a SECOND pattern in the same visit, music kept looping and no
// Continue appeared. Root cause (traced): music was only ever stopped as a
// SIDE EFFECT of the next explicit action (Continue's navigate() unmounting
// InteractiveAmbientMusic, or Back's own explicit stop() in
// handleBackFromActive) - never directly tied to the timer reaching 0. Fix:
// a dedicated effect (mirroring QuietBreathing.jsx's own proven `isComplete`
// -> stop() pattern) stops audio the moment hasFinished becomes true,
// deterministically, on every completion - 1st, 2nd or later - in one
// mount. Source-level regression guard (no DOM rendering in this repo's
// Vitest - see embeddedBreathingContinueLock.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const breatheSource = read('./Breathe.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');
const quietBreathingSource = read('./QuietBreathing.jsx');

describe('Breathe.jsx (Morning) — music stops deterministically on natural completion', () => {
  it('a dedicated effect calls musicPlayerRef.current?.stop() as soon as hasFinished becomes true, independent of Continue/Back', () => {
    expect(breatheSource).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(hasFinished\) musicPlayerRef\.current\?\.stop\(\);\s*\n\s*\}, \[hasFinished\]\);/
    );
  });

  it('this effect is declared before hasBegunOnceRef (i.e. runs for every finish, not gated behind a one-shot ref)', () => {
    const stopEffectIndex = breatheSource.indexOf('if (hasFinished) musicPlayerRef.current?.stop();');
    const hasBegunOnceRefIndex = breatheSource.indexOf('const hasBegunOnceRef = useRef(false);');
    expect(stopEffectIndex).toBeGreaterThan(-1);
    expect(hasBegunOnceRefIndex).toBeGreaterThan(-1);
    expect(stopEffectIndex).toBeLessThan(hasBegunOnceRefIndex);
  });
});

describe('EveningBreathing.jsx (Evening) — same deterministic stop-on-completion effect', () => {
  it('a dedicated effect calls musicPlayerRef.current?.stop() as soon as hasFinished becomes true', () => {
    expect(eveningBreathingSource).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(hasFinished\) musicPlayerRef\.current\?\.stop\(\);\s*\n\s*\}, \[hasFinished\]\);/
    );
  });
});

describe('QuietBreathing.jsx (standalone) — sequential-session guard: Breathe Again always starts from a genuinely clean timer state', () => {
  it('handleBreatheAgain resets secondsLeft and breatheState too, not just hasBegun/earlyEnded - a fresh session for the 2nd/3rd pattern, never a leftover value from the one just finished', () => {
    const fn = quietBreathingSource.match(/const handleBreatheAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/setHasBegun\(false\);/);
    expect(fn).toMatch(/setEarlyEnded\(false\);/);
    expect(fn).toMatch(/setSecondsLeft\(activePattern\.totalSeconds\);/);
    expect(fn).toMatch(/setBreatheState\('Inhale'\);/);
  });

  it('the existing isComplete -> stop() effect (the pattern the embedded fix above mirrors) is unchanged', () => {
    expect(quietBreathingSource).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(isComplete\) musicPlayerRef\.current\?\.stop\(\);\s*\n\s*\}, \[isComplete\]\);/
    );
  });
});

describe('Cross-file consistency — all three breathing screens (embedded Morning/Evening, standalone) now tie their own stop-on-completion to the SAME derived completion signal, no bespoke variant per file', () => {
  it('Breathe.jsx and EveningBreathing.jsx key off hasFinished (secondsLeft <= 0); QuietBreathing.jsx keys off its own isComplete (which already folds in hasBegun/standalone) - both ultimately gated on the timer genuinely reaching 0', () => {
    expect(breatheSource).toMatch(/const hasFinished = secondsLeft <= 0;/);
    expect(eveningBreathingSource).toMatch(/const hasFinished = secondsLeft <= 0;/);
    expect(quietBreathingSource).toMatch(/const isComplete = standalone && hasBegun && secondsLeft <= 0;/);
  });
});
