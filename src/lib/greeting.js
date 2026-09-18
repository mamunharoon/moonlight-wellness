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

export const getMorningGreeting = ({ profile, user } = {}) => {
  const firstName = getFirstName({ profile, user });
  return firstName ? `Good morning, ${firstName}` : 'Good morning';
};
