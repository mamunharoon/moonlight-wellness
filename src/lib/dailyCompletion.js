// Morning/Evening daily completion — user-scoped keys.
//
// Audit finding: no authoritative server-side completion record exists
// anywhere in Supabase. routine_responses (the closest table) stores
// Reflection/Gratitude prompt ANSWERS per user_id/local_date, not a
// completion flag — its own migration comment explicitly treats these two
// localStorage keys as the app's one and only "did you finish today"
// signal. There is nothing to restore "authoritatively" from the server;
// this module is the smallest safe interim fix, not a stand-in for a real
// migration (Home.jsx/SessionComplete.jsx/EveningComplete.jsx are the only
// three files that ever read/write these two keys).
//
// Previously both keys were a single unscoped localStorage value shared by
// EVERY identity on a device: a registered user's own "Rise & Reset
// complete" was indistinguishable from a guest's, or from a DIFFERENT
// registered user's, on the same device. Unconditionally clearing them on
// sign-out (this module's own prior approach) stopped the leak but also
// erased a legitimately-completed user's own status the moment they
// signed back in later the same day.
//
// Fix: every read/write is scoped by the CURRENT identity instead —
// `userId` is the authenticated Supabase user id (AlarmContext's own
// `userId = user && !user.is_anonymous ? user.id : null`), never an email
// address (an opaque id is safe to embed in a key name; an email is
// personal data and must not be). A registered user's own key is
// `<baseKey>:<userId>`; a guest (`userId` is null/undefined) continues to
// read/write the original, unscoped `<baseKey>` — unchanged name, but its
// meaning is now permanently "guest/device completion" only.
//
// Backward compatibility: the pre-existing unscoped key is NEVER migrated
// or auto-assigned to a registered account — there is no way to know
// retroactively whether an old unscoped value belonged to a guest or a
// since-signed-out registered user, so treating it as guest-only going
// forward is the only safe reading. A registered user's own completion
// status now comes exclusively from their own scoped key, which starts
// empty for every user (including one who completed a routine before this
// fix shipped) — a one-time, honest "not yet recorded under your account"
// reset, never a cross-user misattribution.
export const MORNING_DONE_KEY = 'moonlight_morning_completed_date';
export const EVENING_DONE_KEY = 'moonlight_evening_completed_date';
// Meditation experience — identical unscoped-key defect found during the
// same audit (Home.jsx/MeditationComplete.jsx), fixed the same way for the
// same reason: a registered user's own "meditated today" pill must never
// be shown to a different identity on the same device, and must survive
// their own sign-out/sign-in.
export const MEDITATION_DONE_KEY = 'moonlight_meditation_completed_date';

const scopedKey = (baseKey, userId) => (userId ? `${baseKey}:${userId}` : baseKey);

export const getMorningCompletionKey = (userId) => scopedKey(MORNING_DONE_KEY, userId);
export const getEveningCompletionKey = (userId) => scopedKey(EVENING_DONE_KEY, userId);
export const getMeditationCompletionKey = (userId) => scopedKey(MEDITATION_DONE_KEY, userId);
