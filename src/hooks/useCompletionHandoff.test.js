// Physical-iPhone completion-transition-tuning pass — source-level
// regression guard for useCompletionHandoff.js, matching this repo's
// established convention for React hooks with no DOM rendering available
// (see usePracticeJourneyTone.test.js's own identical note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useCompletionHandoff.js', import.meta.url)), 'utf-8');

describe('useCompletionHandoff — purely additive, never touches isCompleted or persistence/cleanup', () => {
  it('never imports or references recordPracticeCompletion/practiceCompletions - this hook only ever controls which JSX branch renders, never any side effect', () => {
    expect(source).not.toMatch(/recordPracticeCompletion|practiceCompletions/);
  });

  it('takes isCompleted and audioReady (defaulting to true) as its only arguments - never receives or calls a setter for either, so the caller\'s own isCompleted state and its timing are completely untouched', () => {
    expect(source).toMatch(/export const useCompletionHandoff = \(isCompleted, audioReady = true\) => \{/);
    expect(source).not.toMatch(/setIsCompleted/);
    expect(source).not.toMatch(/setAudioReady/);
  });
});

describe('useCompletionHandoff — the hold -> exit-fade -> revealed sequence', () => {
  it('HOLD_MS is retuned by the B67 device-feedback pass (150 -> 50) to fit the new ~600-800ms combined target - shortened rather than removed, so the fade never looks like it interrupts the final active frame mid-motion', () => {
    expect(source).toMatch(/const HOLD_MS = 50;/);
  });

  it('EXIT_FADE_MS is unchanged by the B67 pass (stays 250) - long enough alone to read as a genuine fade, not a cut', () => {
    expect(source).toMatch(/const EXIT_FADE_MS = 250;/);
  });

  it('the hold timer transitions phase to \'exiting\' only after HOLD_MS, and only when genuinely completed, audio is ready, and motion is not reduced', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isCompleted \|\| reducedMotion \|\| !audioReady\) return;[\s\S]*?\n {2}\}, \[isCompleted, reducedMotion, audioReady\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/const holdTimer = setTimeout\(\(\) => setPhase\('exiting'\), HOLD_MS\);/);
    expect(body).toMatch(/return \(\) => clearTimeout\(holdTimer\);/);
  });

  it('a second effect fades from \'exiting\' to \'revealed\' only after EXIT_FADE_MS, properly cleaned up', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(phase !== 'exiting'\) return;[\s\S]*?\n {2}\}, \[phase\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/const fadeTimer = setTimeout\(\(\) => setPhase\('revealed'\), EXIT_FADE_MS\);/);
    expect(body).toMatch(/return \(\) => clearTimeout\(fadeTimer\);/);
  });
});

describe('useCompletionHandoff — Reduced Motion skips the hold and exit-fade entirely, but never skips waiting for audio', () => {
  it('reduced motion is detected via the same established try/catch pattern as every other screen, captured once at mount', () => {
    expect(source).toMatch(/Boolean\(getReducedMotionPreference\(\) \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/);
    expect(source).toMatch(/const \[reducedMotion\] = useState\(detectReducedMotion\);/);
  });

  it('effectivePhase resolves straight to \'revealed\' under reduced motion only once BOTH isCompleted and audioReady are true - no hold, no exit-fade, no stagger of its own, but still gated on audio', () => {
    expect(source).toMatch(/const effectivePhase = !isCompleted \|\| !audioReady \? 'active' : reducedMotion \? 'revealed' : phase;/);
  });
});

describe('useCompletionHandoff — a second completion in the same mount (Play Again/Breathe again) never inherits a stale phase', () => {
  it('phase resets to \'active\' synchronously at the start of every fresh (isCompleted && !reducedMotion && audioReady) cycle, before scheduling the hold timer', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isCompleted \|\| reducedMotion \|\| !audioReady\) return;[\s\S]*?\n {2}\}, \[isCompleted, reducedMotion, audioReady\]\);/)?.[0] ?? '';
    const resetIdx = effectBody.indexOf("setPhase('active')");
    const holdIdx = effectBody.indexOf('setTimeout');
    expect(resetIdx).toBeGreaterThan(-1);
    expect(holdIdx).toBeGreaterThan(resetIdx);
  });

  it('whenever isCompleted is false, effectivePhase is always \'active\' regardless of whatever the internal phase state happens to still hold from a previous cycle', () => {
    expect(source).toMatch(/const effectivePhase = !isCompleted \|\| !audioReady \? 'active' : /);
  });
});

// Coordinated audio/visual handoff — a caller now passes audioReady
// (fed by useAudioFadeHandoff.js or useMeditationSession.js's own identical
// mechanism) so the hold -> exit-fade -> reveal sequence genuinely cannot
// start until music has actually reached silence (or the bounded fallback
// elapsed) - not merely survives a later unmount, which does not prove this
// ordering.
describe('useCompletionHandoff — coordinated audio/visual handoff: the reveal sequence waits for audioReady', () => {
  it('defaults audioReady to true - a caller with no music/no fade concept (or every pre-existing single-argument call site) sees zero behaviour change', () => {
    expect(source).toMatch(/export const useCompletionHandoff = \(isCompleted, audioReady = true\) => \{/);
  });

  it('isCompleted alone is never sufficient to start the hold timer - audioReady must also be true', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isCompleted \|\| reducedMotion \|\| !audioReady\) return;[\s\S]*?\n {2}\}, \[isCompleted, reducedMotion, audioReady\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
  });

  it('while isCompleted is true but audioReady is false, effectivePhase stays \'active\' regardless of reducedMotion - the outgoing view stays fully stable until audio catches up', () => {
    // effectivePhase = !isCompleted || !audioReady ? 'active' : ... - the
    // reducedMotion branch is only ever reached once audioReady is true.
    const effectivePhaseLine = source.match(/const effectivePhase = [^\n]+/)?.[0] ?? '';
    const audioGateIdx = effectivePhaseLine.indexOf('!audioReady');
    const reducedMotionIdx = effectivePhaseLine.indexOf('reducedMotion ?');
    expect(audioGateIdx).toBeGreaterThan(-1);
    expect(reducedMotionIdx).toBeGreaterThan(audioGateIdx);
  });
});

describe('useCompletionHandoff — return shape', () => {
  it('returns showActiveView/activeViewExiting/showCompletionPanel, all derived from the single effectivePhase value - never three independent, potentially-inconsistent state variables', () => {
    expect(source).toMatch(/showActiveView: effectivePhase !== 'revealed',/);
    expect(source).toMatch(/activeViewExiting: effectivePhase === 'exiting',/);
    expect(source).toMatch(/showCompletionPanel: effectivePhase === 'revealed'/);
  });
});
