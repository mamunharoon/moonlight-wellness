/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from './AuthContext';
import { useAlarm } from './AlarmContext';
import {
  isSupported,
  checkPermission,
  requestPermission,
  cancelAllMorningReminders,
  applyMorningReminderSchedule,
  getPendingMorningReminderWeekdays,
  formatMorningReminderScheduleSummary,
  validateWeekdaySelectionChange,
  decideMorningReminderReconciliation
} from '../lib/nativeMorningReminder';
import {
  getNotificationPreferences,
  updateNativeMorningReminderEnabled,
  updateNativeMorningReminderWeekdays,
  updateNativeMorningReminderFingerprint
} from '../lib/notificationPreferences';
import { detectDeviceTimezone } from '../lib/timezone';

const MorningReminderContext = createContext();

/*
 * WakeWise iOS Native Morning Reminders.
 *
 * Deliberately separate from NotificationContext.jsx (the existing,
 * unmodified web/foreground-only Notifications & Reminders Phase B
 * system) — this drives the user's real, weekday-selectable native iOS
 * local notifications tied to their real saved wake time (AlarmContext's
 * alarmTime), which is why this provider is mounted inside
 * <AlarmProvider>, not alongside NotificationProvider near the top of the
 * tree where AlarmContext isn't yet available.
 *
 * All Capacitor calls live in ../lib/nativeMorningReminder.js; this
 * context only holds UI-facing state and decides *when* to call it
 * (mount, app becoming active, wake-time/weekday change, explicit
 * enable/disable, sign-out).
 *
 * Intent vs. actual device state — Complete Native Wake Reminder
 * Functionality:
 *   - preferences.nativeMorningReminder.enabled (persisted) is the user's
 *     own last explicit choice — set only by enable()/disable() (and
 *     disable() alone by logout/account-deletion, both of which already
 *     call disable() below). It deliberately survives a permission
 *     denial, so that granting permission again from iPhone Settings can
 *     resume the reminder on the next reconcile() without requiring the
 *     user to re-find and re-tap the toggle — see reconcile()'s own
 *     comment and the task's explicit "If permission is now granted and
 *     the user preference remains enabled, schedule/reconcile reminders"
 *     requirement.
 *   - `enabled` (this context's own React state, returned below) is
 *     always the LIVE, derived "is something actually scheduled and
 *     permitted right now" — exactly what the Settings toggle displays,
 *     never trusted from the stored intent alone. Same contract as
 *     before this feature.
 */
export const MorningReminderProvider = ({ children }) => {
  const { user } = useAuth();
  const { alarmTime } = useAlarm();
  const supported = isSupported();

  const [enabled, setEnabled] = useState(() => getNotificationPreferences().nativeMorningReminder.enabled);
  const [permissionStatus, setPermissionStatus] = useState('not-requested');
  const [scheduledTime, setScheduledTime] = useState(null);
  const [weekdays, setWeekdaysState] = useState(() => getNotificationPreferences().nativeMorningReminder.weekdays);

  // Reconciliation must never run twice concurrently (mount effect,
  // appStateChange, and a wake-time/weekday change can all ask for one in
  // quick succession) — a simple in-flight guard keeps it to one pass at
  // a time without needing any more elaborate scheduling.
  const reconcilingRef = useRef(false);

  // The exact, minimum non-sensitive fingerprint of "what should be
  // scheduled right now": wake time, the weekday selection, and the
  // device's own timezone identity/offset (so a real timezone or DST
  // change is explicitly reconciled, rather than relying solely on the
  // OS's own calendar-trigger recomputation). Never includes anything
  // about the user beyond this.
  const buildFingerprint = useCallback(
    (wakeTimeValue, weekdaysValue) =>
      `${wakeTimeValue}|${weekdaysValue.join(',')}|${new Date().getTimezoneOffset()}|${detectDeviceTimezone()}`,
    []
  );

  // The single reconciliation pass: rechecks permission (read-only —
  // never requests it), reconciles the stored enable/disable intent
  // against live device state, rebuilds the weekday schedule only when
  // something scheduling-relevant actually changed (comparing the
  // persisted fingerprint against a freshly computed one, and cross-
  // checking against what's genuinely still pending on-device — never
  // reschedules just because this ran again with nothing changed), and is
  // always safe to call whether or not a user is signed in or the app is
  // running on web (isSupported() gates every native call it makes).
  const reconcile = useCallback(async () => {
    if (!supported || reconcilingRef.current) return;
    reconcilingRef.current = true;
    try {
      const prefs = getNotificationPreferences();
      const intentEnabled = prefs.nativeMorningReminder.enabled;
      const storedWeekdays = prefs.nativeMorningReminder.weekdays;
      setWeekdaysState(storedWeekdays);

      const permission = await checkPermission();
      setPermissionStatus(permission);

      const pendingWeekdays = await getPendingMorningReminderWeekdays();
      const fingerprint = buildFingerprint(alarmTime, storedWeekdays);

      // All the actual reconciliation logic is a pure decision (see
      // decideMorningReminderReconciliation's own doc comment for why) —
      // this just gathers the inputs, then carries out whichever action
      // comes back.
      const { action, liveEnabled, scheduledTime: nextScheduledTime } = decideMorningReminderReconciliation({
        permission,
        intentEnabled,
        wakeTime: alarmTime,
        weekdays: storedWeekdays,
        pendingWeekdays,
        fingerprint,
        lastReconciledFingerprint: prefs.nativeMorningReminder.lastReconciledFingerprint
      });

      if (action === 'cancel-all') {
        await cancelAllMorningReminders();
      } else if (action === 'apply-schedule') {
        const ok = await applyMorningReminderSchedule(alarmTime, storedWeekdays);
        if (ok) updateNativeMorningReminderFingerprint(fingerprint);
      }

      setEnabled(liveEnabled);
      setScheduledTime(nextScheduledTime);
    } finally {
      reconcilingRef.current = false;
    }
  }, [supported, alarmTime, buildFingerprint]);

  // App start: read real state, never trust the stored flag blindly.
  useEffect(() => {
    reconcile();
    // reconcile is stable across the deps that matter (alarmTime changes
    // are handled by the effect below, which calls reconcile() itself).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App becoming active (foreground/resume): the idempotent
  // reconciliation path required by this feature — rechecks permission,
  // reconciles enabled/disabled intent, rebuilds the schedule only if the
  // fingerprint or live device state actually diverged (handles a
  // timezone/DST change or an out-of-app permission change), and never
  // requests permission or reschedules unnecessarily. Registered only
  // when native — @capacitor/app's web shim is inert, but every other
  // native-only listener in this app (deep links, the reminder tap
  // handler) is gated the same explicit way, so this stays consistent.
  useEffect(() => {
    if (!supported) return undefined;
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) reconcile();
    });
    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [supported, reconcile]);

  // Wake-time changed while the reminder is on: reconcile (which
  // reschedules only if the resulting fingerprint actually differs).
  useEffect(() => {
    if (!supported || !enabled || !alarmTime) return;
    reconcile();
    // Intentionally reacts to alarmTime only — enable()/disable()/
    // setWeekdays already reconcile/schedule themselves, so re-running
    // this on every `enabled` flip would just double the native call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmTime]);

  // Explicit sign-out: cancel every owned reminder rather than leaving a
  // "your WakeWise morning routine is ready" notification scheduled for
  // whoever's session comes next on this device, and reset the stored
  // intent so it doesn't silently resume for a different account later.
  const previousUserIdRef = useRef(user?.id ?? null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (supported && previousUserIdRef.current !== null && currentUserId === null) {
      cancelAllMorningReminders().then(() => {
        updateNativeMorningReminderEnabled(false);
        setEnabled(false);
        setScheduledTime(null);
      });
    }
    previousUserIdRef.current = currentUserId;
  }, [user, supported]);

  const enable = useCallback(async () => {
    if (!supported) return { ok: false, reason: 'unsupported' };
    let permission = await checkPermission();
    if (permission !== 'granted') {
      // The one and only place this feature ever requests permission —
      // always behind this explicit, user-initiated call.
      permission = await requestPermission();
    }
    setPermissionStatus(permission);

    // Record intent as "on" regardless of the outcome: the user just
    // explicitly asked for this, so a later permission grant (from
    // iPhone Settings, without re-tapping the toggle) should resume it —
    // see this file's header comment and reconcile()'s denied-permission
    // branch, which deliberately never clears this same flag.
    updateNativeMorningReminderEnabled(true);

    if (permission !== 'granted') {
      setEnabled(false);
      setScheduledTime(null);
      return { ok: false, reason: permission };
    }

    const storedWeekdays = getNotificationPreferences().nativeMorningReminder.weekdays;
    setWeekdaysState(storedWeekdays);
    const ok = await applyMorningReminderSchedule(alarmTime, storedWeekdays);
    if (ok) updateNativeMorningReminderFingerprint(buildFingerprint(alarmTime, storedWeekdays));
    setEnabled(ok);
    setScheduledTime(ok ? alarmTime : null);
    return { ok, reason: ok ? null : 'schedule-failed' };
  }, [supported, alarmTime, buildFingerprint]);

  const disable = useCallback(async () => {
    updateNativeMorningReminderEnabled(false);
    await cancelAllMorningReminders();
    setEnabled(false);
    setScheduledTime(null);
  }, []);

  // Persists a validated weekday selection and, if the reminder is
  // currently on, immediately reschedules to match — cancelling any
  // now-deselected day's pending notification and never accumulating a
  // duplicate for a day that stays selected (applyMorningReminderSchedule
  // handles both). Silently ignores an attempt to end up with zero
  // selected days rather than persisting or acting on one — "require at
  // least one selected day while the reminder is enabled" enforced here,
  // not just in the UI that calls this.
  const setWeekdays = useCallback(
    async (nextWeekdays) => {
      const validated = validateWeekdaySelectionChange(nextWeekdays);
      if (!validated.ok) return { ok: false, reason: 'at-least-one-day-required' };

      const updated = updateNativeMorningReminderWeekdays(validated.weekdays).nativeMorningReminder.weekdays;
      setWeekdaysState(updated);

      if (!supported || !enabled || !alarmTime) return { ok: true };

      const ok = await applyMorningReminderSchedule(alarmTime, updated);
      if (ok) updateNativeMorningReminderFingerprint(buildFingerprint(alarmTime, updated));
      return { ok };
    },
    [supported, enabled, alarmTime, buildFingerprint]
  );

  const scheduleSummary = formatMorningReminderScheduleSummary(weekdays, enabled ? scheduledTime ?? alarmTime : null);

  return (
    <MorningReminderContext.Provider
      value={{
        supported,
        enabled,
        permissionStatus,
        scheduledTime,
        wakeTime: alarmTime,
        weekdays,
        setWeekdays,
        scheduleSummary,
        enable,
        disable,
        reconcile
      }}
    >
      {children}
    </MorningReminderContext.Provider>
  );
};

export const useMorningReminder = () => useContext(MorningReminderContext);
