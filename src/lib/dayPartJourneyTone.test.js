import { describe, it, expect } from 'vitest';
import { currentDaypartJourneyTone } from './dayPartJourneyTone';

// This repo's devClock.js (used internally by currentDaypartJourneyTone
// via getZonedParts/now) reads a DEV-only sessionStorage offset key when
// import.meta.env.DEV is true (which it is under Vitest) - the same
// established test seam used elsewhere in this app (see AlarmActive.jsx
// itself, and any test exercising real "now" logic).
class MemoryStorage {
  #store = new Map();
  getItem(key) { return this.#store.has(key) ? this.#store.get(key) : null; }
  setItem(key, value) { this.#store.set(key, String(value)); }
  removeItem(key) { this.#store.delete(key); }
}
globalThis.sessionStorage = new MemoryStorage();

const setClockToUtcHour = (hour) => {
  // A fixed reference instant, offset so effectiveTimezone 'UTC' reports
  // exactly `hour`:00 - deterministic regardless of when this test runs.
  const now = new Date();
  const target = new Date(Date.UTC(2026, 0, 1, hour, 0, 0));
  globalThis.sessionStorage.setItem('__wakewise_dev_clock_offset_ms', String(target.getTime() - now.getTime()));
};

describe('currentDaypartJourneyTone — safe last-resort fallback bands', () => {
  it('before 12:00 -> morning', () => {
    setClockToUtcHour(6);
    expect(currentDaypartJourneyTone('UTC')).toBe('morning');
  });

  it('12:00-17:59 -> anytime', () => {
    setClockToUtcHour(14);
    expect(currentDaypartJourneyTone('UTC')).toBe('anytime');
  });

  it('18:00 and later -> evening', () => {
    setClockToUtcHour(20);
    expect(currentDaypartJourneyTone('UTC')).toBe('evening');
  });

  it('always resolves to one of the three real tones, never null/undefined', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      setClockToUtcHour(hour);
      expect(['morning', 'anytime', 'evening']).toContain(currentDaypartJourneyTone('UTC'));
    }
  });
});
