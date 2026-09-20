// User-scoped daily completion — direct behaviour tests.
import { describe, it, expect } from 'vitest';
import {
  MORNING_DONE_KEY,
  EVENING_DONE_KEY,
  MEDITATION_DONE_KEY,
  getMorningCompletionKey,
  getEveningCompletionKey,
  getMeditationCompletionKey
} from './dailyCompletion';

describe('getMorningCompletionKey / getEveningCompletionKey / getMeditationCompletionKey', () => {
  it('a guest (no userId) reads/writes the original unscoped key, unchanged', () => {
    expect(getMorningCompletionKey(null)).toBe(MORNING_DONE_KEY);
    expect(getMorningCompletionKey(undefined)).toBe(MORNING_DONE_KEY);
    expect(getEveningCompletionKey(null)).toBe(EVENING_DONE_KEY);
    expect(getEveningCompletionKey(undefined)).toBe(EVENING_DONE_KEY);
    expect(getMeditationCompletionKey(null)).toBe(MEDITATION_DONE_KEY);
    expect(getMeditationCompletionKey(undefined)).toBe(MEDITATION_DONE_KEY);
  });

  it('a registered user gets their own key, suffixed with their Supabase user id', () => {
    expect(getMorningCompletionKey('user-a-uuid')).toBe(`${MORNING_DONE_KEY}:user-a-uuid`);
    expect(getEveningCompletionKey('user-a-uuid')).toBe(`${EVENING_DONE_KEY}:user-a-uuid`);
    expect(getMeditationCompletionKey('user-a-uuid')).toBe(`${MEDITATION_DONE_KEY}:user-a-uuid`);
  });

  it('two different users never collide on the same key', () => {
    expect(getMorningCompletionKey('user-a-uuid')).not.toBe(getMorningCompletionKey('user-b-uuid'));
    expect(getEveningCompletionKey('user-a-uuid')).not.toBe(getEveningCompletionKey('user-b-uuid'));
    expect(getMeditationCompletionKey('user-a-uuid')).not.toBe(getMeditationCompletionKey('user-b-uuid'));
  });

  it('a registered user\'s key never collides with the guest key', () => {
    expect(getMorningCompletionKey('user-a-uuid')).not.toBe(getMorningCompletionKey(null));
    expect(getEveningCompletionKey('user-a-uuid')).not.toBe(getEveningCompletionKey(null));
    expect(getMeditationCompletionKey('user-a-uuid')).not.toBe(getMeditationCompletionKey(null));
  });

  it('Morning, Evening and Meditation keys are always distinct for the same identity', () => {
    expect(getMorningCompletionKey('user-a-uuid')).not.toBe(getEveningCompletionKey('user-a-uuid'));
    expect(getMorningCompletionKey('user-a-uuid')).not.toBe(getMeditationCompletionKey('user-a-uuid'));
    expect(getEveningCompletionKey('user-a-uuid')).not.toBe(getMeditationCompletionKey('user-a-uuid'));
    expect(getMorningCompletionKey(null)).not.toBe(getEveningCompletionKey(null));
    expect(getMorningCompletionKey(null)).not.toBe(getMeditationCompletionKey(null));
  });

  it('never embeds anything other than the opaque user id - no email, no PII, in the key', () => {
    const key = getMorningCompletionKey('11111111-2222-3333-4444-555555555555');
    expect(key).toBe('moonlight_morning_completed_date:11111111-2222-3333-4444-555555555555');
    expect(key).not.toMatch(/@/);
    expect(getMeditationCompletionKey('11111111-2222-3333-4444-555555555555')).not.toMatch(/@/);
  });
});

describe('User A / User B completion isolation scenario', () => {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  it('User A completes Morning, logs out, User B never inherits it, User A gets it back on re-login', () => {
    const userA = 'aaaa-aaaa';
    const userB = 'bbbb-bbbb';
    const today = '2026-09-20';

    // User A completes Morning.
    localStorage.setItem(getMorningCompletionKey(userA), today);

    // Logged-out/public (guest) view reads the guest key - untouched, clean.
    expect(localStorage.getItem(getMorningCompletionKey(null))).not.toBe(today);

    // User B signs in - reads their OWN key, never User A's.
    expect(localStorage.getItem(getMorningCompletionKey(userB))).not.toBe(today);

    // User A signs back in the same day - their own key still holds it.
    expect(localStorage.getItem(getMorningCompletionKey(userA))).toBe(today);
  });

  it('guest completion is isolated from any registered account', () => {
    const guestToday = '2026-09-20';
    localStorage.setItem(getEveningCompletionKey(null), guestToday);
    const registeredUser = 'cccc-cccc';
    expect(localStorage.getItem(getEveningCompletionKey(registeredUser))).not.toBe(guestToday);
  });

  it('Morning, Evening and Meditation completion behave independently for the same user', () => {
    const user = 'dddd-dddd';
    const today = '2026-09-20';
    localStorage.setItem(getMorningCompletionKey(user), today);
    expect(localStorage.getItem(getEveningCompletionKey(user))).not.toBe(today);
    expect(localStorage.getItem(getMeditationCompletionKey(user))).not.toBe(today);
    localStorage.setItem(getEveningCompletionKey(user), today);
    localStorage.setItem(getMeditationCompletionKey(user), today);
    expect(localStorage.getItem(getMorningCompletionKey(user))).toBe(today);
    expect(localStorage.getItem(getEveningCompletionKey(user))).toBe(today);
    expect(localStorage.getItem(getMeditationCompletionKey(user))).toBe(today);
  });

  it('User A completes Meditation, logs out, User B never inherits it, User A gets it back on re-login', () => {
    const userA = 'eeee-eeee';
    const userB = 'ffff-ffff';
    const today = '2026-09-20';

    localStorage.setItem(getMeditationCompletionKey(userA), today);
    expect(localStorage.getItem(getMeditationCompletionKey(null))).not.toBe(today);
    expect(localStorage.getItem(getMeditationCompletionKey(userB))).not.toBe(today);
    expect(localStorage.getItem(getMeditationCompletionKey(userA))).toBe(today);
  });

  it('guest Meditation completion is isolated from any registered account', () => {
    const guestToday = '2026-09-20';
    localStorage.setItem(getMeditationCompletionKey(null), guestToday);
    const registeredUser = 'gggg-gggg';
    expect(localStorage.getItem(getMeditationCompletionKey(registeredUser))).not.toBe(guestToday);
  });
});
