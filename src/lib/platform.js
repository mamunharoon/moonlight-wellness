import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const getPlatform = () => Capacitor.getPlatform();

export const isIOS = () => Capacitor.getPlatform() === 'ios';

// WakeWise Phase 2B — RevenueCat targets both iOS and Android (unlike the
// existing Apple-direct adapter, which is iOS-only), so a symmetric
// isAndroid() is now needed for the first time in this codebase. Also used
// by useAndroidBackButton.js to gate the system Back button/gesture fix to
// Android only.
export const isAndroid = () => Capacitor.getPlatform() === 'android';

export const isWeb = () => Capacitor.getPlatform() === 'web';

/**
 * Runs a native-only action guarded by platform detection so a missing or
 * failing native plugin never breaks the web/PWA experience.
 */
export const runNative = (fn) => {
  if (!isNativePlatform()) return undefined;
  try {
    return fn();
  } catch (error) {
    console.warn('[platform] native action failed, continuing without it', error);
    return undefined;
  }
};
