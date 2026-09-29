// Timezone persistence correction, part 3 — focused regression coverage
// for the pure timezone primitives lib/timezone.js exposes (this file had
// no dedicated test of its own before this pass). Real execution against
// the actual platform Intl APIs - no mocking of the date-math itself,
// since these are exactly the functions every greeting/reminder/daily-
// completion/Momentum calculation in this app ultimately depends on being
// correct, and the whole point of the fix is that saving a timezone must
// never regress them.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectDeviceTimezone, isValidTimezone, getZonedParts, COMMON_TIMEZONES } from './timezone';

describe('detectDeviceTimezone - relays whatever the platform Intl API resolves, for either reported hemisphere', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Australia/Sydney when that is what the platform resolves', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Australia/Sydney' })
    });
    expect(detectDeviceTimezone()).toBe('Australia/Sydney');
  });

  it('returns Asia/Dhaka when that is what the platform resolves - the same function, unmodified, correctly handles both the Sydney tester\'s and the Bangladesh tester\'s real device zones', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Dhaka' })
    });
    expect(detectDeviceTimezone()).toBe('Asia/Dhaka');
  });

  it('falls back to UTC, never throws, if the platform API itself throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl unavailable');
    });
    expect(() => detectDeviceTimezone()).not.toThrow();
    expect(detectDeviceTimezone()).toBe('UTC');
  });
});

describe('isValidTimezone - the one real IANA validator every save path gates on', () => {
  it('accepts both real-world reproduction zones from the confirmed defect', () => {
    expect(isValidTimezone('Australia/Sydney')).toBe(true);
    expect(isValidTimezone('Asia/Dhaka')).toBe(true);
  });

  it('accepts every zone in the curated manual-picker list - COMMON_TIMEZONES can never offer an entry the validator would then reject', () => {
    for (const { id } of COMMON_TIMEZONES) {
      expect(isValidTimezone(id)).toBe(true);
    }
  });

  it('rejects invalid timezone strings safely - never throws, always returns a plain false', () => {
    for (const bad of ['Not/A/Real/Zone', 'Sydney', 'GMT+10', '', '   ', null, undefined, 42, {}]) {
      expect(() => isValidTimezone(bad)).not.toThrow();
      expect(isValidTimezone(bad)).toBe(false);
    }
  });
});

describe('getZonedParts - Australia/Sydney genuinely observes a daylight-saving boundary via real IANA rules, never a fixed UTC offset', () => {
  // Real execution, verified live against the actual platform Intl data
  // for 2026: Sydney is GMT+10 (AEST) through 2026-10-03T15:00:00Z (01:00
  // local) and GMT+11 (AEDT) from 2026-10-04T15:00:00Z (02:00 local)
  // onward - the first Sunday in October, the real, documented AEST->AEDT
  // transition. A fixed-offset implementation would show the identical
  // local hour 24 hours apart; the real IANA rule does not.
  it('the same UTC hour, exactly 24 hours apart, resolves to a DIFFERENT Sydney local hour across the real October 2026 AEST->AEDT transition', () => {
    const beforeTransition = getZonedParts('Australia/Sydney', new Date('2026-10-03T15:00:00.000Z'));
    const afterTransition = getZonedParts('Australia/Sydney', new Date('2026-10-04T15:00:00.000Z'));
    expect(beforeTransition.hm).toBe('01:00');
    expect(afterTransition.hm).toBe('02:00');
    // 24 real hours apart in UTC, yet the local wall-clock hour advanced by
    // 2 - one hour for the real day boundary, plus one for DST itself.
    expect(afterTransition.hour - beforeTransition.hour).toBe(1);
  });

  it('deep Southern-hemisphere summer (January) and deep winter (July) of the same year resolve to a different UTC-relative offset for Sydney - genuine seasonal DST, not a year-round constant', () => {
    const summer = getZonedParts('Australia/Sydney', new Date('2026-01-15T00:00:00.000Z'));
    const winter = getZonedParts('Australia/Sydney', new Date('2026-07-15T00:00:00.000Z'));
    // Same UTC instant-of-day (midnight), different local hour - proves the
    // effective offset genuinely changed between the two dates.
    expect(summer.hour).not.toBe(winter.hour);
  });
});

describe('getZonedParts - Asia/Dhaka never observes daylight saving, across the same real dates', () => {
  it('the exact same UTC instants used for the Sydney DST-boundary test above resolve to the SAME Dhaka local hour on both sides - no transition exists', () => {
    const beforeTransition = getZonedParts('Asia/Dhaka', new Date('2026-10-03T15:00:00.000Z'));
    const afterTransition = getZonedParts('Asia/Dhaka', new Date('2026-10-04T15:00:00.000Z'));
    expect(beforeTransition.hm).toBe(afterTransition.hm);
  });

  it('January and July of the same year resolve to the identical UTC offset for Dhaka - a fixed +06:00 year-round, confirmed across the Sydney DST season too', () => {
    const january = getZonedParts('Asia/Dhaka', new Date('2026-01-15T15:00:00.000Z'));
    const july = getZonedParts('Asia/Dhaka', new Date('2026-07-15T15:00:00.000Z'));
    expect(january.hm).toBe(july.hm);
    expect(january.hm).toBe('21:00'); // 15:00 UTC + 6h, fixed
  });
});

describe('getZonedParts - dateKey/hm are genuinely local-day-aware, the exact primitive daily completion/Momentum/reminders all depend on', () => {
  it('the same UTC instant can fall on a different calendar dateKey in Sydney vs. Dhaka - the whole reason a per-user IANA zone, not a server clock, must drive "today"', () => {
    // 2026-10-03T15:00:00Z is 01:00 on 2026-10-04 in Sydney (UTC+10) but
    // still 21:00 on 2026-10-03 in Dhaka (UTC+6) - a full calendar day
    // apart for the exact same real-world instant.
    const instant = new Date('2026-10-03T15:00:00.000Z');
    const sydney = getZonedParts('Australia/Sydney', instant);
    const dhaka = getZonedParts('Asia/Dhaka', instant);
    expect(sydney.dateKey).toBe('2026-10-04');
    expect(dhaka.dateKey).toBe('2026-10-03');
  });
});
