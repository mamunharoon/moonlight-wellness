import { supabase } from './supabaseClient';

// The single validated local/Supabase save mechanism for the user's
// Morning intentions (one or two, ordered - first is Primary, second is
// Supporting) - used by both IntentionSetup.jsx (Morning routine's own
// Step 1) and Home.jsx's "Change intention" (ActiveIntentionCard), so
// changing intentions behaves identically no matter which screen it
// happens from. Local persistence itself (localStorage + in-memory
// state) is entirely AlarmContext's own job, already triggered by the
// setIntentions(intentions) call every caller makes right before this -
// this function's only job is the best-effort Supabase upsert. A cloud
// failure never blocks or reverts the local save (existing UX never
// blocks navigation on a Supabase error) - it only logs, distinctly
// from a genuine local failure, so the two are never confused.
//
// `intentions` is the FULL ordered selection (1-2 items) - the upsert
// always replaces the whole `intentions` column value, never merges, so
// saving [Primary] after previously saving [Primary, Supporting]
// genuinely removes Supporting from Supabase, not just locally (see
// 20260919130000_user_intentions_ordered_list.sql). `intention` (the
// pre-existing single-value column) is kept mirrored to intentions[0]
// on every save, purely for backward compatibility with anything still
// reading that column alone - nothing in this app reads it directly
// anymore.
export const saveIntentionsToCloud = async (userId, intentions) => {
  if (!supabase || !userId) return;
  if (!Array.isArray(intentions) || intentions.length === 0) return;

  try {
    const { error } = await supabase
      .from('user_intentions')
      .upsert({ user_id: userId, intention: intentions[0], intentions }, { onConflict: 'user_id' });
    if (error) {
      console.warn('Intentions saved locally only - cloud sync failed:', error.message);
    }
  } catch (e) {
    console.warn('Intentions saved locally only - cloud sync skipped:', e.message);
  }
};
