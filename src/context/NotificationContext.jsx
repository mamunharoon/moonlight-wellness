/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import {
  getNotificationPreferences,
  updateGlobalEnabled as persistGlobalEnabled,
  updateQuietHours as persistQuietHours,
  updateSnoozeMinutes as persistSnoozeMinutes,
  updateCategory as persistCategory
} from '../lib/notificationPreferences';
import {
  getNotificationPermission,
  requestNotificationPermission,
  isNotificationSupported
} from '../lib/notificationService';
import { startNotificationScheduler, stopNotificationScheduler, snoozeCategory } from '../lib/notificationScheduler';
import { trackEvent } from '../lib/analyticsEvents';

const NotificationContext = createContext();

/*
 * WakeWise — Notifications & Reminders, Phase B — NotificationContext
 *
 * Mirrors SubscriptionContext's provider shape (state + loading-free
 * synchronous localStorage reads instead of a network fetch). The
 * scheduler is started once on mount and left running for the app's
 * lifetime — notificationScheduler's own tick() checks `enabled` on
 * every pass, so there's nothing to start/stop as preferences change,
 * only on unmount.
 */
export const NotificationProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(getNotificationPreferences);
  const [permission, setPermission] = useState(getNotificationPermission);

  useEffect(() => {
    startNotificationScheduler();
    return () => stopNotificationScheduler();
  }, []);

  const requestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  };

  const setGlobalEnabled = (enabled) => {
    if (enabled && permission === 'default' && isNotificationSupported()) {
      requestPermission();
    }
    setPreferences(persistGlobalEnabled(enabled));
    trackEvent('notification_preferences_updated', { field: 'enabled', value: enabled });
  };

  const setQuietHours = (quietHours) => {
    setPreferences(persistQuietHours(quietHours));
    trackEvent('notification_preferences_updated', { field: 'quietHours' });
  };

  const setSnoozeMinutes = (snoozeMinutes) => {
    setPreferences(persistSnoozeMinutes(snoozeMinutes));
    trackEvent('notification_preferences_updated', { field: 'snoozeMinutes' });
  };

  const setCategory = (categoryId, changes) => {
    setPreferences(persistCategory(categoryId, changes));
    trackEvent('notification_preferences_updated', { field: 'category', category: categoryId });
  };

  const snooze = (categoryId) => {
    snoozeCategory(categoryId, preferences.snoozeMinutes);
  };

  return (
    <NotificationContext.Provider
      value={{
        preferences,
        permission,
        supported: isNotificationSupported(),
        requestPermission,
        setGlobalEnabled,
        setQuietHours,
        setSnoozeMinutes,
        setCategory,
        snooze
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
