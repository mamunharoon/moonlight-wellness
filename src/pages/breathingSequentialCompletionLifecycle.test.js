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

// Morning breathing completion correction (superseding the fix above for
// Breathe.jsx only) — physical-iPhone testing later found even the FIRST
// pattern could hang at 0s left with no completion panel. Root cause: the
// dedicated stop() effect above still relied on a render-time-DERIVED
// hasFinished value, and completion itself was never a single,
// authoritative decision. Breathe.jsx now uses createBreathingSession
// (breathingSession.js) - see breathingCompletionLifecycle.test.js for
// the full, dedicated coverage of that rewrite.
//
// Evening Breathing completion correction — EveningBreathing.jsx is now
// upgraded identically (the exact same defect class, found live, fixed
// the exact same way - stopBreathingInterval() called synchronously
// inside the completion-detecting interval callback itself, see
// eveningBreathingCompletionLifecycle.test.js for the full, dedicated
// coverage). QuietBreathing.jsx (Anytime/standalone) is unchanged, out of
// scope for both passes - its own describe block below still holds.
describe('Breathe.jsx (Morning) — superseded by the Morning breathing completion correction, see breathingCompletionLifecycle.test.js', () => {
  it('no longer has a separate hasFinished-keyed stop effect - music now stops synchronously inside the completion-detecting interval callback itself (see breathingCompletionLifecycle.test.js)', () => {
    expect(breatheSource).not.toMatch(/const hasFinished = secondsLeft <= 0;/);
    expect(breatheSource).not.toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(hasFinished\) musicPlayerRef\.current\?\.stop\(\);\s*\n\s*\}, \[hasFinished\]\);/
    );
    expect(breatheSource).toMatch(/const \{ completed, secondsLeft: nextSecondsLeft, breatheState: nextBreatheState \} = current\.tick\(\);/);
  });
});

describe('EveningBreathing.jsx (Evening) — superseded by the Evening Breathing completion correction, see eveningBreathingCompletionLifecycle.test.js', () => {
  it('no longer has a separate hasFinished-keyed stop effect - music now stops synchronously inside the completion-detecting interval callback itself', () => {
    expect(eveningBreathingSource).not.toMatch(/const hasFinished = secondsLeft <= 0;/);
    expect(eveningBreathingSource).not.toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(hasFinished\) musicPlayerRef\.current\?\.stop\(\);\s*\n\s*\}, \[hasFinished\]\);/
    );
    expect(eveningBreathingSource).toMatch(/const \{ completed, secondsLeft: nextSecondsLeft, breatheState: nextBreatheState \} = current\.tick\(\);/);
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

describe('Cross-file consistency — QuietBreathing.jsx (Anytime/standalone) still keys off its own derived completion signal; Breathe.jsx and EveningBreathing.jsx were both upgraded to the explicit, authoritative isCompleted state (Morning breathing completion correction, then Evening Breathing completion correction)', () => {
  it('QuietBreathing.jsx keys off its own isComplete (which already folds in hasBegun/standalone) - unchanged, out of scope for both passes; Breathe.jsx and EveningBreathing.jsx now key off the explicit isCompleted state set inside their own completion-detecting interval callback', () => {
    expect(quietBreathingSource).toMatch(/const isComplete = standalone && hasBegun && secondsLeft <= 0;/);
    expect(breatheSource).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
    expect(breatheSource).not.toMatch(/const hasFinished = secondsLeft <= 0;/);
    expect(eveningBreathingSource).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
    expect(eveningBreathingSource).not.toMatch(/const hasFinished = secondsLeft <= 0;/);
  });
});
