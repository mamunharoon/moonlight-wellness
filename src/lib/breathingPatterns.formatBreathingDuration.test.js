// F7 (pre-Build-15 usability pass) — real-execution behavioural test for
// formatBreathingDuration (the compact breathing-card duration format,
// "56 sec" / "1 min"). Pure function, genuinely executable with real
// values - unlike the React component files in this repo (environment:
// 'node' in vite.config.js has no DOM), this one needs no source-string
// workaround.
//
// Correction (acceptance review) — the first version rounded a non-exact
// minute count to "~N mins" (mirroring formatTotalDuration). Checked
// against the real registry: `evening` (4-7-8) is 76s, genuinely 16s
// (≈27%) longer than the "~1 min" that produced - not a cosmetic
// difference. This now never approximates: any total that is not an
// exact whole number of minutes shows its real, exact second count
// instead, no "~" prefix, ever.
import { describe, it, expect } from 'vitest';
import { formatBreathingDuration } from './breathingPatterns';
import { BREATHING_PATTERNS } from './breathingPatterns';

describe('formatBreathingDuration — real execution', () => {
  it('under a minute: "N sec"', () => {
    expect(formatBreathingDuration(56)).toBe('56 sec');
    expect(formatBreathingDuration(1)).toBe('1 sec');
    expect(formatBreathingDuration(59)).toBe('59 sec');
  });

  it('exact whole minutes: "N min"/"N mins"', () => {
    expect(formatBreathingDuration(60)).toBe('1 min');
    expect(formatBreathingDuration(120)).toBe('2 mins');
  });

  it('non-exact minutes (over 60s but not a clean multiple): exact seconds, never rounded, never a "~" prefix', () => {
    expect(formatBreathingDuration(75)).toBe('75 sec');
    expect(formatBreathingDuration(76)).toBe('76 sec');
    expect(formatBreathingDuration(150)).toBe('150 sec');
    expect(formatBreathingDuration(64)).toBe('64 sec');
  });

  it('never produces a "~" character for any input', () => {
    for (let s = 1; s <= 200; s++) {
      expect(formatBreathingDuration(s)).not.toMatch(/~/);
    }
  });

  it('every real BREATHING_PATTERNS totalSeconds value formats without throwing and matches the approved shape (exact seconds or exact minutes, never approximate)', () => {
    for (const pattern of BREATHING_PATTERNS) {
      const formatted = formatBreathingDuration(pattern.totalSeconds);
      expect(formatted).toMatch(/^\d+ (sec|mins?)$/);
    }
  });

  it('every real BREATHING_PATTERNS total, matched exactly against the current registry - proves which patterns are genuinely exact minutes vs. which correctly fall back to seconds', () => {
    const byId = Object.fromEntries(BREATHING_PATTERNS.map((p) => [p.id, p.totalSeconds]));
    expect(byId.morning).toBe(56);
    expect(byId.evening).toBe(76);
    expect(byId.quiet).toBe(64);
    expect(byId.box).toBe(64);
    expect(byId.coherent).toBe(60);

    expect(formatBreathingDuration(byId.morning)).toBe('56 sec');
    expect(formatBreathingDuration(byId.evening)).toBe('76 sec');
    expect(formatBreathingDuration(byId.quiet)).toBe('64 sec');
    expect(formatBreathingDuration(byId.box)).toBe('64 sec');
    expect(formatBreathingDuration(byId.coherent)).toBe('1 min');
  });
});
