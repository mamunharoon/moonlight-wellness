// WakeWise — Notifications & Reminders, Phase B — service layer.
//
// Wraps the browser's Web Notifications API. This delivers foreground /
// tab-open reminders only — there is no service worker or push
// subscription here, so nothing fires while the app or browser is fully
// closed. That's a real limitation of "architecture only, no backend",
// called out in the final report rather than presented as OS-level push.
import { trackEvent } from './analyticsEvents';
import { getCachedTimezone, getZonedParts } from './timezone';

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

// Global timezone correctness: `zoned` is a src/lib/timezone.js
// getZonedParts() result - the user's own local wall-clock components in
// their confirmed (or device-detected, while unconfirmed) timezone -
// never a raw Date read against the device's live clock. Defaults to
// "right now, in the cached effective timezone" so any existing caller
// that doesn't pass one explicitly still gets timezone-correct behaviour
// rather than silently falling back to UTC or device-local.
export const isWithinQuietHours = (quietHours, zoned = getZonedParts(getCachedTimezone())) => {
  if (!quietHours?.enabled) return false;
  const minutesNow = zoned.minutesSinceMidnight;
  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  // overnight range (e.g. 22:00 -> 07:00) wraps past midnight
  return start > end ? minutesNow >= start || minutesNow < end : minutesNow >= start && minutesNow < end;
};

export const isWeekdayAllowed = (weekdays, zoned = getZonedParts(getCachedTimezone())) =>
  Array.isArray(weekdays) && weekdays.includes(zoned.weekday);

// Lets a user confirm reminders actually show up, independent of any
// scheduled category time — used by the "Send test notification" button.
export const showTestNotification = () =>
  showNotification('Test notification', { body: 'This is what a WakeWise reminder looks like.', tag: 'test' });
