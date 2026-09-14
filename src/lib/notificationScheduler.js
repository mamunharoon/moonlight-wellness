// WakeWise — Notifications & Reminders, Phase B — scheduler.
//
// setInterval-based, foreground-only client scheduler — not OS-level
// push (no service worker / push subscription in this phase's scope).
// It ticks once a minute, compares the clock to each enabled category's
// configured time, and fires a Web Notification when they match,
// honouring quiet hours, weekday selection, and per-category snooze.
import { getNotificationPreferences } from './notificationPreferences';
import { showNotification, isWithinQuietHours, isWeekdayAllowed } from './notificationService';
import { playReminderSound } from './audioEngine';
import { getCachedTimezone, getZonedParts } from './timezone';

const FIRED_LOG_KEY = 'wakewise_notification_fired_log_v1';
const TICK_MS = 30 * 1000;

const CATEGORY_MESSAGES = {
  wakeUp: { title: 'Good morning', body: "Time to start your WakeWise morning routine." },
  breathing: { title: 'Breathing reminder', body: 'Take a few minutes for a breathing exercise.' },
  affirmation: { title: 'Affirmation reminder', body: "Here's your moment for a daily affirmation." },
  reflection: { title: 'Reflection reminder', body: 'Take a moment to reflect on your day.' },
  gratitude: { title: 'Gratitude reminder', body: 'What are you grateful for today?' },
  sleepPrep: { title: 'Sleep preparation', body: "Time to start winding down for bed." },
  hydration: { title: 'Hydration reminder', body: 'Remember to drink some water.' },
  stretching: { title: 'Stretching reminder', body: 'Take a short break to stretch.' },
  mindfulness: { title: 'Mindfulness reminder', body: 'Take a mindful moment for yourself.' }
};

let intervalId = null;
const snoozedUntil = new Map();

const getFiredLog = () => {
  try {
    return JSON.parse(window.localStorage.getItem(FIRED_LOG_KEY) ?? '{}');
  } catch {
    return {};
  }
};

const markFired = (categoryId, dateKey, minuteKey) => {
  const log = getFiredLog();
  log[categoryId] = `${dateKey}T${minuteKey}`;
  window.localStorage.setItem(FIRED_LOG_KEY, JSON.stringify(log));
};

const alreadyFiredThisMinute = (categoryId, dateKey, minuteKey) =>
  getFiredLog()[categoryId] === `${dateKey}T${minuteKey}`;

const tick = () => {
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) return;

  // Global timezone correctness: every "what's today/what time is it"
  // question below is answered in the user's own confirmed timezone
  // (falling back to the live device zone only while unconfirmed - see
  // src/lib/timezone.js), never the raw device clock or, worse, UTC.
  // dateKey in particular used to be `now.toISOString().slice(0, 10)` -
  // a UTC calendar date. For a user well ahead of UTC (e.g. Melbourne,
  // UTC+10/11) that date flips over at 10-11am local, not midnight; for a
  // user well behind UTC (e.g. Los Angeles) it flips late morning too -
  // both directions meant the fired-log dedup key could silently roll
  // over mid-day rather than at the user's own local midnight, exactly
  // the class of bug this feature exists to eliminate.
  const zoned = getZonedParts(getCachedTimezone());
  if (isWithinQuietHours(prefs.quietHours, zoned)) return;

  const minuteKey = zoned.hm;
  const dateKey = zoned.dateKey;
  const nowMs = Date.now();

  Object.entries(prefs.categories).forEach(([categoryId, category]) => {
    if (!category.enabled) return;

    const snoozeTarget = snoozedUntil.get(categoryId);
    if (snoozeTarget) {
      if (nowMs < snoozeTarget) return;
      snoozedUntil.delete(categoryId);
      fire(categoryId, dateKey, minuteKey);
      return;
    }

    if (category.time !== minuteKey) return;
    if (category.frequency === 'weekdays' && !isWeekdayAllowed([1, 2, 3, 4, 5], zoned)) return;
    if (category.frequency === 'custom' && !isWeekdayAllowed(category.weekdays, zoned)) return;
    if (alreadyFiredThisMinute(categoryId, dateKey, minuteKey)) return;

    fire(categoryId, dateKey, minuteKey);
  });
};

const fire = (categoryId, dateKey, minuteKey) => {
  const message = CATEGORY_MESSAGES[categoryId] ?? { title: 'WakeWise reminder', body: 'You have a reminder.' };
  showNotification(message.title, { body: message.body, tag: categoryId });
  playReminderSound(categoryId);
  markFired(categoryId, dateKey, minuteKey);
};

export const startNotificationScheduler = () => {
  if (intervalId !== null) return;
  intervalId = window.setInterval(tick, TICK_MS);
};

export const stopNotificationScheduler = () => {
  if (intervalId === null) return;
  window.clearInterval(intervalId);
  intervalId = null;
};

export const snoozeCategory = (categoryId, snoozeMinutes) => {
  snoozedUntil.set(categoryId, Date.now() + snoozeMinutes * 60 * 1000);
};

export const clearSnooze = (categoryId) => {
  snoozedUntil.delete(categoryId);
};
