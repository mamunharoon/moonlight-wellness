/*
 * Global timezone correctness.
 *
 * WakeWise is used from anywhere in the world. "Today," morning/evening
 * state, daily completion, reminder times, and the alarm's fire check
 * must all be computed in the user's own local wall-clock day - never
 * against a fixed numeric offset (broken across DST), never against
 * UTC, and never against wherever the server/build happens to run.
 *
 * The only correct primitive for this is an IANA timezone identifier
 * (e.g. "Australia/Melbourne") fed through Intl.DateTimeFormat, which the
 * platform keeps DST-correct automatically - there is deliberately no
 * manual UTC-offset arithmetic anywhere in this file.
 *
 * Storage model (see AlarmContext.jsx for the read/write wiring):
 *   - Registered users: rhythms.timezone (nullable IANA text column,
 *     migration 20260914120000_global_timezone_support.sql).
 *   - Guests: localStorage['moonlight_timezone'].
 *   - Both cases are additionally mirrored into localStorage
 *     ['moonlight_timezone'] as a synchronous read cache for the few
 *     plain-JS modules (notificationScheduler.js, notificationService.js)
 *     that run outside React and cannot await a Supabase fetch on every
 *     tick - Supabase/guest storage remains the source of truth; this
 *     mirror is a cache, never written to directly by app code.
 */

const STORED_TIMEZONE_KEY = 'moonlight_timezone';
const MISMATCH_DISMISSED_KEY = 'moonlight_timezone_mismatch_dismissed_for';

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Detects the device's current IANA timezone via the platform's own Intl
// resolution - never GPS, never a permission prompt.
export const detectDeviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

// The only real validator: constructing a formatter throws for an
// unrecognised zone name. No hand-maintained allow-list to fall out of
// date with the IANA database.
export const isValidTimezone = (tz) => {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// A curated, globally-spread list for a manual picker - the full IANA
// database is ~400 entries and unusable as a flat dropdown. Every
// required test-case zone (see the closure task's test matrix) is
// included, plus enough global coverage that most users can find their
// own city or a same-offset neighbour.
export const COMMON_TIMEZONES = [
  { id: 'Pacific/Auckland', label: 'Auckland' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'Australia/Melbourne', label: 'Melbourne' },
  { id: 'Australia/Brisbane', label: 'Brisbane (no DST)' },
  { id: 'Australia/Adelaide', label: 'Adelaide' },
  { id: 'Australia/Perth', label: 'Perth (no DST)' },
  { id: 'Asia/Tokyo', label: 'Tokyo (no DST)' },
  { id: 'Asia/Shanghai', label: 'Shanghai (no DST)' },
  { id: 'Asia/Singapore', label: 'Singapore (no DST)' },
  { id: 'Asia/Kolkata', label: 'Mumbai / Delhi (no DST)' },
  { id: 'Asia/Dubai', label: 'Dubai (no DST)' },
  { id: 'Europe/Moscow', label: 'Moscow (no DST)' },
  { id: 'Europe/Istanbul', label: 'Istanbul (no DST)' },
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Africa/Cairo', label: 'Cairo' },
  { id: 'Africa/Johannesburg', label: 'Johannesburg (no DST)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Chicago', label: 'Chicago' },
  { id: 'America/Denver', label: 'Denver' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'America/Anchorage', label: 'Anchorage' },
  { id: 'Pacific/Honolulu', label: 'Honolulu (no DST)' },
  { id: 'UTC', label: 'UTC (no DST)' }
];

const partsFormatterCache = new Map();
const getPartsFormatter = (timezone) => {
  let fmt = partsFormatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short'
    });
    partsFormatterCache.set(timezone, fmt);
  }
  return fmt;
};

// The single source of truth for "what is the wall-clock time in this
// IANA zone right now (or at the given instant)". Every consumer in this
// codebase that needs "today", "is it wake time yet", weekday, or quiet
// hours goes through this - never new Date().getHours()/getDay()/
// toISOString() directly for anything timezone-sensitive.
//
// Returns:
//   { year, month, day, hour, minute, second,
//     weekday,             // 0=Sun..6=Sat, same convention as Date.getDay()
//     dateKey,              // 'YYYY-MM-DD' in the target zone - replaces
//                            // toDateString()/toISOString().slice(0,10) for
//                            // any "which local day is this" comparison
//     hm,                   // 'HH:MM' in the target zone - replaces
//                            // getHours()/getMinutes() for alarm/reminder
//                            // time-of-day comparisons
//     minutesSinceMidnight }
export const getZonedParts = (timezone, instant = new Date()) => {
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  const parts = getPartsFormatter(tz).formatToParts(instant);
  const map = {};
  for (const { type, value } of parts) map[type] = value;

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  // h23 still reports "24" for midnight in some ICU implementations -
  // normalise that one edge case rather than trust it's always "00".
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const weekday = WEEKDAY_INDEX[map.weekday] ?? instant.getDay();

  const pad = (n) => String(n).padStart(2, '0');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
    hm: `${pad(hour)}:${pad(minute)}`,
    minutesSinceMidnight: hour * 60 + minute
  };
};

// Reads the synchronous localStorage mirror described in the file header.
// Used by plain-JS modules (notification scheduler/service) that cannot
// hold React context. Falls back to the live device zone if nothing has
// been resolved into the cache yet (first paint, before AlarmContext's
// own effect has run) - never throws, never returns an invalid zone.
export const getCachedTimezone = () => {
  try {
    const stored = localStorage.getItem(STORED_TIMEZONE_KEY);
    if (isValidTimezone(stored)) return stored;
  } catch {
    // storage unavailable this session
  }
  return detectDeviceTimezone();
};

// Writes the synchronous cache mirror. AlarmContext.jsx is the only
// intended caller - it calls this whenever the resolved effective
// timezone (guest localStorage value, or a registered user's fetched
// rhythms.timezone) changes, regardless of whether that value is also
// being persisted elsewhere (Supabase) as the real source of truth.
export const setCachedTimezone = (tz) => {
  if (!isValidTimezone(tz)) return;
  try {
    localStorage.setItem(STORED_TIMEZONE_KEY, tz);
  } catch {
    // storage unavailable this session - the in-memory value the caller
    // already holds is still used for this session, just not cached.
  }
};

// Per-value "don't ask again for this specific device zone" memory for
// the "Keep saved timezone" choice on the mismatch banner - re-prompts
// only if the device timezone changes to something else again (a further
// trip), not on every subsequent app open in the same foreign zone.
export const getDismissedMismatchTimezone = () => {
  try {
    return localStorage.getItem(MISMATCH_DISMISSED_KEY);
  } catch {
    return null;
  }
};

export const setDismissedMismatchTimezone = (deviceTz) => {
  try {
    localStorage.setItem(MISMATCH_DISMISSED_KEY, deviceTz);
  } catch {
    // storage unavailable - banner may re-show next load, which is safe.
  }
};

export const clearDismissedMismatchTimezone = () => {
  try {
    localStorage.removeItem(MISMATCH_DISMISSED_KEY);
  } catch {
    // no-op
  }
};
