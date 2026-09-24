import { CURRENT_INTRODUCTION_VERSION } from './introductionVersion';

// Extracted from Introduction.jsx's own persistAndContinue - the exact
// same real Supabase read / upsert-if-missing / conditional-update logic,
// now callable from two places instead of duplicated:
//   - Introduction.jsx's own persistAndContinue (a signed-in user tapping
//     a card or "Go to Home" directly);
//   - Auth.jsx's redirectAfterAuth, when a just-authenticated user is
//     resuming a Morning/Evening journey they picked as a guest before
//     signing in (see pendingJourneyIntent.js). Without this, that resume
//     path was silently skipping the version write entirely - the
//     account would sign in, jump straight into Morning/Evening, and
//     never be marked as having completed the current Introduction
//     version, exactly as if persistAndContinue itself had never run.
// One persistence decision, shared - never a second, parallel copy of
// this logic for the resume path.
//
// `refreshProfile` is optional (Auth.jsx's redirectAfterAuth does not
// have AuthContext's own refreshProfile in scope the same way
// Introduction.jsx does - it works directly from the authUser object its
// caller already has); when omitted, a missing profile row is treated as
// a genuine failure rather than retried, which is the safe choice for a
// moment where the profile-creation upsert may simply not have run yet.
export const completeIntroductionVersion = async ({ supabase, userId, refreshProfile }) => {
  if (!supabase || !userId) return { ok: true };

  const readVersion = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('introduction_completed_version')
      .eq('id', userId)
      .maybeSingle();
    return { data, error };
  };

  let { data: profileRow, error: readError } = await readVersion();

  if (readError) return { ok: false };

  if (!profileRow) {
    if (!refreshProfile) return { ok: false };
    await refreshProfile();
    ({ data: profileRow, error: readError } = await readVersion());
    if (readError || !profileRow) return { ok: false };
  }

  // Replay-safety: never write a value that could reset or lower an
  // already-saved version - if this account is already at or above the
  // current version, there is nothing to persist.
  if ((profileRow.introduction_completed_version ?? 0) >= CURRENT_INTRODUCTION_VERSION) {
    return { ok: true };
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('profiles')
    .update({ introduction_completed_version: CURRENT_INTRODUCTION_VERSION })
    .eq('id', userId)
    .select('id');

  // A zero-row update (no error, but nothing matched) is never silently
  // treated as success - something changed underneath us (e.g. the row
  // vanished between the read and this write), so this is surfaced as a
  // retryable failure exactly like a genuine error would be.
  if (updateError || !updatedRows || updatedRows.length !== 1) return { ok: false };

  return { ok: true };
};
