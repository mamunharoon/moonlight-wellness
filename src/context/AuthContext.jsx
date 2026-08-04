/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

const PROFILE_COLUMNS = 'id, first_name, last_name, avatar_url';

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const isGuest = !user || user.is_anonymous === true;

  // Load the current user's profile row. Registered users only - guests and
  // anonymous sessions never touch the profiles table (application-layer
  // guard, mirrors the isGuest check used throughout the app).
  const loadProfile = async (currentUser) => {
    if (!supabase || !currentUser || currentUser.is_anonymous) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error.message);
      setProfileError("We couldn't load your profile. Please try again.");
      setProfileLoading(false);
      return;
    }

    if (data) {
      setProfile(data);
      setProfileLoading(false);
      return;
    }

    // No row yet. Create one additively via a safe upsert: onConflict
    // ignores an existing row entirely (never overwrites real data if one
    // was created by a concurrent request between the select above and
    // this call), then we re-select for the authoritative current state.
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: currentUser.id,
          first_name: currentUser.user_metadata?.first_name ?? null,
          last_name: currentUser.user_metadata?.last_name ?? null
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (upsertError) {
      console.error('Error creating profile:', upsertError.message);
      setProfileError("We couldn't set up your profile. Please try again.");
      setProfileLoading(false);
      return;
    }

    const { data: finalProfile, error: reselectError } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', currentUser.id)
      .maybeSingle();

    if (reselectError || !finalProfile) {
      console.error('Error loading profile after creation:', reselectError?.message);
      setProfileError("We couldn't load your profile. Please try again.");
      setProfileLoading(false);
      return;
    }

    setProfile(finalProfile);
    setProfileLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      await loadProfile(user);
    };
    load();
  }, [user]);

  const refreshProfile = () => loadProfile(user);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      loading,
      isGuest,
      signOut,
      profile,
      profileLoading,
      profileError,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
