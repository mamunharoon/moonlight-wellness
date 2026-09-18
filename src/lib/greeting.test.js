import { describe, it, expect } from 'vitest';
import { getFirstName, getGreeting, GREETING_PERIOD_BY_TIME_STATE } from './greeting';

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

  it('capitalises an all-lowercase stored name in the rendered greeting (regression: "Good afternoon, Mamun", not "mamun")', () => {
    expect(getGreeting('afternoon', { profile: { first_name: 'mamun' }, user: null })).toBe('Good afternoon, Mamun');
    expect(getGreeting('evening', { profile: { first_name: 'mamun' }, user: null })).toBe('Good evening, Mamun');
  });

  it('returns null for a period with no known greeting, rather than guessing', () => {
    expect(getGreeting('midnight-snack', { profile: { first_name: 'Jane' }, user: null })).toBeNull();
  });
});

describe('GREETING_PERIOD_BY_TIME_STATE', () => {
  it('maps exactly the three greeted Home.jsx timeState buckets to their daypart, and no others', () => {
    expect(GREETING_PERIOD_BY_TIME_STATE).toEqual({
      'daytime-morning': 'morning',
      daytime: 'afternoon',
      evening: 'evening'
    });
  });

  it('never maps the before-wake or night timeState buckets to a greeting', () => {
    expect(GREETING_PERIOD_BY_TIME_STATE['before-wake']).toBeUndefined();
    expect(GREETING_PERIOD_BY_TIME_STATE.night).toBeUndefined();
  });
});
