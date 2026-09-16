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

// Weekday scheduling (Complete Native Wake Reminder Functionality).
//
// One deterministic, documented id per Capacitor Weekday value (enum
// Sunday=1..Saturday=7 — see node_modules/@capacitor/local-notifications
// dist/esm/definitions.d.ts), all in a fixed, distinct id range so they
// can never collide with MORNING_REMINDER_NOTIFICATION_ID (990001, now
// legacy — see applyMorningReminderSchedule below, which explicitly
// cancels it), the snooze id, or any unrelated notification elsewhere in
// the app. Because every id is fixed, scheduling the same weekday twice
// always *replaces* the same pending request (iOS's own add()-with-
// existing-identifier behaviour) — duplicate prevention falls out of the
// id scheme itself, with no separate cancel-before-schedule step needed
// for the days that stay selected.
export const MORNING_REMINDER_WEEKDAY_ID_BASE = 990010; // ids 990011 (Sun) .. 990017 (Sat)
export const MORNING_REMINDER_SNOOZE_NOTIFICATION_ID = 990020;
export const ALL_MORNING_REMINDER_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export const isValidMorningReminderWeekday = (weekday) =>
  Number.isInteger(weekday) && weekday >= 1 && weekday <= 7;

// Display-only: short labels per Capacitor Weekday value, and a
// Monday-first render order (the task's explicit "Monday through Sunday"
// UI ordering) — independent of the underlying stored/sanitized value set,
// which stays in plain Capacitor Weekday numbering regardless of how it's
// laid out on screen.
export const MORNING_REMINDER_WEEKDAY_LABELS = { 1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat' };
export const MORNING_REMINDER_WEEKDAY_DISPLAY_ORDER = [2, 3, 4, 5, 6, 7, 1]; // Mon..Sun

/**
 * A concise, human-readable schedule summary for settings UI — e.g. "Every
 * day at 07:30", "Weekdays at 07:00", or "Mon, Wed, Fri at 06:45". Pure
 * and presentation-only; never itself reads or writes anything.
 */
export const formatMorningReminderScheduleSummary = (weekdays, wakeTime) => {
  if (!wakeTime) return null;
  const selected = sanitizeMorningReminderWeekdaysLocal(weekdays);
  const weekdaySet = [2, 3, 4, 5, 6]; // Mon-Fri, Capacitor numbering
  let days;
  if (selected.length === 7) days = 'Every day';
  else if (selected.length === 5 && weekdaySet.every((d) => selected.includes(d))) days = 'Weekdays';
  else {
    days = MORNING_REMINDER_WEEKDAY_DISPLAY_ORDER.filter((d) => selected.includes(d))
      .map((d) => MORNING_REMINDER_WEEKDAY_LABELS[d])
      .join(', ');
  }
  return `${days} at ${wakeTime}`;
};

/** The fixed, deterministic notification id for one weekday's reminder. Returns null for an invalid weekday rather than a wrong/colliding id. */
export const getWeekdayReminderId = (weekday) =>
  isValidMorningReminderWeekday(weekday) ? MORNING_REMINDER_WEEKDAY_ID_BASE + weekday : null;

// Every notification id this feature can ever own, across both the
// legacy single-id era and the current weekday set — the exact set
// cancelMorningReminder()/disable()/logout/account-deletion must clear,
// and the exact set the tap/action listener treats as "genuinely ours."
// Never touches any id outside this list.
export const getAllOwnedMorningReminderIds = () => [
  MORNING_REMINDER_NOTIFICATION_ID,
  MORNING_REMINDER_SNOOZE_NOTIFICATION_ID,
  ...ALL_MORNING_REMINDER_WEEKDAYS.map(getWeekdayReminderId)
];

// Fixed action identifiers (Complete Native Wake Reminder Functionality).
// Registered once via registerMorningReminderActions() below and set as
// every scheduled notification's actionTypeId. The tap/action listener
// only ever recognises these exact strings (plus the plugin's own
// built-in 'tap'/'dismiss' ids) — never a value read out of the
// notification payload itself.
export const MORNING_REMINDER_ACTION_TYPE_ID = 'wakewise-morning-reminder';
export const MORNING_REMINDER_ACTIONS = Object.freeze({ BEGIN: 'begin', SNOOZE: 'snooze', SKIP: 'skip' });

// A fixed, documented snooze duration. Matches notificationPreferences.js's
// own existing DEFAULT_PREFERENCES.snoozeMinutes (the separate web
// reminder system's already-established default) rather than introducing
// a second, different "10 minutes" from scratch.
export const MORNING_REMINDER_SNOOZE_MINUTES = 10;

// The real alarm/decision screen (AlarmActive.jsx, route "alarm-trigger"
// in App.jsx) — confirmed by direct audit of App.jsx, Layout.jsx's
// isRinging-driven forced navigation, and sessionDefinitions.js's own
// MORNING_STEP_IDS.ALARM -> '/alarm-trigger' mapping. Both the default
// notification tap and the explicit "Begin" action open this; neither
// opens '/morning-start' (routine Step 1) directly any more, since that
// was the confirmed gap this feature closes. AlarmActive.jsx does not
// gate its own rendering on AlarmContext's isRinging flag, so navigating
// here directly (without also touching isRinging/journeyStep) is safe on
// its own — see the audit notes in MorningReminderContext.jsx for why
// those two are deliberately left untouched by this navigation.
export const MORNING_REMINDER_ALARM_ROUTE = '/alarm-trigger';

// Apple's own UNNotificationSound(named:) falls back to the system
// default sound for any name that doesn't resolve to a real bundled
// sound file (confirmed directly in this plugin's own iOS source,
// LocalNotificationsHandler-adjacent scheduling code: `content.sound =
// UNNotificationSound(named: UNNotificationSoundName(sound))` is only
// set when the `sound` key is present at all — the plugin's own
// bundled README states plainly: "If not provided, it will produce ...
// no sound on iOS", distinct from "if the sound file is not found ...
// the default system notification sound will be used"). No sound asset
// exists anywhere in this repository (see docs/ios-xcode-handoff.md for
// the full custom-sound blocker writeup), so this literal, deliberately
// non-resolving filename is how this module gets the audible default
// system sound rather than silence — not a placeholder for a future
// custom asset (see applyMorningReminderSchedule's `sound` option for
// that).
export const MORNING_REMINDER_DEFAULT_SOUND = 'default';

// The only value this module ever writes into a scheduled notification's
// `extra.target`, and the only value resolveTapTarget() ever trusts back
// out of one. A tap handler must never build a navigation target from an
// arbitrary payload value — it only ever recognises this fixed constant.
const MORNING_REMINDER_TARGET = 'morning-reminder';

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
 * ever resolve to. Checks both the notification id — any id this feature
 * itself owns (getAllOwnedMorningReminderIds(): the legacy single id, the
 * full weekday set, and the snooze id) — and the fixed `extra.target`
 * this module itself wrote; never trusts an arbitrary value read back off
 * the notification payload as a route.
 *
 * Resolves the real alarm/decision screen (MORNING_REMINDER_ALARM_ROUTE) —
 * for the legacy id too, so a stray, not-yet-cancelled legacy-id
 * notification on an upgrading device still opens the correct screen.
 * Confirmed gap this closes: earlier versions of this reminder resolved
 * to '/morning-start' (routine Step 1) instead, not the actual
 * Begin/Snooze/Skip alarm screen — see MORNING_REMINDER_ALARM_ROUTE's own
 * comment for the audit evidence.
 */
export const resolveTapTarget = (actionPerformed) => {
  const notification = actionPerformed?.notification;
  if (!notification) return null;
  if (!getAllOwnedMorningReminderIds().includes(notification.id)) return null;
  if (notification.extra?.target !== MORNING_REMINDER_TARGET) return null;
  return MORNING_REMINDER_ALARM_ROUTE;
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

// ---------------------------------------------------------------------
// Weekday scheduling, notification actions, and snooze
// (Complete Native Wake Reminder Functionality)
// ---------------------------------------------------------------------

/**
 * Registers the fixed Begin/Snooze/Skip action type once. Safe to call
 * repeatedly (registerActionTypes replaces the same id's definition, it
 * does not accumulate). Begin is `foreground: true` — it opens the app to
 * the alarm screen, which requires foregrounding. Snooze and Skip are
 * `foreground: false` — the plugin's own documented, genuinely-supported
 * way to let iOS act on them without bringing the app to the front (an
 * `Action.foreground` field exists specifically for this; see
 * node_modules/@capacitor/local-notifications README.md's Action
 * interface). Actual delivery of a foreground:false action while the app
 * is fully terminated (as opposed to merely backgrounded) is not
 * something the bundled docs make an explicit guarantee about either way
 * — see docs/ios-xcode-handoff.md's physical-device test matrix for this.
 */
export const registerMorningReminderActions = () => {
  if (!isSupported()) return Promise.resolve(false);
  return safe(async () => {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: MORNING_REMINDER_ACTION_TYPE_ID,
          actions: [
            { id: MORNING_REMINDER_ACTIONS.BEGIN, title: 'Begin', foreground: true },
            { id: MORNING_REMINDER_ACTIONS.SNOOZE, title: 'Snooze', foreground: false },
            { id: MORNING_REMINDER_ACTIONS.SKIP, title: 'Skip', foreground: false }
          ]
        }
      ]
    });
    return true;
  }, false);
};

const weekdayReminderNotification = (weekday, parsed, sound) => ({
  id: getWeekdayReminderId(weekday),
  title: 'Good morning',
  body: 'Your WakeWise morning routine is ready.',
  schedule: { on: { weekday, hour: parsed.hour, minute: parsed.minute } },
  actionTypeId: MORNING_REMINDER_ACTION_TYPE_ID,
  extra: { target: MORNING_REMINDER_TARGET },
  sound,
  // Foreground behaviour: while WakeWise is open, AlarmContext's own
  // second-by-second wall-clock check already drives the in-app
  // Begin/Snooze/Skip alarm screen at the same real wake time (see
  // AlarmContext.jsx's Background Clock Observer) — showing the native
  // banner *as well* would be a redundant, confusing second alarm
  // competing with the one already on screen. `silent: true` (iOS-only,
  // documented: "notification will not appear while app is in the
  // foreground") suppresses exactly that overlap without affecting
  // background/locked/terminated delivery, which is unaffected by this
  // flag. This is a "least surprising" design decision, not something the
  // plugin docs mandate either way — the actual foreground timing
  // interplay between this suppression and AlarmContext's own trigger is
  // physical-device-verification territory (see docs/ios-xcode-handoff.md).
  silent: true
});

/**
 * The single entry point for putting the device's actual scheduled
 * reminders in line with a given wake time + weekday selection: cancels
 * every weekday id NOT in the new selection (so an unselected day can
 * never keep firing — schedule() alone only ever replaces ids it
 * re-schedules, it never removes an id that's simply absent from the new
 * call), schedules every weekday id that IS in the selection (replacing
 * any existing pending request for that same id — never a duplicate),
 * and always also cancels the legacy single id (990001) as a one-time
 * migration/cleanup step, per this feature's explicit requirement that
 * the legacy id never remains active once the weekday scheme is in use.
 * Never touches any id outside getAllOwnedMorningReminderIds().
 */
export const applyMorningReminderSchedule = (wakeTime, weekdays, options = {}) => {
  if (!isSupported()) return Promise.resolve(false);
  const parsed = parseWakeTime(wakeTime);
  if (!parsed) return Promise.resolve(false);
  const selected = sanitizeMorningReminderWeekdaysLocal(weekdays);
  const sound = options.sound || MORNING_REMINDER_DEFAULT_SOUND;
  const toCancel = [
    MORNING_REMINDER_NOTIFICATION_ID,
    ...ALL_MORNING_REMINDER_WEEKDAYS.filter((day) => !selected.includes(day)).map(getWeekdayReminderId)
  ];
  return safe(async () => {
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel.map((id) => ({ id })) });
    }
    await LocalNotifications.schedule({
      notifications: selected.map((weekday) => weekdayReminderNotification(weekday, parsed, sound))
    });
    return true;
  }, false);
};

// Local, dependency-free mirror of notificationPreferences.js's own
// sanitizeNativeReminderWeekdays — deliberately not imported from there
// (this module already depends on the native plugin; the preferences
// module deliberately stays dependency-free — see its own file header)
// so each layer defensively validates on its own terms rather than
// trusting the other never to pass through something invalid.
const sanitizeMorningReminderWeekdaysLocal = (value) => {
  if (!Array.isArray(value)) return [...ALL_MORNING_REMINDER_WEEKDAYS];
  const valid = [...new Set(value.filter(isValidMorningReminderWeekday))].sort((a, b) => a - b);
  return valid.length > 0 ? valid : [...ALL_MORNING_REMINDER_WEEKDAYS];
};

/** Cancels every id this feature could ever own — weekday set, snooze, and the legacy id. Never touches anything else. */
export const cancelAllMorningReminders = () => {
  if (!isSupported()) return Promise.resolve(false);
  return safe(async () => {
    await LocalNotifications.cancel({ notifications: getAllOwnedMorningReminderIds().map((id) => ({ id })) });
    return true;
  }, false);
};

/**
 * Which of the owned weekday ids are actually pending on-device right
 * now, expressed back as weekday numbers — the device-truth counterpart
 * to a stored weekday preference, used by MorningReminderContext's
 * reconciliation to decide whether a reschedule is actually needed rather
 * than trusting the stored selection blindly.
 */
export const getPendingMorningReminderWeekdays = () => {
  if (!isSupported()) return Promise.resolve([]);
  return safe(async () => {
    const { notifications } = await LocalNotifications.getPending();
    const pendingIds = new Set(notifications.map((n) => n.id));
    return ALL_MORNING_REMINDER_WEEKDAYS.filter((day) => pendingIds.has(getWeekdayReminderId(day)));
  }, []);
};

/**
 * Schedules exactly one, deterministic, one-time snooze notification
 * MORNING_REMINDER_SNOOZE_MINUTES from now. Fixed id — calling this again
 * (e.g. Snooze tapped a second time) replaces the same pending snooze
 * rather than accumulating a second one. Never touches any weekday id, so
 * the next regular reminder is always preserved untouched.
 */
export const scheduleSnoozeMorningReminder = (options = {}) => {
  if (!isSupported()) return Promise.resolve(false);
  const sound = options.sound || MORNING_REMINDER_DEFAULT_SOUND;
  return safe(async () => {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: MORNING_REMINDER_SNOOZE_NOTIFICATION_ID,
          title: 'Good morning',
          body: 'Your WakeWise morning routine is ready.',
          schedule: { at: new Date(Date.now() + MORNING_REMINDER_SNOOZE_MINUTES * 60 * 1000) },
          actionTypeId: MORNING_REMINDER_ACTION_TYPE_ID,
          extra: { target: MORNING_REMINDER_TARGET },
          sound,
          silent: true
        }
      ]
    });
    return true;
  }, false);
};

/** Cancels a pending snooze, if any. Never touches the weekday schedule. */
export const cancelSnoozeMorningReminder = () => {
  if (!isSupported()) return Promise.resolve(false);
  return safe(async () => {
    await LocalNotifications.cancel({ notifications: [{ id: MORNING_REMINDER_SNOOZE_NOTIFICATION_ID }] });
    return true;
  }, false);
};

/**
 * Validates a live weekday-selection CHANGE request (e.g. a Settings
 * toggle tap): dedupes and filters to valid Capacitor weekday numbers,
 * then refuses the change outright (`ok: false`) if the result would be
 * empty. This is deliberately distinct from
 * notificationPreferences.js's own sanitizeNativeReminderWeekdays, which
 * *migrates* malformed/older stored data by falling back to "every day"
 * — a live user action that would empty the selection is refused instead
 * of silently substituted, so "require at least one selected day while
 * the reminder is enabled" is a real refusal, not a surprising reset to
 * every day. Pure and side-effect-free so it's directly unit-testable.
 */
export const validateWeekdaySelectionChange = (requested) => {
  const valid = [...new Set((Array.isArray(requested) ? requested : []).filter(isValidMorningReminderWeekday))].sort(
    (a, b) => a - b
  );
  return valid.length > 0 ? { ok: true, weekdays: valid } : { ok: false, weekdays: null };
};

/**
 * The pure reconciliation DECISION: given the current permission, the
 * user's stored intent/weekdays, the schedule-relevant fingerprint of
 * "what should be scheduled right now" (wake time + weekdays + device
 * timezone/offset), what's genuinely still pending on-device, and the
 * fingerprint from the last time this actually rescheduled anything,
 * decides exactly what MorningReminderContext.reconcile() should do next.
 * Never calls the native plugin, never requests permission, and never
 * touches React state itself — kept side-effect-free and
 * framework-independent specifically so the reconciliation logic (this
 * repo has no @testing-library/react dependency to render a context with)
 * is directly unit-testable. reconcile() is a thin orchestrator: it
 * gathers this input, calls this function once, then carries out
 * whichever `action` comes back.
 *
 * `action` is one of:
 *   'cancel-all'     — something is pending that shouldn't be; cancel it.
 *   'apply-schedule'  — the fingerprint or live device state diverged from
 *                       what's wanted; (re)apply the weekday schedule.
 *   'none'            — already correct; do nothing (this is exactly what
 *                       keeps a resume/appStateChange reconcile from
 *                       rescheduling on every single call).
 */
export const decideMorningReminderReconciliation = ({
  permission,
  intentEnabled,
  wakeTime,
  weekdays,
  pendingWeekdays,
  fingerprint,
  lastReconciledFingerprint
}) => {
  if (permission === 'denied') {
    return { action: pendingWeekdays.length > 0 ? 'cancel-all' : 'none', liveEnabled: false, scheduledTime: null };
  }
  if (permission !== 'granted') {
    // 'prompt' / 'prompt-with-rationale' / 'unsupported' / 'error' — not
    // yet decided either way; this decision never requests permission,
    // and neither does its only caller's reconcile path (see
    // MorningReminderContext.jsx — only enable() ever requests it).
    return { action: 'none', liveEnabled: false, scheduledTime: null };
  }
  if (!intentEnabled || !wakeTime) {
    return { action: pendingWeekdays.length > 0 ? 'cancel-all' : 'none', liveEnabled: false, scheduledTime: null };
  }
  const pendingMatches =
    pendingWeekdays.length === weekdays.length && weekdays.every((day) => pendingWeekdays.includes(day));
  const needsSchedule = fingerprint !== lastReconciledFingerprint || !pendingMatches;
  return { action: needsSchedule ? 'apply-schedule' : 'none', liveEnabled: true, scheduledTime: wakeTime };
};

/**
 * The single entry point the tap/action listener calls for every
 * 'localNotificationActionPerformed' event. Validates ownership first
 * (an owned id *and* the fixed extra.target — exactly resolveTapTarget's
 * own check) and rejects anything else outright, with no side effect at
 * all — a foreign or malformed payload never schedules, cancels, or
 * navigates anything. Every operation below (schedule/cancel by fixed id,
 * returning a fixed route) is naturally idempotent under duplicate or
 * concurrent delivery of the same action, by construction — no separate
 * dedup store is needed the way the auth-recovery deep-link flow needed
 * one, since re-running any of these twice converges on the same end
 * state rather than compounding.
 *
 * Returns `{ route: string | null }` — the hook navigates only when a
 * route is returned.
 */
export const handleMorningReminderAction = async (actionPerformed) => {
  const notification = actionPerformed?.notification;
  const actionId = actionPerformed?.actionId;
  if (!notification || typeof actionId !== 'string') return { route: null };
  if (!getAllOwnedMorningReminderIds().includes(notification.id)) return { route: null };
  if (notification.extra?.target !== MORNING_REMINDER_TARGET) return { route: null };

  switch (actionId) {
    case 'tap':
    case MORNING_REMINDER_ACTIONS.BEGIN:
      return { route: MORNING_REMINDER_ALARM_ROUTE };
    case MORNING_REMINDER_ACTIONS.SNOOZE:
      await scheduleSnoozeMorningReminder();
      return { route: null };
    case MORNING_REMINDER_ACTIONS.SKIP:
      await cancelSnoozeMorningReminder();
      return { route: null };
    default:
      // Includes the plugin's own 'dismiss' id (swipe-away) and any
      // unrecognised action id — never routed, never acted on.
      return { route: null };
  }
};
