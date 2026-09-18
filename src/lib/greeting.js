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

const GREETING_BASE_BY_PERIOD = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening'
};

// Home.jsx's own timeState buckets ('before-wake'/'night' included) that
// map to a personalised daypart greeting - the other two buckets
// deliberately have no entry here (and so render no greeting at all),
// matching the product spec: only morning/afternoon/evening ever greet
// the user by name.
export const GREETING_PERIOD_BY_TIME_STATE = {
  'daytime-morning': 'morning',
  daytime: 'afternoon',
  evening: 'evening'
};

// The one place a daypart + name become the actual greeting string shown
// on Home - used for all three greeted dayparts so "Good afternoon"/
// "Good evening" can never drift out of sync with how "Good morning"
// resolves a name (same priority order, same neutral fallback with no
// dangling comma when no valid name exists).
export const getGreeting = (period, { profile, user } = {}) => {
  const base = GREETING_BASE_BY_PERIOD[period];
  if (!base) return null;
  const firstName = getFirstName({ profile, user });
  return firstName ? `${base}, ${firstName}` : base;
};
