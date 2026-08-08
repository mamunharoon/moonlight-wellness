// WakeWise — Notifications & Reminders, Phase B — service layer.
//
// Wraps the browser's Web Notifications API. This delivers foreground /
// tab-open reminders only — there is no service worker or push
// subscription here, so nothing fires while the app or browser is fully
// closed. That's a real limitation of "architecture only, no backend",
// called out in the final report rather than presented as OS-level push.
import { trackEvent } from './analyticsEvents';

export const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export const getNotificationPermission = () =>
  isNotificationSupported() ? Notification.permission : 'unsupported';

export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    trackEvent('notification_permission_requested', { result: permission });
    return permission;
  } catch (e) {
    console.error('Error requesting notification permission:', e.message);
    return getNotificationPermission();
  }
};

export const showNotification = (title, options = {}) => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return null;
  try {
    return new Notification(title, { icon: '/icon-192.png', badge: '/icon-192.png', ...options });
  } catch (e) {
    console.error('Error showing notification:', e.message);
    return null;
  }
};

export const isWithinQuietHours = (quietHours, now = new Date()) => {
  if (!quietHours?.enabled) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  // overnight range (e.g. 22:00 -> 07:00) wraps past midnight
  return start > end ? minutesNow >= start || minutesNow < end : minutesNow >= start && minutesNow < end;
};

export const isWeekdayAllowed = (weekdays, now = new Date()) =>
  Array.isArray(weekdays) && weekdays.includes(now.getDay());

// Lets a user confirm reminders actually show up, independent of any
// scheduled category time — used by the "Send test notification" button.
export const showTestNotification = () =>
  showNotification('Test notification', { body: 'This is what a WakeWise reminder looks like.', tag: 'test' });
