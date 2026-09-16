import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativePlatform } from '../lib/platform';
import { registerMorningReminderActions, handleMorningReminderAction } from '../lib/nativeMorningReminder';

/**
 * Registers the fixed Begin/Snooze/Skip action type once, then handles
 * every action performed on an owned morning-reminder notification — a
 * default tap or the Begin action opens the real alarm/decision screen;
 * Snooze/Skip trigger their own native scheduling side effects with no
 * navigation. All ownership/payload validation and the actual
 * schedule()/cancel() calls live in handleMorningReminderAction
 * (nativeMorningReminder.js) — this hook only wires the native listener
 * and performs the navigation it's told to, exactly as before. Nothing in
 * the notification payload is ever used to build a route directly.
 */
export function useMorningReminderNotificationTap() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePlatform()) return undefined;

    // Registered once per mount of this app-root-level handler — safe to
    // repeat (registerActionTypes replaces the same action-type id, it
    // never accumulates), and never itself requests notification
    // permission or prompts the user.
    registerMorningReminderActions();

    const listenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', (actionPerformed) => {
      handleMorningReminderAction(actionPerformed).then(({ route }) => {
        if (route) navigate(route);
      });
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);
}
