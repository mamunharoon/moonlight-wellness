/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { clearAllRoutineProgress } from '../session/routineProgress';
import { clearGuestEntryChoice } from '../lib/guestEntry';
import { clearPendingContent } from '../lib/pendingContent';
import { broadcastSignOut, clearAppSessionStorage } from '../lib/signOutCleanup';
import { performSupabaseSignOut } from '../lib/signOutFlow';

const AuthContext = createContext();

// introduction_completed_version — added by
// 20260920120000_profiles_introduction_completed_version.sql, now live in
// DEV. Included here so AuthContext's own `profile` is a complete
// representation of the row; the first-login gate (Auth.jsx) and
// Introduction.jsx's own Start/Skip persistence each still query it
// directly rather than trusting this possibly-stale context value, per
// the explicit "do not rely on stale profile context" requirement.
const PROFILE_COLUMNS = 'id, first_name, last_name, avatar_url, introduction_completed_version';

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  // Was bumped after a successful guest-to-account migration (Stage 2B
  // Group 5.3/5.4) to trigger AlarmContext's rhythm/intention re-fetch.
  // That automatic migration is now permanently disabled (see the removal
  // rationale where the migration effect used to live, below) as the
  // confirmed root cause of a cross-user privacy defect - kept as a
  // constant, never incremented, purely so AlarmContext's existing effect
  // dependency arrays need no change.
  const migrationRevision = 0;

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

  // Build 10 remediation — sign-out/user-switch isolation: routine
  // progress (routineProgress.js) is plain localStorage, entirely
  // device-local and not scoped per-user, so without this a signed-out
  // user's in-progress Morning/Evening step would otherwise still be
  // sitting there for whoever signs in next on the same device. Cleared
  // unconditionally on every sign-out, guest or registered, before the
  // Supabase call — never fails/blocks sign-out even if storage is
  // unavailable (clearAllRoutineProgress already no-ops safely on that).
  //
  // Guest Onboarding — signing out must return to the Welcome screen,
  // never silently restore whatever guest choice was in effect before
  // this account was signed into: clearGuestEntryChoice() resets that
  // flag alongside routine progress, so OnboardingGate shows Welcome
  // again on the very next render (Profile.jsx navigates to '/' right
  // after calling signOut()).
  //
  // Routing policy fix: a pending sign-in return destination
  // (lib/pendingContent.js - set by a protected-content/routine gate)
  // must not survive a sign-out either, or the NEXT ordinary sign-in on
  // this device/tab could be silently redirected to wherever a PREVIOUS
  // session's protected action last pointed, instead of Home.
  //
  // Logout / cross-user client-state audit — two more device-local
  // things a signed-out user was leaving behind for whoever signs in
  // next: every other 'moonlight_'-prefixed sessionStorage key, and — via
  // broadcastSignOut() — the live Session Engine session, the legacy
  // journeyStep tracker, and any active audio/video playback, each reset
  // by its own provider (AudioContext/SessionContext/AlarmContext/
  // OnboardingGate all listen for this signal; none of them are
  // reachable directly from here — see signOutCleanup.js's own doc
  // comment for why). All of this runs before the Supabase call, same as
  // the existing clears above, so it can never fail/block sign-out and so
  // the app already looks fully signed-out the instant this function is
  // called, never mid-transition. This is safe even if the Supabase call
  // below ultimately fails: OnboardingGate's own `!user` check means
  // Welcome can only ever actually render once a genuine SIGNED_OUT auth
  // event fires (user set to null) — resetting local UI state early never
  // by itself claims the user is logged out.
  //
  // Sign-out failure semantics — see signOutFlow.js's own doc comment for
  // the full rationale (extracted there, rather than inlined here, so it
  // can be exercised with a real behaviour test against a fake Supabase
  // client instead of only a source-level regex check).
  const signOut = async () => {
    clearAllRoutineProgress();
    clearGuestEntryChoice();
    clearPendingContent();
    clearAppSessionStorage();
    broadcastSignOut();

    await performSupabaseSignOut(supabase);
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

  // Stage 2B Group 5.3 guest-to-account migration (migrateGuestData,
  // triggered from here on every first sign-in of a new account on a
  // device) has been PERMANENTLY REMOVED — confirmed root cause of a
  // release-blocking cross-user privacy defect.
  //
  // This app has no real Supabase anonymous session anywhere (no
  // `supabase.auth.signInAnonymously()` call exists in this codebase) -
  // "guest" simply means "no session at all", so device-local guest data
  // (moonlight_intentions, moonlight_wake_up_time/bedtime/timezone,
  // moonlight_journal_entries) has no actual link to whichever account
  // later signs in on that device. The old moonlight_migration_v1_<id>
  // marker only recorded "has THIS account run migration on THIS device
  // before" - not "does this device's guest data actually belong to this
  // account" - so on any device used by more than one person (a shared/
  // QA/family device, or simply two different accounts signing up
  // back-to-back in the same browser), the first account to sign in on
  // that device had this device's guest content silently written into its
  // own user_intentions/rhythms/journal_entries rows, and every
  // subsequent distinct account that later signed in on the same device
  // for the first time got that exact same (by-then-unrelated) content
  // written into ITS rows too - reproduced live with two disposable DEV
  // accounts sharing one browser: both ended up with identical Supabase
  // user_intentions row content that neither had actually chosen.
  //
  // Per the approved remediation, guest data must never be adopted by a
  // registered account automatically - only via a future explicit, user-
  // approved conversion flow (e.g. an affirmative "Apply your guest data
  // to this account?" prompt at the moment of signup), which does not
  // exist yet. migrateGuestData.js itself is left untouched (its cloud-
  // first-check/upsert building blocks remain valid for such a future
  // flow) - only this automatic, unconditional call site is removed.

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
