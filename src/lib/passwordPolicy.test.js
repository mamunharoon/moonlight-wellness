import { describe, it, expect } from 'vitest';
import { NEW_PASSWORD_MIN_LENGTH, NEW_PASSWORD_HINT, getPasswordTooShortMessage, isPasswordTooShort } from './passwordPolicy';

describe('passwordPolicy — new-password (signup/reset) rules only, never Sign In', () => {
  it('minimum length is 8 (the approved product decision - a briefly-considered 12 was superseded)', () => {
    expect(NEW_PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('isPasswordTooShort is true below 8, false at and above 8', () => {
    expect(isPasswordTooShort('')).toBe(true);
    expect(isPasswordTooShort('short7c')).toBe(true); // 7
    expect(isPasswordTooShort('eightchr')).toBe(false); // 8
    expect(isPasswordTooShort('a'.repeat(30))).toBe(false);
  });

  it('isPasswordTooShort handles null/undefined safely', () => {
    expect(isPasswordTooShort(undefined)).toBe(true);
    expect(isPasswordTooShort(null)).toBe(true);
  });

  it('getPasswordTooShortMessage matches the exact required copy', () => {
    expect(getPasswordTooShortMessage()).toBe('Password must be at least 8 characters.');
  });

  it('the hint text matches the exact required copy, and does not impose any composition rule (no mention of uppercase/number/symbol)', () => {
    expect(NEW_PASSWORD_HINT).toBe('Use at least 8 characters. For better security, try a longer, unique password or passphrase.');
    expect(NEW_PASSWORD_HINT).not.toMatch(/uppercase|lowercase|number|digit|symbol|special character/i);
  });
});
