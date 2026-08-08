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

export const DEFAULT_PREFERENCES = {
  enabled: false,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  snoozeMinutes: 10,
  categories: CATEGORY_DEFAULTS
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

export const resetNotificationPreferences = () => persist(clone(DEFAULT_PREFERENCES));
