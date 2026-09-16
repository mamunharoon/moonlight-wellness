// WakeWise — Notifications & Reminders, Phase B — preference manager.
//
// Local-only, per-device (localStorage), matching reducedMotionPreference.js's
// established pattern. No new Supabase table — reminder preferences are a
// device setting, not account data that needs to sync or be admin-visible.
const STORAGE_KEY = 'wakewise_notification_preferences_v1';

const CATEGORY_DEFAULTS = {
  wakeUp: { label: 'Wake-up reminder', group: 'morning', enabled: false, time: '07:00', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  breathing: { label: 'Breathing reminder', group: 'morning', enabled: false, time: '07:15', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  affirmation: { label: 'Affirmation reminder', group: 'morning', enabled: false, time: '07:30', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  reflection: { label: 'Reflection reminder', group: 'evening', enabled: false, time: '20:30', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  gratitude: { label: 'Gratitude reminder', group: 'evening', enabled: false, time: '20:45', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  sleepPrep: { label: 'Sleep preparation reminder', group: 'evening', enabled: false, time: '21:30', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  hydration: { label: 'Hydration reminder', group: 'wellness', enabled: false, time: '13:00', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  stretching: { label: 'Stretching reminder', group: 'wellness', enabled: false, time: '15:00', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  mindfulness: { label: 'Mindfulness reminder', group: 'wellness', enabled: false, time: '17:00', frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] }
};

export const CATEGORY_GROUPS = [
  { id: 'morning', label: 'Morning reminders' },
  { id: 'evening', label: 'Evening reminders' },
  { id: 'wellness', label: 'Wellness reminders' }
];

export const FREQUENCY_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'custom', label: 'Custom days' }
];

// Capacitor's own Weekday enum values (Sunday=1 .. Saturday=7 — see
// @capacitor/local-notifications' definitions.d.ts). The native morning
// reminder stores/validates weekday selections in this exact numbering
// (kept independent of CATEGORY_DEFAULTS' unrelated 0=Sun..6=Sat
// convention above) so a selection can be handed straight to
// `schedule.on.weekday` with no conversion step. nativeMorningReminder.js
// re-declares this same range for its own native-scheduling-layer needs
// (id bounds-checking) — the two are intentionally not cross-imported so
// this module stays dependency-free (see the file header); both must be
// kept in sync if the range ever changes, which it structurally cannot
// since it mirrors a fixed platform enum.
export const ALL_NATIVE_REMINDER_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

// Safely coerces an arbitrary (possibly missing, malformed, or
// older-format) stored value into a valid weekday selection: a deduped,
// sorted subset of 1-7. Falls back to "every day" for anything that isn't
// a non-empty array of valid weekday numbers — covers both a genuinely
// older stored preference (no weekdays field at all) and any malformed
// value (wrong type, out-of-range numbers, empty array) the same way, so
// an existing user's reminder keeps firing daily exactly as before rather
// than silently going quiet.
export const sanitizeNativeReminderWeekdays = (value) => {
  if (!Array.isArray(value)) return [...ALL_NATIVE_REMINDER_WEEKDAYS];
  const valid = [...new Set(value.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort(
    (a, b) => a - b
  );
  return valid.length > 0 ? valid : [...ALL_NATIVE_REMINDER_WEEKDAYS];
};

export const DEFAULT_PREFERENCES = {
  enabled: false,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  snoozeMinutes: 10,
  categories: CATEGORY_DEFAULTS,
  // Capacitor iOS Native Morning Reminders: a separate, device-level (OS
  // notification, not JS timer) reminder tied to the real saved wake time
  // (AlarmContext's alarmTime), not the independently-editable `wakeUp`
  // category time above. Kept in the same preferences blob rather than a
  // second storage key, but tracked under its own field since it's a
  // structurally different mechanism (native calendar trigger vs. web
  // setInterval).
  //   - enabled: the user's own last explicit choice (set only by an
  //     explicit enable/disable/logout/account-deletion action) — this is
  //     intent, and survives a transient permission denial so that
  //     re-granting permission in iPhone Settings can resume the reminder
  //     without requiring the user to also re-find and re-tap the toggle.
  //   - weekdays: which days fire, in Capacitor's own Weekday numbering
  //     (see ALL_NATIVE_REMINDER_WEEKDAYS above). Defaults to every day so
  //     an existing user's reminder behaviour never silently changes.
  //   - lastReconciledFingerprint: an opaque string capturing exactly the
  //     scheduling-relevant inputs (wake time, weekdays, permission,
  //     device timezone/offset) as of the last time MorningReminderContext
  //     actually rescheduled the device — the minimum non-sensitive
  //     metadata needed to tell "nothing relevant changed, skip
  //     rescheduling" apart from "something changed, reconcile" on every
  //     app-active/resume, without re-deriving/persisting anything more
  //     sensitive than that.
  nativeMorningReminder: { enabled: false, weekdays: [...ALL_NATIVE_REMINDER_WEEKDAYS], lastReconciledFingerprint: null }
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const getNotificationPreferences = () => {
  if (typeof window === 'undefined') return clone(DEFAULT_PREFERENCES);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_PREFERENCES);
    const parsed = JSON.parse(raw);
    return {
      ...clone(DEFAULT_PREFERENCES),
      ...parsed,
      quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...parsed.quietHours },
      nativeMorningReminder: {
        ...DEFAULT_PREFERENCES.nativeMorningReminder,
        ...parsed.nativeMorningReminder,
        // Re-sanitized on every read (not just migrated once on write) so
        // a malformed value written by a future rollback or a corrupted
        // localStorage entry is always safely coerced back to a valid
        // selection, never trusted as-is.
        weekdays: sanitizeNativeReminderWeekdays(parsed.nativeMorningReminder?.weekdays)
      },
      categories: Object.fromEntries(
        Object.keys(CATEGORY_DEFAULTS).map((key) => [
          key,
          { ...CATEGORY_DEFAULTS[key], ...(parsed.categories?.[key] ?? {}) }
        ])
      )
    };
  } catch (e) {
    console.error('Error reading notification preferences:', e.message);
    return clone(DEFAULT_PREFERENCES);
  }
};

const persist = (preferences) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  return preferences;
};

export const saveNotificationPreferences = (preferences) => persist(preferences);

export const updateGlobalEnabled = (enabled) => {
  const prefs = getNotificationPreferences();
  return persist({ ...prefs, enabled });
};

export const updateQuietHours = (quietHours) => {
  const prefs = getNotificationPreferences();
  return persist({ ...prefs, quietHours: { ...prefs.quietHours, ...quietHours } });
};

export const updateSnoozeMinutes = (snoozeMinutes) => {
  const prefs = getNotificationPreferences();
  return persist({ ...prefs, snoozeMinutes });
};

export const updateCategory = (categoryId, changes) => {
  const prefs = getNotificationPreferences();
  if (!prefs.categories[categoryId]) return prefs;
  return persist({
    ...prefs,
    categories: {
      ...prefs.categories,
      [categoryId]: { ...prefs.categories[categoryId], ...changes }
    }
  });
};

export const updateNativeMorningReminderEnabled = (enabled) => {
  const prefs = getNotificationPreferences();
  return persist({ ...prefs, nativeMorningReminder: { ...prefs.nativeMorningReminder, enabled } });
};

// Persists a sanitized weekday selection. Never persists an empty
// selection while the reminder is enabled — the caller (setWeekdays in
// MorningReminderContext) is expected to already enforce "at least one
// day" before calling this, but sanitizeNativeReminderWeekdays' own
// empty-array fallback to "every day" is a second, independent backstop
// here too, so this function alone can never leave a stored empty set.
export const updateNativeMorningReminderWeekdays = (weekdays) => {
  const prefs = getNotificationPreferences();
  return persist({
    ...prefs,
    nativeMorningReminder: { ...prefs.nativeMorningReminder, weekdays: sanitizeNativeReminderWeekdays(weekdays) }
  });
};

export const updateNativeMorningReminderFingerprint = (fingerprint) => {
  const prefs = getNotificationPreferences();
  return persist({
    ...prefs,
    nativeMorningReminder: { ...prefs.nativeMorningReminder, lastReconciledFingerprint: fingerprint ?? null }
  });
};

export const resetNotificationPreferences = () => persist(clone(DEFAULT_PREFERENCES));
