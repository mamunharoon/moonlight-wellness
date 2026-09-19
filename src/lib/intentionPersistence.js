import { supabase } from './supabaseClient';

// The single validated local/Supabase save mechanism for the user's
// primary intention - used by both IntentionSetup.jsx (Morning routine's
// own Step 1) and Home.jsx's "Change intention" (ActiveIntentionCard), so
// changing an intention behaves identically no matter which screen it
// happens from. Local persistence itself (localStorage + in-memory state)
// is entirely AlarmContext's own job, already triggered by the
// setIntentions([intention]) call every caller makes right before this -
// this function's only job is the best-effort Supabase upsert. A cloud
// failure never blocks or reverts the local save (existing UX never blocks
// navigation on a Supabase error) - it only logs, distinctly from a
// genuine local failure, so the two are never confused.
export const saveIntentionToCloud = async (userId, intention) => {
  if (!supabase || !userId) return;
  try {
    const { error } = await supabase
      .from('user_intentions')
      .upsert({ user_id: userId, intention }, { onConflict: 'user_id' });
    if (error) {
      console.warn('Intention saved locally only - cloud sync failed:', error.message);
    }
  } catch (e) {
    console.warn('Intention saved locally only - cloud sync skipped:', e.message);
  }
};
