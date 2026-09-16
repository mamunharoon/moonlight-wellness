import { describe, it, expect, beforeEach } from 'vitest';

// This project's vitest environment is plain Node (see vite.config.js),
// not jsdom — there is no real `window`/`localStorage` global.
// notificationPreferences.js reads/writes via `window.localStorage`
// directly (guarded by `typeof window === 'undefined'` only on the read
// path), so a minimal in-memory stand-in is provided here rather than
// adding a browser-environment test dependency project-wide.
const memory = new Map();
const localStorageMock = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear()
};
globalThis.window = { localStorage: localStorageMock };

const {
  ALL_NATIVE_REMINDER_WEEKDAYS,
  sanitizeNativeReminderWeekdays,
  getNotificationPreferences,
  saveNotificationPreferences,
  updateNativeMorningReminderEnabled,
  updateNativeMorningReminderWeekdays,
  updateNativeMorningReminderFingerprint
} = await import('./notificationPreferences');

const STORAGE_KEY = 'wakewise_notification_preferences_v1';

beforeEach(() => {
  memory.clear();
});

describe('sanitizeNativeReminderWeekdays', () => {
  it('defaults to every day for a missing/undefined value — the migration case for an older stored preference', () => {
    expect(sanitizeNativeReminderWeekdays(undefined)).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
  });

  it('parses a valid weekday selection, deduping and sorting it', () => {
    expect(sanitizeNativeReminderWeekdays([5, 2, 2, 7])).toEqual([2, 5, 7]);
  });

  it('falls back to every day for a malformed value — wrong type, out-of-range numbers, or an empty array', () => {
    expect(sanitizeNativeReminderWeekdays('everyday')).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
    expect(sanitizeNativeReminderWeekdays(null)).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
    expect(sanitizeNativeReminderWeekdays([0, 8, -1, 99])).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
    expect(sanitizeNativeReminderWeekdays([])).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
  });

  it('drops only the invalid entries out of a mixed-validity array', () => {
    expect(sanitizeNativeReminderWeekdays([2, 99, 4, 0, 6])).toEqual([2, 4, 6]);
  });
});

describe('getNotificationPreferences — nativeMorningReminder migration', () => {
  it('defaults an entirely fresh device to every day, disabled, with no fingerprint yet', () => {
    const prefs = getNotificationPreferences();
    expect(prefs.nativeMorningReminder).toEqual({
      enabled: false,
      weekdays: ALL_NATIVE_REMINDER_WEEKDAYS,
      lastReconciledFingerprint: null
    });
  });

  it('migrates an older stored preference with no weekdays field at all to every day, preserving its own enabled flag', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify({ nativeMorningReminder: { enabled: true } }));
    const prefs = getNotificationPreferences();
    expect(prefs.nativeMorningReminder.enabled).toBe(true);
    expect(prefs.nativeMorningReminder.weekdays).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
  });

  it('re-sanitizes a malformed stored weekdays value on every read, not just once on write', () => {
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify({ nativeMorningReminder: { enabled: true, weekdays: ['not', 'valid', 0, 99] } })
    );
    expect(getNotificationPreferences().nativeMorningReminder.weekdays).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
  });

  it('preserves a genuinely valid stored weekday subset unchanged', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify({ nativeMorningReminder: { enabled: true, weekdays: [2, 4, 6] } }));
    expect(getNotificationPreferences().nativeMorningReminder.weekdays).toEqual([2, 4, 6]);
  });

  it('gracefully falls back to full defaults for entirely corrupted JSON', () => {
    localStorageMock.setItem(STORAGE_KEY, '{not valid json');
    expect(getNotificationPreferences().nativeMorningReminder).toEqual({
      enabled: false,
      weekdays: ALL_NATIVE_REMINDER_WEEKDAYS,
      lastReconciledFingerprint: null
    });
  });
});

describe('updateNativeMorningReminderEnabled / updateNativeMorningReminderWeekdays / updateNativeMorningReminderFingerprint', () => {
  it('persists the enabled intent independently of weekdays/fingerprint', () => {
    updateNativeMorningReminderEnabled(true);
    expect(getNotificationPreferences().nativeMorningReminder.enabled).toBe(true);
    expect(getNotificationPreferences().nativeMorningReminder.weekdays).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
  });

  it('persists a sanitized weekday selection', () => {
    updateNativeMorningReminderWeekdays([3, 1, 3]);
    expect(getNotificationPreferences().nativeMorningReminder.weekdays).toEqual([1, 3]);
  });

  it('never persists an empty weekday set even if asked to — falls back to every day rather than storing nothing', () => {
    updateNativeMorningReminderWeekdays([]);
    expect(getNotificationPreferences().nativeMorningReminder.weekdays).toEqual(ALL_NATIVE_REMINDER_WEEKDAYS);
  });

  it('persists and later clears a reconciliation fingerprint', () => {
    updateNativeMorningReminderFingerprint('07:00|1,2,3|-600|Australia/Melbourne');
    expect(getNotificationPreferences().nativeMorningReminder.lastReconciledFingerprint).toBe(
      '07:00|1,2,3|-600|Australia/Melbourne'
    );
    updateNativeMorningReminderFingerprint(null);
    expect(getNotificationPreferences().nativeMorningReminder.lastReconciledFingerprint).toBeNull();
  });

  it('leaves the rest of the preferences blob (quiet hours, categories, snoozeMinutes) untouched', () => {
    saveNotificationPreferences({ ...getNotificationPreferences(), snoozeMinutes: 30 });
    updateNativeMorningReminderWeekdays([2]);
    expect(getNotificationPreferences().snoozeMinutes).toBe(30);
  });
});
