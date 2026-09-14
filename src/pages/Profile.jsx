/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

/*
 * Daily Journey & Content Architecture — Profile screen
 *
 * Reorganised into the exact required row order: Wake time, Bedtime,
 * Morning routine duration, Reminder preferences, Manage Subscription,
 * Journey and progress, Privacy and Account, Help and Support, Sign
 * out. Account deletion moved out to Privacy and Account (see
 * PrivacyAndAccount.jsx) — no longer prominent on this main screen.
 * "Edit profile" (a placeholder dialog that never did anything real)
 * is removed rather than kept as unrequested clutter.
 *
 * Wake time / Bedtime still open /onboarding to actually change the
 * value (no dedicated single-field editor exists, and building one is
 * real new functionality — reusing the existing, working flow instead
 * of rebuilding it). Morning routine duration is a genuine gap this
 * batch found: routineDuration/setRoutineDuration have existed in
 * AlarmContext since the original morning-flow batches, but no UI
 * anywhere ever let a user change it — this row is a small, self
 * contained three-way toggle, not a rebuild of anything.
 */
const DURATION_OPTIONS = [
  { id: 'quick', label: 'Quick' },
  { id: 'standard', label: 'Standard' },
  { id: 'extended', label: 'Extended' }
];

export const Profile = () => {
  const navigate = useNavigate();
  const { alarmTime, bedTime, routineDuration, setRoutineDuration } = useAlarm();
  const { user, isGuest, signOut, profile, profileLoading, profileError } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const handleSignOut = async () => {
    setConfirmSignOut(false);
    await signOut();
    navigate('/');
  };

  const profileFullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    : '';
  const metadataFullName = [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
    .filter(Boolean)
    .join(' ');
  const displayName = profileFullName || metadataFullName || user?.email || 'WakeWise User';

  const rowClass = 'w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset';

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

      {/* Required row order: Wake time, Bedtime, Morning routine
          duration, Reminder preferences, Manage Subscription, Journey
          and progress, Privacy and Account, Help and Support. Sign out
          stays its own separate row below, per spec. */}
      <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <Link to="/onboarding" className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">wb_sunny</span>
            Wake time
          </span>
          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
            {alarmTime}
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </span>
        </Link>

        <Link to="/onboarding" className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">bedtime</span>
            Bedtime
          </span>
          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
            {bedTime}
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </span>
        </Link>

        <div className={`${rowClass} cursor-default flex-wrap gap-2`}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">schedule</span>
            Morning routine duration
          </span>
          <span className="flex gap-1">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRoutineDuration(opt.id)}
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all min-h-[32px] ${
                  routineDuration === opt.id ? 'bg-primary text-on-primary' : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </span>
        </div>

        <Link to="/settings/notifications" className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
            Reminder preferences
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </Link>

        <Link to="/subscription" className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">workspace_premium</span>
            Manage Subscription
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </Link>

        <Link to="/journey" className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">analytics</span>
            Journey and progress
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </Link>

        <Link to="/profile/privacy-account" className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">shield_person</span>
            Privacy and Account
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </Link>

        <Link to="/settings" className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">support_agent</span>
            Help and Support
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </Link>
      </div>

      {!isGuest && (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <button onClick={() => setConfirmSignOut(true)} className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">logout</span>
              Sign out
            </span>
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message="You can always sign back in later."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleSignOut}
        onDismiss={() => setConfirmSignOut(false)}
      />
    </div>
  );
};
