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

export const getFirstName = ({ profile, user } = {}) =>
  firstToken(profile?.first_name) ?? firstToken(user?.user_metadata?.first_name) ?? null;

export const getMorningGreeting = ({ profile, user } = {}) => {
  const firstName = getFirstName({ profile, user });
  return firstName ? `Good morning, ${firstName}` : 'Good morning';
};
