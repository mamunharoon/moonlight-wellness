import { describe, it, expect } from 'vitest';
import { getFirstName, getGreeting } from './greeting';

describe('getFirstName', () => {
  it('uses a valid profile first name', () => {
    expect(getFirstName({ profile: { first_name: 'Jane' }, user: null })).toBe('Jane');
  });

  it('takes only the first token when the stored name has multiple words', () => {
    expect(getFirstName({ profile: { first_name: 'Jane Doe' }, user: null })).toBe('Jane');
  });

  it('returns null when no name is available anywhere', () => {
    expect(getFirstName({ profile: null, user: { email: 'jane@example.com' } })).toBeNull();
    expect(getFirstName({})).toBeNull();
  });

  it('treats a blank/whitespace-only name as missing and falls through', () => {
    expect(
      getFirstName({ profile: { first_name: '   ' }, user: { user_metadata: { first_name: 'Jane' } } })
    ).toBe('Jane');
    expect(getFirstName({ profile: { first_name: '' }, user: null })).toBeNull();
  });

  it('never uses an email address as the name', () => {
    expect(
      getFirstName({ profile: null, user: { email: 'jane@example.com', user_metadata: {} } })
    ).toBeNull();
  });

  it('prefers the authoritative profile name over editable user_metadata', () => {
    expect(
      getFirstName({
        profile: { first_name: 'Alice' },
        user: { user_metadata: { first_name: 'Bob' } }
      })
    ).toBe('Alice');
  });

  it('falls back to user_metadata only when no profile row is available', () => {
    expect(getFirstName({ profile: null, user: { user_metadata: { first_name: 'Bob' } } })).toBe('Bob');
  });

  it('capitalises an all-lowercase stored name for display (e.g. profiles.first_name "mamun")', () => {
    expect(getFirstName({ profile: { first_name: 'mamun' }, user: null })).toBe('Mamun');
  });

  it('capitalises only the first character, leaving the rest of the name untouched', () => {
    expect(getFirstName({ profile: { first_name: 'mcdonald' }, user: null })).toBe('Mcdonald');
    expect(getFirstName({ profile: { first_name: 'McDonald' }, user: null })).toBe('McDonald');
  });

  it('capitalises a lowercase name sourced from user_metadata too', () => {
    expect(getFirstName({ profile: null, user: { user_metadata: { first_name: 'bob' } } })).toBe('Bob');
  });
});

describe('getGreeting', () => {
  it('greets by first name for each of the three dayparts', () => {
    expect(getGreeting('morning', { profile: { first_name: 'Jane' }, user: null })).toBe('Good morning, Jane');
    expect(getGreeting('afternoon', { profile: { first_name: 'Jane' }, user: null })).toBe('Good afternoon, Jane');
    expect(getGreeting('evening', { profile: { first_name: 'Jane' }, user: null })).toBe('Good evening, Jane');
  });

  it('falls back to a neutral, comma-free greeting when no valid name exists', () => {
    expect(getGreeting('morning', { profile: null, user: { email: 'jane@example.com' } })).toBe('Good morning');
    expect(getGreeting('afternoon', {})).toBe('Good afternoon');
    expect(getGreeting('evening', {})).toBe('Good evening');
  });

  it('Guest Onboarding: a genuine guest (no profile row, no user session at all) never invents a name or falls back to an email', () => {
    expect(getGreeting('morning', { profile: null, user: null })).toBe('Good morning');
    expect(getGreeting('evening', { profile: null, user: null })).toBe('Good evening');
  });

  it('capitalises an all-lowercase stored name in the rendered greeting (regression: "Good afternoon, Mamun", not "mamun")', () => {
    expect(getGreeting('afternoon', { profile: { first_name: 'mamun' }, user: null })).toBe('Good afternoon, Mamun');
    expect(getGreeting('evening', { profile: { first_name: 'mamun' }, user: null })).toBe('Good evening, Mamun');
  });

  it('returns null for a period with no known greeting, rather than guessing', () => {
    expect(getGreeting('midnight-snack', { profile: { first_name: 'Jane' }, user: null })).toBeNull();
  });

  it('with no dateKey passed, resolves to the plain unadorned variant (index 0) - existing simple callers keep working unchanged', () => {
    expect(getGreeting('morning', { profile: { first_name: 'Jane' }, user: null })).toBe('Good morning, Jane');
    expect(getGreeting('afternoon', { profile: { first_name: 'Jane' }, user: null })).toBe('Good afternoon, Jane');
    expect(getGreeting('evening', { profile: { first_name: 'Jane' }, user: null })).toBe('Good evening, Jane');
  });
});

describe('getGreeting — per-local-day rotation', () => {
  const NAME = { profile: { first_name: 'Jane' }, user: null };
  const GUEST = { profile: null, user: null };

  it('is stable for the whole local day - every call with the same dateKey returns the same message, called or not called many times', () => {
    const first = getGreeting('morning', { ...NAME, dateKey: '2026-09-26' });
    for (let i = 0; i < 5; i += 1) {
      expect(getGreeting('morning', { ...NAME, dateKey: '2026-09-26' })).toBe(first);
    }
  });

  it('changes only at the local-day boundary, not within the same day (e.g. 23:59 and 00:01 of the same calendar day both resolve from the same dateKey)', () => {
    // dateKey is already the caller's local calendar day (see
    // getZonedParts) - this module never looks at a time-of-day
    // component, so two different clock times on the same local day
    // necessarily produce the same dateKey and therefore the same
    // greeting; a genuine boundary crossing is covered by the next test.
    expect(getGreeting('evening', { ...NAME, dateKey: '2026-09-26' })).toBe(
      getGreeting('evening', { ...NAME, dateKey: '2026-09-26' })
    );
  });

  it('advances to the next variant across a local midnight boundary (consecutive dateKeys)', () => {
    const day1 = getGreeting('morning', { ...GUEST, dateKey: '2026-09-26' });
    const day2 = getGreeting('morning', { ...GUEST, dateKey: '2026-09-27' });
    expect(day1).not.toBe(day2);
  });

  it('rotates through every one of the 6 morning variants before repeating any (6 consecutive local days, all distinct, day 7 repeats day 1)', () => {
    const seen = new Set();
    for (let i = 0; i < 6; i += 1) {
      const dateKey = `2026-09-${String(20 + i).padStart(2, '0')}`;
      seen.add(getGreeting('morning', { ...GUEST, dateKey }));
    }
    expect(seen.size).toBe(6);
    const firstDay = getGreeting('morning', { ...GUEST, dateKey: '2026-09-20' });
    const seventhDay = getGreeting('morning', { ...GUEST, dateKey: '2026-09-26' });
    expect(seventhDay).toBe(firstDay);
  });

  it('afternoon and evening also each expose 6 distinct guest variants across 6 consecutive local days', () => {
    const afternoonSeen = new Set();
    const eveningSeen = new Set();
    for (let i = 0; i < 6; i += 1) {
      const dateKey = `2026-10-${String(1 + i).padStart(2, '0')}`;
      afternoonSeen.add(getGreeting('afternoon', { ...GUEST, dateKey }));
      eveningSeen.add(getGreeting('evening', { ...GUEST, dateKey }));
    }
    expect(afternoonSeen.size).toBe(6);
    expect(eveningSeen.size).toBe(6);
  });

  it('an unparseable dateKey falls back to the plain variant instead of throwing or guessing', () => {
    expect(getGreeting('morning', { ...GUEST, dateKey: 'not-a-date' })).toBe('Good morning');
    expect(getGreeting('morning', { ...GUEST, dateKey: undefined })).toBe('Good morning');
  });

  it('every variant has a genuine name-free guest line - a guest on any given day never sees an empty/broken greeting', () => {
    for (let i = 0; i < 6; i += 1) {
      const dateKey = `2026-11-${String(1 + i).padStart(2, '0')}`;
      expect(getGreeting('morning', { ...GUEST, dateKey })).toMatch(/^[A-Z]/);
      expect(getGreeting('afternoon', { ...GUEST, dateKey })).toMatch(/^[A-Z]/);
      expect(getGreeting('evening', { ...GUEST, dateKey })).toMatch(/^[A-Z]/);
    }
  });

  it('the chosen variant text never leaks a raw name placeholder or trailing comma when no name is available', () => {
    for (let i = 0; i < 6; i += 1) {
      const dateKey = `2026-11-${String(1 + i).padStart(2, '0')}`;
      const greeting = getGreeting('morning', { ...GUEST, dateKey });
      expect(greeting.endsWith(',')).toBe(false);
      expect(greeting).not.toContain('${');
    }
  });

  it('account switching: the same dateKey/period immediately reflects a different profile\'s name with no stale caching', () => {
    const dateKey = '2026-09-26';
    const asJane = getGreeting('morning', { profile: { first_name: 'Jane' }, user: null, dateKey });
    const asBob = getGreeting('morning', { profile: { first_name: 'Bob' }, user: null, dateKey });
    const asGuestAgain = getGreeting('morning', { profile: null, user: null, dateKey });
    expect(asJane).toContain('Jane');
    expect(asBob).toContain('Bob');
    expect(asBob).not.toContain('Jane');
    expect(asGuestAgain).not.toContain('Jane');
    expect(asGuestAgain).not.toContain('Bob');
  });
});
