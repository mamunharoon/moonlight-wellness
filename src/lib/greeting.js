// Home page personalised greeting — kept separate from Home.jsx (see
// subscriptionStatusMessages.js for the established pattern of pulling pure
// decision logic out of components for direct Vitest coverage).
//
// Source priority: `profiles.first_name` (server-authoritative, loaded once
// by AuthContext) is checked before `user.user_metadata.first_name`
// (freely editable by the client via supabase.auth.updateUser) — an
// authoritative name always wins over client-editable state. Email is
// never used as a name; callers get null and fall back to a neutral
// greeting instead.
const firstToken = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
};

// Only the first character is touched (never lowercased/uppercased as a
// whole) so a name stored with its own internal capitalisation (e.g.
// "McDonald") survives unchanged - this only fixes an all-lowercase
// stored value (e.g. profiles.first_name "mamun") into the capitalised
// form a greeting should read ("Mamun").
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export const getFirstName = ({ profile, user } = {}) => {
  const name = firstToken(profile?.first_name) ?? firstToken(user?.user_metadata?.first_name) ?? null;
  return name ? capitalize(name) : null;
};

// Deterministic day index derived from a 'YYYY-MM-DD' dateKey (see
// getZonedParts in timezone.js - the caller's own local calendar day, not
// UTC "now" and not a fixed offset). Two calls with the same dateKey
// always return the same index, so the greeting stays stable for the
// whole local day and only changes at local midnight; consecutive
// calendar days advance the index by exactly 1, so cycling it through a
// variant list below rotates through every message once before any
// repeat (never a random pick, never AI/API-generated). An unparseable
// or missing dateKey resolves to index 0 - the plain, unadorned "Good
// morning"/"Good afternoon"/"Good evening" variant - rather than
// guessing.
const dayIndexFromDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

// Five to six gentle, varied lines per daypart. Each entry pairs a
// name-free "guest" line with its own withName(name) variant, written
// independently rather than as "guest + ', ' + name" for every entry, so
// the name can sit wherever it reads most naturally instead of always
// being appended at the end. Deliberately free of medical/outcome claims
// (no "you'll feel better", no promised results) - these are greetings,
// not claims about what the app does.
const MORNING_GREETINGS = [
  { guest: 'Good morning', withName: (n) => `Good morning, ${n}` },
  { guest: 'Rise and shine', withName: (n) => `Rise and shine, ${n}` },
  { guest: 'A new morning is here', withName: (n) => `${n}, a new morning is here` },
  { guest: 'Hello, and good morning', withName: (n) => `Hello ${n}, good morning` },
  { guest: 'Welcome to your morning', withName: (n) => `Welcome to your morning, ${n}` },
  { guest: 'The morning is yours', withName: (n) => `The morning is yours, ${n}` }
];

const AFTERNOON_GREETINGS = [
  { guest: 'Good afternoon', withName: (n) => `Good afternoon, ${n}` },
  { guest: 'Hello there', withName: (n) => `Hello, ${n}` },
  { guest: "Hope you're having a calm day", withName: (n) => `Hope you're having a calm day, ${n}` },
  { guest: 'A gentle afternoon to you', withName: (n) => `A gentle afternoon to you, ${n}` },
  { guest: 'Welcome back', withName: (n) => `Welcome back, ${n}` },
  { guest: 'Take a moment for yourself', withName: (n) => `Take a moment for yourself, ${n}` }
];

const EVENING_GREETINGS = [
  { guest: 'Good evening', withName: (n) => `Good evening, ${n}` },
  { guest: 'Time to unwind', withName: (n) => `Time to unwind, ${n}` },
  { guest: 'Evening has arrived', withName: (n) => `Evening has arrived, ${n}` },
  { guest: 'Welcome to your evening', withName: (n) => `Welcome to your evening, ${n}` },
  { guest: 'A calm evening to you', withName: (n) => `A calm evening to you, ${n}` },
  { guest: 'Settle in for the evening', withName: (n) => `Settle in for the evening, ${n}` }
];

const GREETING_VARIANTS_BY_PERIOD = {
  morning: MORNING_GREETINGS,
  afternoon: AFTERNOON_GREETINGS,
  evening: EVENING_GREETINGS
};

// The one place a daypart + local dateKey + name become the actual
// greeting string shown on Home - used for all three greeted dayparts so
// they can never drift out of sync in name-resolution order, rotation
// behaviour, or the neutral no-name fallback. `dateKey` is optional only
// so existing/simple callers keep working (falls back to index 0); real
// UI callers should always pass the caller's own local dateKey (e.g.
// Home.jsx's `today`, from getZonedParts) so the rotation is driven by
// the user's actual local day, not the server's or the browser's UTC day.
export const getGreeting = (period, { profile, user, dateKey } = {}) => {
  const variants = GREETING_VARIANTS_BY_PERIOD[period];
  if (!variants) return null;
  const variant = variants[dayIndexFromDateKey(dateKey) % variants.length];
  const firstName = getFirstName({ profile, user });
  return firstName ? variant.withName(firstName) : variant.guest;
};
