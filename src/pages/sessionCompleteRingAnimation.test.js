// WakeWise Phase 3B (3B.1) — Morning completion ring animates from empty to
// full only on a genuine fresh natural completion, stays static at 100% on
// a revisit/refresh or when Reduced Motion is on, and never replays.
// Source-level checks only - no DOM rendering in this repo's Vitest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SessionComplete.jsx', import.meta.url)), 'utf-8');

describe('SessionComplete.jsx — completion-ring animation (3B.1)', () => {
  it('captures isFreshCompletion once, before the mount effect can flip state.status away from "playing"', () => {
    const isFreshIdx = source.indexOf('const [isFreshCompletion] = useState(() => state.status === \'playing\');');
    const effectIdx = source.indexOf("if (state.status === 'playing' && currentStep?.id === 'complete')");
    expect(isFreshIdx).toBeGreaterThanOrEqual(0);
    expect(effectIdx).toBeGreaterThan(isFreshIdx);
  });

  it('resolves reducedMotion via the same OS-or-manual-preference snapshot used elsewhere in this app', () => {
    expect(source).toMatch(/import \{ getReducedMotionPreference \} from '\.\.\/lib\/reducedMotionPreference';/);
    expect(source).toMatch(/return Boolean\(getReducedMotionPreference\(\) \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/);
  });

  it('ringFilled starts already-true (no animation) whenever it is not a fresh completion, or Reduced Motion is on', () => {
    expect(source).toMatch(/const \[ringFilled, setRingFilled\] = useState\(\(\) => !isFreshCompletion \|\| reducedMotion\);/);
  });

  it('the fill is triggered exactly once via a one-shot effect with an empty dependency array - never re-armed, never replays', () => {
    const effectBlock = source.slice(source.indexOf('if (ringFilled) return;') - 20, source.indexOf('if (ringFilled) return;') + 800);
    expect(effectBlock).toMatch(/setTimeout\(\(\) => setRingFilled\(true\), 80\)/);
    expect(effectBlock).toMatch(/\}, \[\]\);/);
  });

  it('the SVG circle drives both strokeDasharray and strokeDashoffset from the one shared RING_CIRCUMFERENCE constant, never a second hardcoded number', () => {
    expect(source).toMatch(/const RING_CIRCUMFERENCE = 276\.46;/);
    expect(source).toMatch(/strokeDasharray=\{RING_CIRCUMFERENCE\}/);
    expect(source).toMatch(/strokeDashoffset=\{ringFilled \? 0 : RING_CIRCUMFERENCE\}/);
  });

  it('the CSS transition is only attached when this is a fresh completion with Reduced Motion off - a revisit or Reduced Motion gets no transition property at all', () => {
    expect(source).toMatch(/style=\{isFreshCompletion && !reducedMotion \? \{ transition: 'stroke-dashoffset 900ms ease-out' \} : undefined\}/);
  });

  it('the transition duration stays short/calm (under 1.5s), not a long or looping animation', () => {
    const match = source.match(/stroke-dashoffset (\d+)ms/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBeLessThanOrEqual(1500);
  });

  it('does not touch the completion-record write path (handleReturnHome/shouldWriteCompletionDate) or navigation', () => {
    expect(source).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(morningDoneKey\), attributionDateKey\)/);
    expect(source).toMatch(/navigate\('\/'\);/);
  });
});
