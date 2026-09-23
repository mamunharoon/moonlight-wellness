// Phase 3 (Reflection/Gratitude tap-first redesign) — real, executable
// unit tests for the shared `?q=` question-index parser (genuine
// execution against a real URLSearchParams, not source-level regex - this
// logic is pure/importable, matching this codebase's own precedent of
// preferring real execution wherever that's possible - see
// morningStretchSkipDefectFix.test.js).
import { describe, it, expect } from 'vitest';
import { parseActiveIndex } from './questionStepNavigation';

const paramsFor = (q) => new URLSearchParams(q === undefined ? '' : `q=${q}`);

describe('parseActiveIndex - allowlisted, safe-fallback question index', () => {
  it('a missing q param resolves to the first question (index 0)', () => {
    expect(parseActiveIndex(paramsFor(undefined), 3)).toBe(0);
  });

  it('q=1 resolves to index 0, q=2 to index 1, q=3 to index 2 (1-indexed in the URL, 0-indexed internally)', () => {
    expect(parseActiveIndex(paramsFor(1), 3)).toBe(0);
    expect(parseActiveIndex(paramsFor(2), 3)).toBe(1);
    expect(parseActiveIndex(paramsFor(3), 3)).toBe(2);
  });

  it('q=0 and any negative value fall back to index 0, never a negative or out-of-bounds index', () => {
    expect(parseActiveIndex(paramsFor(0), 3)).toBe(0);
    expect(parseActiveIndex(paramsFor(-1), 3)).toBe(0);
  });

  it('a q beyond the actual prompt count falls back to index 0, never an undefined prompt', () => {
    expect(parseActiveIndex(paramsFor(4), 3)).toBe(0);
    expect(parseActiveIndex(paramsFor(999), 3)).toBe(0);
  });

  it('a non-numeric, fractional, or otherwise malformed q falls back to index 0 without throwing', () => {
    expect(parseActiveIndex(paramsFor('abc'), 3)).toBe(0);
    expect(parseActiveIndex(paramsFor('1.5'), 3)).toBe(0);
    expect(parseActiveIndex(paramsFor(''), 3)).toBe(0);
    expect(parseActiveIndex(paramsFor('2abc'), 3)).toBe(0);
  });

  it('respects a smaller prompt count (e.g. a 3-question section) the same way for both Reflection and Gratitude', () => {
    expect(parseActiveIndex(paramsFor(3), 3)).toBe(2);
    expect(parseActiveIndex(paramsFor(4), 3)).toBe(0);
  });
});
