import type { CapacitorConfig } from '@capacitor/cli';

// WebView (Safari Web Inspector) debugging is local/USB-only - it never
// exposes anything over the network - but must never ship in a
// TestFlight/App Store build (see
// docs/ios-security-privacy-future-requirements.md). Defaulting to
// false here means every CI/release build gets it off automatically,
// with no step required to remember to turn it off. For local
// Xcode/device debugging, opt in explicitly:
//   CAPACITOR_WEB_DEBUG=true npm run cap:sync
const webContentsDebuggingEnabled = process.env.CAPACITOR_WEB_DEBUG === 'true';

const config: CapacitorConfig = {
  appId: 'com.zavaraai.wakewise',
  appName: 'WakeWise',
  webDir: 'dist',
  backgroundColor: '#0b1326',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0b1326',
    webContentsDebuggingEnabled,
  },
};

export default config;
