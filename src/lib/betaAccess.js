// WakeWise — Closed Beta Preparation, Phase A — beta access status.
//
// profiles.beta_access and its admin-side management (grant/revoke via
// AdminUsers.jsx) already exist from the Admin Foundation stage — this
// phase adds nothing to the schema. This is only the missing piece: a
// user checking their OWN beta status. It reads profiles directly
// rather than through AuthContext.jsx (authentication logic, left
// untouched per this phase's rules) and relies entirely on the
// existing "profiles_select_own" RLS policy — no new policy, table, or
// RPC needed.
import { supabase } from './supabaseClient';

export const fetchOwnBetaAccess = async (userId) => {
  if (!supabase || !userId) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('beta_access')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking beta access:', error.message);
    return false;
  }

  return Boolean(data?.beta_access);
};
