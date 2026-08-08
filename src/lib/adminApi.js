// Subscription Model, Sprint 2 Stage 2 — admin foundation client layer.
//
// Every function here is a thin wrapper around one of the SECURITY
// DEFINER RPC functions created by
// supabase/migrations/20260808120000_sprint2_stage2_admin_foundation.sql
// — that migration, not this file, is what actually enforces "only an
// administrator can read/write this". Nothing here re-implements or
// relies on any client-side authorization check; AdminRoute.jsx's own
// checkIsAdmin() call is a UX gate only (skip the loading/redirect
// dance), not the security boundary.
import { supabase } from './supabaseClient';

export const checkIsAdmin = async () => {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error('Error checking admin status:', error.message);
    return false;
  }
  return data === true;
};

export const fetchAdminUsers = async () => {
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) throw error;
  return data ?? [];
};

export const fetchAdminSubscriptions = async () => {
  const { data, error } = await supabase.rpc('admin_list_subscriptions');
  if (error) throw error;
  return data ?? [];
};

export const setBetaAccess = async (userId, enabled) => {
  const { error } = await supabase.rpc('admin_set_beta_access', {
    target_user_id: userId,
    enabled
  });
  if (error) throw error;
};

export const setSubscriptionStatus = async (userId, status) => {
  const { error } = await supabase.rpc('admin_set_subscription_status', {
    target_user_id: userId,
    new_status: status
  });
  if (error) throw error;
};
