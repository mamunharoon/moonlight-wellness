/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { migrateGuestData } from '../lib/migrateGuestData';

const AuthContext = createContext();

const PROFILE_COLUMNS = 'id, first_name, last_name, avatar_url';
const MIGRATION_MARKER_PREFIX = 'moonlight_migration_v1_';

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  // Bumped only after a successful guest-to-account migration. Group 5.4
  // will consume this to know when to re-fetch rhythm/intention state.
  const [migrationRevision, setMigrationRevision] = useState(0);

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

  // Stage 2B Group 5.3: one-time guest-to-account data migration. Runs only
  // for a permanent (non-anonymous) authenticated user who hasn't already
  // completed this migration version, per the moonlight_migration_v1_<id>
  // marker. Guest localStorage is never cleared here (retained per the
  // approved Group 5 data-retention policy) and the marker is written only
  // on full success, so a partial failure retries safely on the next
  // sign-in/refresh without risking duplicate or overwritten cloud data -
  // migrateGuestData.js's own cloud-first checks and the client_id unique
  // constraint are what make that retry safe.
  useEffect(() => {
    const runMigration = async () => {
      if (loading) return;
      if (!user || user.is_anonymous || !user.id) return;

      const markerKey = `${MIGRATION_MARKER_PREFIX}${user.id}`;

      let alreadyMigrated;
      try {
        alreadyMigrated = localStorage.getItem(markerKey);
      } catch {
        // localStorage unavailable this session - skip rather than risk a
        // migration attempt with no way to record completion.
        return;
      }
      if (alreadyMigrated) return;

      const result = await migrateGuestData(user.id);

      if (!result.success) {
        console.warn('migrateGuestData: migration did not complete successfully, will retry next sign-in', {
          rhythm: result.rhythm,
          intention: result.intention,
          journal: result.journal
        });
        return;
      }

      try {
        localStorage.setItem(markerKey, new Date().toISOString());
      } catch (e) {
        // Migration itself succeeded and cloud data is safe, but without a
        // recorded marker this will simply be retried (safely) next time.
        console.warn('migrateGuestData: migration succeeded but marker write failed:', e.message);
        return;
      }

      setMigrationRevision((prev) => prev + 1);
    };

    runMigration();
  }, [user, loading]);

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
      refreshProfile,
      migrationRevision
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
