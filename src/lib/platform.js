import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const getPlatform = () => Capacitor.getPlatform();

export const isIOS = () => Capacitor.getPlatform() === 'ios';

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
