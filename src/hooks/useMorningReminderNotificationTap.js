import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativePlatform } from '../lib/platform';
import { resolveTapTarget } from '../lib/nativeMorningReminder';

/**
 * Routes a tapped morning-reminder notification to its fixed in-app
 * target (see resolveTapTarget in nativeMorningReminder.js) — the only
 * route any notification tap can ever resolve to; nothing in the
 * notification payload is used to build a navigation target directly.
 */
export function useMorningReminderNotificationTap() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePlatform()) return undefined;

    const listenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', (actionPerformed) => {
      const target = resolveTapTarget(actionPerformed);
      if (target) navigate(target);
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);
}
