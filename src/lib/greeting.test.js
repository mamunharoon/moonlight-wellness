import { describe, it, expect } from 'vitest';
import { getFirstName, getMorningGreeting } from './greeting';

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
});

describe('getMorningGreeting', () => {
  it('greets by first name when one is available', () => {
    expect(getMorningGreeting({ profile: { first_name: 'Jane' }, user: null })).toBe('Good morning, Jane');
  });

  it('falls back to a neutral greeting when no valid name exists', () => {
    expect(getMorningGreeting({ profile: null, user: { email: 'jane@example.com' } })).toBe('Good morning');
    expect(getMorningGreeting({})).toBe('Good morning');
  });
});
