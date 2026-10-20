// WakeWise — M01-M05 meditation duration refresh, 2026-10-20. These five
// Storage objects were replaced again (second replacement; see
// reports/m01-m05-replacement-verification-2026-10-20.md for the
// timestamp-correlated ffprobe measurements this test's expected values
// come from) - confirms MEDITATION_METADATA/ANYTIME_RESET_METADATA were
// updated to match, and that M01/M03's now-stale exactGroupFit: false
// flags (set for the PREVIOUS, 2026-10-05 runtimes) were removed rather
// than left incorrectly asserting a shortfall that no longer exists.
import { describe, it, expect } from 'vitest';
import { getMeditationCatalog, getAnytimeResetCatalog, MEDITATION_DURATION_GROUPS } from './mediaCatalog';

const meditationEntry = (id) => getMeditationCatalog().find((e) => e.id === id);
const anytimeResetEntry = (id) => getAnytimeResetCatalog().find((e) => e.id === id);

describe('MEDITATION_METADATA — M01-M05 durations match the 2026-10-20 replacement', () => {
  it.each([
    ['M01', 252],
    ['M02', 254],
    ['M03', 260],
    ['M04', 281],
    ['M05', 275]
  ])('%s has the measured durationSeconds (%i)', (id, expectedSeconds) => {
    expect(meditationEntry(id).meditation.durationSeconds).toBe(expectedSeconds);
  });

  it('all five still land inside the short group (180-300s)', () => {
    const short = MEDITATION_DURATION_GROUPS.find((g) => g.id === 'short');
    for (const id of ['M01', 'M02', 'M03', 'M04', 'M05']) {
      const seconds = meditationEntry(id).meditation.durationSeconds;
      expect(seconds).toBeGreaterThanOrEqual(short.minSeconds);
      expect(seconds).toBeLessThanOrEqual(short.maxSeconds);
      expect(meditationEntry(id).meditation.durationGroup).toBe('short');
    }
  });

  it('M01 and M03 no longer carry exactGroupFit: false - the measured runtime now fits cleanly', () => {
    expect(meditationEntry('M01').meditation.exactGroupFit).not.toBe(false);
    expect(meditationEntry('M03').meditation.exactGroupFit).not.toBe(false);
  });

  it("E27's own, unrelated shortfall is untouched by this refresh", () => {
    expect(meditationEntry('E27').meditation.exactGroupFit).toBe(false);
  });
});

describe('ANYTIME_RESET_METADATA — M01/M03/M05 durations match the 2026-10-20 replacement', () => {
  it.each([
    ['M01', 252.4],
    ['M03', 260.0],
    ['M05', 275.5]
  ])('%s has the measured durationSeconds (%s)', (id, expectedSeconds) => {
    expect(anytimeResetEntry(id).anytimeReset.durationSeconds).toBe(expectedSeconds);
  });

  it('all three still comfortably clear the 330s short cap', () => {
    for (const id of ['M01', 'M03', 'M05']) {
      expect(anytimeResetEntry(id).anytimeReset.durationSeconds).toBeLessThan(330);
    }
  });
});
