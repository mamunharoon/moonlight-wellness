/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useAlarm } from './AlarmContext';
import {
  isSupported,
  checkPermission,
  scheduleMorningReminder,
  cancelMorningReminder,
  getPendingMorningReminder,
  enableMorningReminder,
  disableMorningReminder
} from '../lib/nativeMorningReminder';
import { getNotificationPreferences, updateNativeMorningReminderEnabled } from '../lib/notificationPreferences';

const MorningReminderContext = createContext();

/*
 * WakeWise iOS Native Morning Reminders.
 *
 * Deliberately separate from NotificationContext.jsx (the existing,
 * unmodified web/foreground-only Notifications & Reminders Phase B
 * system) — this drives one native iOS local notification tied to the
 * user's real saved wake time (AlarmContext's alarmTime), which is why
 * this provider is mounted inside <AlarmProvider>, not alongside
 * NotificationProvider near the top of the tree where AlarmContext isn't
 * yet available.
 *
 * All Capacitor calls live in ../lib/nativeMorningReminder.js; this
 * context only holds UI-facing state and decides *when* to call it
 * (mount, wake-time change, explicit sign-out).
 */
export const MorningReminderProvider = ({ children }) => {
  const { user } = useAuth();
  const { alarmTime } = useAlarm();
  const supported = isSupported();

  const [enabled, setEnabled] = useState(() => getNotificationPreferences().nativeMorningReminder.enabled);
  const [permissionStatus, setPermissionStatus] = useState('not-requested');
  const [scheduledTime, setScheduledTime] = useState(null);

  // Reads what iOS actually has scheduled and permitted right now. Pure
  // fetch, no setState here — see applyReminderState below, which is
  // always called from a callback (a .then(), never an effect body) so
  // this never triggers a synchronous setState-in-effect cascade.
  const fetchReminderState = useCallback(async () => {
    if (!supported) return null;
    const [permission, pending] = await Promise.all([checkPermission(), getPendingMorningReminder()]);
    return { permission, pending };
  }, [supported]);

  // Never assumes the stored "enabled" flag is still accurate — permission
  // can be revoked, or iOS can drop a pending notification, outside the app.
  const applyReminderState = useCallback((state) => {
    if (!state) return;
    const { permission, pending } = state;
    setPermissionStatus(permission);
    const on = pending?.schedule?.on;
    setScheduledTime(on ? `${String(on.hour).padStart(2, '0')}:${String(on.minute).padStart(2, '0')}` : null);
    const actuallyOn = permission === 'granted' && Boolean(pending);
    setEnabled(actuallyOn);
    updateNativeMorningReminderEnabled(actuallyOn);
  }, []);

  const reconcile = useCallback(async () => {
    applyReminderState(await fetchReminderState());
  }, [fetchReminderState, applyReminderState]);

  // App start / resume: read real state, never trust the stored flag
  // blindly. setState only happens inside the .then() callback, not
  // synchronously in the effect body.
  useEffect(() => {
    let ignore = false;
    fetchReminderState().then((state) => {
      if (!ignore) applyReminderState(state);
    });
    return () => {
      ignore = true;
    };
  }, [fetchReminderState, applyReminderState]);

  // Wake-time changed while the reminder is on: reschedule (same fixed id
  // replaces the pending one, so this never duplicates).
  useEffect(() => {
    if (!supported || !enabled || !alarmTime) return;
    scheduleMorningReminder(alarmTime).then((ok) => {
      if (!ok) reconcile();
    });
    // Intentionally reacts to alarmTime only — enable()/disable() already
    // schedule/cancel themselves, so re-running this on every `enabled`
    // flip would just double the native call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmTime]);

  // Explicit sign-out: cancel the account-associated reminder rather than
  // leaving a "your WakeWise morning routine is ready" notification
  // scheduled for whoever's session comes next on this device.
  const previousUserIdRef = useRef(user?.id ?? null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (supported && previousUserIdRef.current !== null && currentUserId === null) {
      cancelMorningReminder().then(() => {
        updateNativeMorningReminderEnabled(false);
        setEnabled(false);
        setScheduledTime(null);
      });
    }
    previousUserIdRef.current = currentUserId;
  }, [user, supported]);

  const enable = useCallback(async () => {
    const { ok, permission } = await enableMorningReminder(alarmTime);
    setPermissionStatus(permission);
    setEnabled(ok);
    updateNativeMorningReminderEnabled(ok);
    if (ok) await reconcile();
    return { ok, reason: ok ? null : permission };
  }, [alarmTime, reconcile]);

  const disable = useCallback(async () => {
    await disableMorningReminder();
    setEnabled(false);
    updateNativeMorningReminderEnabled(false);
    setScheduledTime(null);
  }, []);

  return (
    <MorningReminderContext.Provider
      value={{ supported, enabled, permissionStatus, scheduledTime, wakeTime: alarmTime, enable, disable, reconcile }}
    >
      {children}
    </MorningReminderContext.Provider>
  );
};

export const useMorningReminder = () => useContext(MorningReminderContext);
