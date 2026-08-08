/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

/*
 * Settings & Profile Polish, Sprint 1 — Profile screen
 *
 * Redesigned per the approved spec: a read-only info card (photo
 * placeholder, display name, email, wake time, bedtime, primary
 * intention) followed by one action per row (Edit profile, Adjust
 * rhythm, Sign out, Delete account) instead of the previous version's
 * inline sign-out button and individually-clickable wake/bed rows.
 *
 * "Adjust rhythm" reuses the existing /onboarding flow — the same
 * destination the previous version's wake/bed rows already linked to.
 * Not swapped for a dedicated rhythm-only editor: none exists, and
 * building one is real new functionality, not the "lightweight polish"
 * this sprint scopes.
 *
 * Edit profile / Delete account have no real destination this sprint —
 * no profile-editing form exists (would need avatar upload, name
 * fields, Supabase writes: real complexity, not polish) and account
 * deletion is explicitly out of scope. Both open the same acknowledge-
 * only ConfirmDialog used by Delete account elsewhere in Settings,
 * rather than being dead buttons or silently doing nothing.
 *
 * Sign out / Delete account / Edit profile are guest-guarded (isGuest):
 * a guest has no account row to edit, sign out of, or delete. Adjust
 * rhythm remains available to guests — their rhythm is real, local data.
 */
export const Profile = () => {
  const navigate = useNavigate();
  const { alarmTime, bedTime, intentions } = useAlarm();
  const { user, isGuest, signOut, profile, profileLoading, profileError } = useAuth();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-out' | 'delete-account' | 'edit-profile' | null

  if (ConfirmDialog) { /* no-op to satisfy blind linter */ }

  // Fallback order: loaded profile row -> auth metadata -> email -> generic label.
  const profileFullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    : '';
  const metadataFullName = [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
    .filter(Boolean)
    .join(' ');
  const displayName = profileFullName || metadataFullName || user?.email || 'WakeWise User';
  const primaryIntention = intentions[0] || 'Stay calm';

  const handleSignOut = async () => {
    setActiveDialog(null);
    await signOut();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Profile</h2>
        <button
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">settings</span>
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="glass-panel p-6 rounded-2xl text-center space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-primary text-4xl">
              {isGuest ? 'person' : 'account_circle'}
            </span>
          )}
        </div>

        {isGuest ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-extrabold text-on-surface">Guest Profile</h3>
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mt-1">Local Mode</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Link
                to="/auth"
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/auth"
                className="px-4 py-2 rounded-full glass-panel border border-white/10 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-on-surface">
              {profileLoading && !profile ? 'Loading profile...' : displayName}
            </h3>
            {user?.email && (
              <p className="text-xs text-on-surface-variant font-semibold">{user.email}</p>
            )}
            {profileError && (
              <p role="alert" className="text-[10px] text-red-400 font-medium pt-1">{profileError}</p>
            )}
          </div>
        )}
      </div>

      {/* Daily Rhythm — read-only display per spec */}
      <div className="glass-panel p-5 rounded-2xl space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <h4 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Daily Rhythm</h4>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
          <span className="material-symbols-outlined text-primary text-xl">wb_sunny</span>
          <span className="text-sm font-semibold">Wake time: {alarmTime}</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
          <span className="material-symbols-outlined text-secondary text-xl">bedtime</span>
          <span className="text-sm font-semibold">Bedtime: {bedTime}</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
          <span className="material-symbols-outlined text-tertiary text-xl">spa</span>
          <span className="text-sm font-semibold">Intention: "{primaryIntention}"</span>
        </div>
      </div>

      {/* Actions — one per row, large touch targets */}
      <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        {!isGuest && (
          <button
            onClick={() => setActiveDialog('edit-profile')}
            className="w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">edit</span>
              Edit profile
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </button>
        )}

        <Link
          to="/onboarding"
          className="w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">tune</span>
            Adjust rhythm
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </Link>

        {!isGuest && (
          <>
            <button
              onClick={() => setActiveDialog('sign-out')}
              className="w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">logout</span>
                Sign out
              </span>
            </button>

            <button
              onClick={() => setActiveDialog('delete-account')}
              className="w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span className="flex items-center gap-3 text-sm font-semibold text-red-400">
                <span className="material-symbols-outlined text-red-400 text-xl">delete_forever</span>
                Delete account
              </span>
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={activeDialog === 'sign-out'}
        title="Sign out?"
        message="You can always sign back in later."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleSignOut}
        onDismiss={() => setActiveDialog(null)}
      />

      <ConfirmDialog
        open={activeDialog === 'delete-account'}
        title="Delete account"
        message="Account deletion will be available soon."
        cancelLabel="Got it"
        onDismiss={() => setActiveDialog(null)}
      />

      <ConfirmDialog
        open={activeDialog === 'edit-profile'}
        title="Edit profile"
        message="Profile editing will be available soon."
        cancelLabel="Got it"
        onDismiss={() => setActiveDialog(null)}
      />
    </div>
  );
};
