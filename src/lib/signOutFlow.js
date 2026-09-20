// Sign-out failure semantics.
//
// The installed @supabase/auth-js's own signOut() (default scope:
// 'global') already clears its LOCAL session in nearly every outcome,
// success or failure: reading its source (GoTrueClient.js's _signOut)
// shows the only path that returns an error WITHOUT having already
// removed the local session is when reading the CURRENT session itself
// fails first (a broken/corrupted local auth state) — an ordinary
// network failure calling the server's revoke endpoint still results in
// the local session being torn down before the error is returned. So
// `error` alone is not a reliable "did this actually fail" signal:
// re-checking the real session afterward is what "never claim logged out
// while a session silently remains" actually requires, and what stops us
// from surfacing a scary "couldn't sign out" error for an attempt that,
// from this device's point of view, already succeeded.
//
// Takes the already-resolved Supabase client (or null, mirroring
// supabaseClient.js's own "misconfigured env" fallback) rather than
// importing it directly, so this can be exercised with a fake client in
// a real behaviour test instead of only a source-level regex check.
export const performSupabaseSignOut = async (supabaseClient) => {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();
  if (!error) return;

  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session) return; // local session is genuinely gone - nothing to surface as a failure

  // A real session still exists — sign-out did not take effect server-
  // or client-side. Thrown so the caller's own retry UI (Profile.jsx)
  // shows a clear, non-technical error and never claims success.
  throw error;
};
