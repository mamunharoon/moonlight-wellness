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

  it('takes isCompleted as its only argument - never receives or calls a setter for it, so the caller\'s own isCompleted state and its timing are completely untouched', () => {
    expect(source).toMatch(/export const useCompletionHandoff = \(isCompleted\) => \{/);
    expect(source).not.toMatch(/setIsCompleted/);
  });
});

describe('useCompletionHandoff — the hold -> exit-fade -> revealed sequence', () => {
  it('HOLD_MS is within the approved ~150-250ms range, retuned to its low end by the completion-transition refinement pass (200 -> 150) to keep the combined sequence inside the newly-approved ~1.1-1.4s target', () => {
    expect(source).toMatch(/const HOLD_MS = 150;/);
  });

  it('EXIT_FADE_MS is retuned by the same pass (350 -> 250)', () => {
    expect(source).toMatch(/const EXIT_FADE_MS = 250;/);
  });

  it('the hold timer transitions phase to \'exiting\' only after HOLD_MS, and only when genuinely completed and motion is not reduced', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isCompleted \|\| reducedMotion\) return;[\s\S]*?\n {2}\}, \[isCompleted, reducedMotion\]\);/)?.[0] ?? '';
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

describe('useCompletionHandoff — Reduced Motion skips the hold and exit-fade entirely', () => {
  it('reduced motion is detected via the same established try/catch pattern as every other screen, captured once at mount', () => {
    expect(source).toMatch(/Boolean\(getReducedMotionPreference\(\) \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/);
    expect(source).toMatch(/const \[reducedMotion\] = useState\(detectReducedMotion\);/);
  });

  it('effectivePhase resolves straight to \'revealed\' under reduced motion whenever isCompleted is true - no hold, no exit-fade, no stagger of its own', () => {
    expect(source).toMatch(/const effectivePhase = !isCompleted \? 'active' : reducedMotion \? 'revealed' : phase;/);
  });
});

describe('useCompletionHandoff — a second completion in the same mount (Play Again/Breathe again) never inherits a stale phase', () => {
  it('phase resets to \'active\' synchronously at the start of every fresh (isCompleted && !reducedMotion) cycle, before scheduling the hold timer', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isCompleted \|\| reducedMotion\) return;[\s\S]*?\n {2}\}, \[isCompleted, reducedMotion\]\);/)?.[0] ?? '';
    const resetIdx = effectBody.indexOf("setPhase('active')");
    const holdIdx = effectBody.indexOf('setTimeout');
    expect(resetIdx).toBeGreaterThan(-1);
    expect(holdIdx).toBeGreaterThan(resetIdx);
  });

  it('whenever isCompleted is false, effectivePhase is always \'active\' regardless of whatever the internal phase state happens to still hold from a previous cycle', () => {
    expect(source).toMatch(/const effectivePhase = !isCompleted \? 'active' : /);
  });
});

describe('useCompletionHandoff — return shape', () => {
  it('returns showActiveView/activeViewExiting/showCompletionPanel, all derived from the single effectivePhase value - never three independent, potentially-inconsistent state variables', () => {
    expect(source).toMatch(/showActiveView: effectivePhase !== 'revealed',/);
    expect(source).toMatch(/activeViewExiting: effectivePhase === 'exiting',/);
    expect(source).toMatch(/showCompletionPanel: effectivePhase === 'revealed'/);
  });
});
