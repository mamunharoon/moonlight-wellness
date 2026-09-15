import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativePlatform } from './platform';

// Capacitor iOS Native Morning Reminders.
//
// One fixed, documented notification id so scheduling always replaces the
// same pending reminder instead of accumulating duplicates: iOS treats
// UNUserNotificationCenter.add() with an existing request identifier as a
// replacement of the pending request with that identifier, and Capacitor's
// LocalNotifications.schedule() passes the id straight through — no
// explicit cancel-then-schedule is needed to avoid duplicates, though
// cancelMorningReminder() below is still exposed for the disable path.
export const MORNING_REMINDER_NOTIFICATION_ID = 990001;

// The only value this module ever writes into a scheduled notification's
// `extra.target`, and the only value resolveTapTarget() ever trusts back
// out of one. A tap handler must never build a navigation target from an
// arbitrary payload value — it only ever recognises this fixed constant.
const MORNING_REMINDER_TARGET = 'morning-reminder';
const MORNING_REMINDER_ROUTE = '/morning-start';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Parses a WakeWise "HH:MM" wake time (AlarmContext's alarmTime /
 * rhythms.wake_up_time) into { hour, minute } for a Local Notifications
 * calendar schedule. Returns null for anything that isn't exactly that
 * format so callers can safely refuse to schedule bad input instead of
 * silently misfiring.
 */
export const parseWakeTime = (value) => {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
};

/**
 * The only navigation target a tapped morning-reminder notification can
 * ever resolve to. Checks both the fixed notification id and the fixed
 * `extra.target` this module itself wrote — never trusts an arbitrary
 * value read back off the notification payload as a route.
 */
export const resolveTapTarget = (actionPerformed) => {
  const notification = actionPerformed?.notification;
  if (!notification) return null;
  if (notification.id !== MORNING_REMINDER_NOTIFICATION_ID) return null;
  if (notification.extra?.target !== MORNING_REMINDER_TARGET) return null;
  return MORNING_REMINDER_ROUTE;
};

const safe = async (fn, fallback) => {
  try {
    return await fn();
  } catch (error) {
    console.warn('[nativeMorningReminder] operation failed, continuing without it', error);
    return fallback;
  }
};

export const isSupported = () => isNativePlatform();

/** Read-only permission check. Never triggers the iOS permission dialog. */
export const checkPermission = () => {
  if (!isSupported()) return Promise.resolve('unsupported');
  return safe(async () => (await LocalNotifications.checkPermissions()).display, 'error');
};

/** Triggers the native iOS permission dialog. Call only after a deliberate user action. */
export const requestPermission = () => {
  if (!isSupported()) return Promise.resolve('unsupported');
  return safe(async () => (await LocalNotifications.requestPermissions()).display, 'error');
};

/**
 * Schedules (or reschedules — same fixed id replaces) the daily morning
 * reminder at the given "HH:MM" wake time, using the device's local
 * calendar/time-zone behaviour (a `schedule.on` calendar trigger, not a
 * fixed 24h interval), so it follows DST and local-time changes on its
 * own. Content is deliberately generic — no journal, health, or account
 * data. Returns false (never throws) if unsupported, the time is invalid,
 * or the native call fails.
 */
export const scheduleMorningReminder = (wakeTime) => {
  if (!isSupported()) return Promise.resolve(false);
  const parsed = parseWakeTime(wakeTime);
  if (!parsed) return Promise.resolve(false);
  return safe(async () => {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: MORNING_REMINDER_NOTIFICATION_ID,
          title: 'Good morning',
          body: 'Your WakeWise morning routine is ready.',
          schedule: { on: { hour: parsed.hour, minute: parsed.minute } },
          extra: { target: MORNING_REMINDER_TARGET }
        }
      ]
    });
    return true;
  }, false);
};

export const cancelMorningReminder = () => {
  if (!isSupported()) return Promise.resolve(false);
  return safe(async () => {
    await LocalNotifications.cancel({ notifications: [{ id: MORNING_REMINDER_NOTIFICATION_ID }] });
    return true;
  }, false);
};

/** Returns the pending morning reminder as scheduled on-device, or null. */
export const getPendingMorningReminder = () => {
  if (!isSupported()) return Promise.resolve(null);
  return safe(async () => {
    const { notifications } = await LocalNotifications.getPending();
    return notifications.find((n) => n.id === MORNING_REMINDER_NOTIFICATION_ID) ?? null;
  }, null);
};

/**
 * Orchestrates turning the reminder on: checks permission, requests it
 * only now (a deliberate user action, never on mount/launch), and
 * schedules only once permission is actually granted — never on
 * denied/unsupported/error. Exposed standalone (rather than inlined in
 * the React context) so this decision logic is unit-testable without a
 * DOM/React test setup.
 */
export const enableMorningReminder = async (wakeTime) => {
  if (!isSupported()) return { ok: false, permission: 'unsupported' };
  let permission = await checkPermission();
  if (permission !== 'granted') {
    permission = await requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, permission };
  }
  const ok = await scheduleMorningReminder(wakeTime);
  return { ok, permission };
};

export const disableMorningReminder = async () => {
  if (!isSupported()) return { ok: false };
  const ok = await cancelMorningReminder();
  return { ok };
};
