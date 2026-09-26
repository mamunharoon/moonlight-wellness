// WakeWise DEV — alarm wake-up sound picker.
//
// Audit before writing this file: only ONE real, playable alarm sound
// asset exists in this app today (public/audio/wakewise-alarm-chime.wav,
// see docs/wakewise-alarm-sound-provenance.md - a first-party, mathematically
// synthesised chime with no external/licensed content). The five intended
// choices this feature is meant to offer are Gentle Chimes, Morning
// Piano, Birdsong & Chimes, Warm Marimba, and Bright Chimes - only the
// first is real. The other four have no recorded/synthesised asset yet
// and are NOT assigned an unrelated existing track (e.g. a sleep
// soundscape) as a stand-in - that would misrepresent what the user is
// choosing. They follow this app's own established `comingSoon` pattern
// instead (audioLibrary.js: `comingSoon: true`, AudioCard.jsx's own
// "Coming soon" badge, AudioDetails.jsx's own `if (locked || entry.comingSoon)
// return;` play-guard) - visible, honestly labelled, not selectable or
// previewable, until a real asset exists for each.
//
// IMPORTANT PLATFORM LIMIT (read before extending this feature further):
// this picker only ever affects WakeWise's own FOREGROUND alarm chime -
// the one AlarmContext.jsx plays via the Web Audio element while the app
// is open (AlarmActive.jsx). It has no effect on the SEPARATE native
// background reminder notification (nativeMorningReminder.js) - that
// uses iOS's own default system notification sound today, and Capacitor's
// LocalNotifications plugin requires a custom sound to be bundled into
// the native Xcode project ahead of time (not something a JS source
// change alone can add) - see NotificationSettings.jsx's own updated
// disclaimer for the user-facing version of this same limit.
import { ALARM_CHIME_URL, ALARM_CHIME_TITLE } from './alarmSound';

export const ALARM_SOUNDS = Object.freeze([
  { id: 'gentle-chimes', label: 'Gentle Chimes', title: ALARM_CHIME_TITLE, url: ALARM_CHIME_URL, available: true },
  { id: 'morning-piano', label: 'Morning Piano', title: null, url: null, available: false },
  { id: 'birdsong-chimes', label: 'Birdsong & Chimes', title: null, url: null, available: false },
  { id: 'warm-marimba', label: 'Warm Marimba', title: null, url: null, available: false },
  { id: 'bright-chimes', label: 'Bright Chimes', title: null, url: null, available: false }
]);

export const DEFAULT_ALARM_SOUND_ID = 'gentle-chimes';

export const getAlarmSoundById = (id) => ALARM_SOUNDS.find((s) => s.id === id) ?? null;

// Always resolves to a genuinely playable sound - an unknown id (storage
// tampering, an id that no longer exists) or one that isn't available
// yet both fall back to the real default, never to a silent/broken
// selection and never to a fabricated URL.
export const resolvePlayableAlarmSound = (id) => {
  const sound = getAlarmSoundById(id);
  return sound?.available ? sound : ALARM_SOUNDS.find((s) => s.id === DEFAULT_ALARM_SOUND_ID);
};

// User-scoped localStorage persistence, mirroring dailyCompletion.js's
// own established scopedKey pattern exactly: `userId` is the Supabase
// auth id (never an email - an opaque id is safe to embed in a key
// name), so a registered user's own choice can never leak to or from a
// different identity, or a guest, on the same device. Deliberately
// local-only for this pass, not a new Supabase column: this app's own
// wake-time/bedtime already have a real synced Supabase column, but
// adding one for this new field would mean shipping a client that
// queries a column that may not exist in the live database yet - the
// same "don't add a fetch/complication the screen doesn't need yet"
// reasoning already applied to the Welcome Back alarm-summary decision.
// Consequence, disclosed in the implementation report: the sound choice
// is per-device today, not synced across a signed-in user's devices.
const ALARM_SOUND_BASE_KEY = 'moonlight_alarm_sound_id';
const scopedKey = (userId) => (userId ? `${ALARM_SOUND_BASE_KEY}:${userId}` : ALARM_SOUND_BASE_KEY);

export const getStoredAlarmSoundId = (userId) => {
  try {
    return localStorage.getItem(scopedKey(userId)) || DEFAULT_ALARM_SOUND_ID;
  } catch {
    return DEFAULT_ALARM_SOUND_ID;
  }
};

export const setStoredAlarmSoundId = (userId, id) => {
  try {
    localStorage.setItem(scopedKey(userId), id);
  } catch {
    // Storage unavailable - the in-memory selection for this session
    // still works; it simply won't survive a reload, matching every
    // other storage-unavailable fallback already established in this app
    // (e.g. introductionCompletion.js's own sessionStorage try/catch).
  }
};
