// WakeWise's bundled, first-party alarm chime — see
// docs/wakewise-alarm-sound-provenance.md for full provenance. Served
// from the app's own origin ('self' under CSP, no external request, no
// CSP change needed) so both the real ringing alarm (AlarmContext.jsx)
// and the "Test alarm sound" preview (NotificationSettings.jsx) always
// reference the exact same asset — kept in one place so they can't drift.
export const ALARM_CHIME_URL = '/audio/wakewise-alarm-chime.wav';
export const ALARM_CHIME_TITLE = 'WakeWise Alarm';
