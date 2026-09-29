/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useUnifiedEntitlement } from '../context/SubscriptionContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataExportDialog } from '../components/DataExportDialog';
import { getMembershipStatusLabelFromEntitlement } from '../lib/membershipStatus';
import { isAppleIAPSupported } from '../lib/applePurchaseAdapter';
import { useAppleRestore, NEUTRAL_RESTORE_COMPLETION_MESSAGE } from '../hooks/useAppleRestore';

/*
 * WakeWise Phase 2A — minimum launch-ready Profile
 *
 * Replaces the previous single flat row list with four required grouped
 * sections (Account, Preferences, Membership, Privacy and support), per
 * the Phase 2A spec. Name and email are presented via the existing header
 * card below, not duplicated as additional flat rows — the spec's "user's
 * display/first name; email address, read-only" is satisfied there, so
 * the Account group itself holds only its two actions (Change Password,
 * Sign Out), avoiding showing the same two facts twice on one screen.
 *
 * Everything the previous Profile screen linked to that ISN'T part of the
 * four required groups (Journey and progress, About WakeWise, Help and
 * Support) is kept, not deleted, in a clearly separate "More" group below
 * — removing working navigation wasn't asked for, and "reduce clutter"
 * is satisfied by the four groups being the primary, top-of-screen
 * content. Morning routine duration (a genuine, working preference this
 * screen already exposed) is folded into Preferences rather than dropped.
 *
 * The old "Privacy and Account" hub screen (PrivacyAndAccount.jsx ->
 * AccountManagement.jsx -> DeleteAccount.jsx) is no longer linked from
 * here — Privacy Policy, Terms of Service, and Delete Account are now
 * direct rows, matching the spec exactly. PrivacyAndAccount.jsx and
 * AccountManagement.jsx are left completely unmodified and still routed
 * (not deleted), so nothing on disk breaks; they are simply no longer
 * reachable from Profile's own navigation.
 *
 * Correction (Phase 2A review) — AccountManagement.jsx's "Download a copy
 * of my data" dialog would otherwise have lost its only entry point. Its
 * wording/behaviour was extracted into DataExportDialog.jsx (no logic
 * change, same honest "automated export isn't built yet, email us"
 * message) and is reused here as its own row, so the feature is neither
 * duplicated nor orphaned.
 *
 * Avatar: the previous header rendered `profile.avatar_url` as an <img>
 * when present, alongside an icon fallback — but no upload path exists
 * anywhere in this codebase (confirmed by repo-wide search), so that
 * branch could only ever render for a value nothing in this app ever
 * writes. Removed per the Phase 2A spec ("remove or hide the dead avatar
 * treatment") — the circle now always shows the plain icon.
 */
const DURATION_OPTIONS = [
  { id: 'quick', label: 'Quick' },
  { id: 'standard', label: 'Standard' },
  { id: 'extended', label: 'Extended' }
];

// WakeWise Phase 2A correction — the prior timeout-based inference of an
// absent purchase was withdrawn. A fixed timeout cannot truthfully
// distinguish "no purchase exists" from "verification is just slow"; see
// useAppleRestore.js's own header comment. 'completed' is the honest
// neutral state for "the restore request went through; we can't yet
// confirm whether it found anything."
const RESTORE_MESSAGES = {
  restoring: { role: 'status', text: 'Restoring…' },
  restored: { role: 'status', text: 'Restore complete — your subscription status has been refreshed.' },
  completed: { role: 'status', text: NEUTRAL_RESTORE_COMPLETION_MESSAGE },
  failed: { role: 'alert', text: null } // uses the hook's own error message
};

export const Profile = () => {
  const navigate = useNavigate();
  const { alarmTime, bedTime, routineDuration, setRoutineDuration, effectiveTimezone } = useAlarm();
  const { user, isGuest, signOut, profile, profileLoading, profileError } = useAuth();
  // WakeWise Phase 2B — reads the unified, multi-provider entitlement
  // (legacy Stripe/manual + Apple/Google provider_subscriptions combined)
  // rather than the legacy-only `subscription` value Phase 2A used here.
  // See entitlementResolver.js's own header for why this is strictly more
  // complete, never less correct, for any account this phase's own data
  // already covers.
  const entitlement = useUnifiedEntitlement();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // Sign-out hardening fix, found live: the previous version closed the
  // dialog and called navigate('/') unconditionally right after `await
  // signOut()`, with no error handling at all - if the Supabase call
  // itself rejected (a network blip, say), the exception simply propagated
  // out of this handler, navigate('/') was never reached, and the user
  // was left sitting on the already-dismissed-dialog Profile screen with
  // no feedback and no indication anything had gone wrong - reproduced
  // live as "Sign Out can leave the Profile screen visible". Now: the
  // dialog stays open (not dismissed) and its own confirm button is
  // disabled/relabelled while the call is in flight, so authenticated
  // controls can't be tapped again mid-request; only a genuine SUCCESS
  // closes the dialog and navigates (with replace, so Back can never
  // return to a history entry that still expects to render authenticated
  // Profile content); a failure surfaces a friendly inline error and
  // leaves the dialog open for a retry, never silently pretending the
  // user is signed out.
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  // WakeWise Phase 2A — Restore Purchases. Native iOS only (see
  // useAppleRestore's own doc comment) — Android has real Google Play
  // Billing wired into its native build but zero application-layer
  // restore/verification code exists yet (confirmed by direct inspection
  // of the android-prep worktree), so this row is hidden entirely on
  // Android rather than shown non-functional or routed to Stripe and
  // called "restore" — see the Phase 2A report's Android limitation note.
  const restoreSupported = isAppleIAPSupported();
  const { state: restoreState, error: restoreError, restore } = useAppleRestore();
  const [restoreSignInPrompt, setRestoreSignInPrompt] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSignOutError('');
    setSigningOut(true);
    try {
      await signOut();
      // replace: true - the authenticated Profile screen must never be
      // reachable again via browser Back once signed out.
      navigate('/', { replace: true });
    } catch {
      setSigningOut(false);
      setSignOutError("We couldn't sign you out. Please try again.");
    }
  };

  const dismissSignOut = () => {
    if (signingOut) return; // never dismissable mid-request
    setConfirmSignOut(false);
    setSignOutError('');
  };

  const handleRestoreTap = () => {
    if (isGuest) {
      setRestoreSignInPrompt(true);
      return;
    }
    restore();
  };

  const profileFullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    : '';
  const metadataFullName = [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
    .filter(Boolean)
    .join(' ');
  const displayName = profileFullName || metadataFullName || user?.email || 'WakeWise User';

  const membershipStatusLabel = getMembershipStatusLabelFromEntitlement(entitlement);

  const rowClass = 'w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset';
  const infoRowClass = 'w-full flex items-center justify-between p-4 min-h-[56px]';

  const restoreMessage = restoreState !== 'idle' ? RESTORE_MESSAGES[restoreState] : null;

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
          <span className="material-symbols-outlined text-primary text-4xl">
            {isGuest ? 'person' : 'account_circle'}
          </span>
        </div>

        {isGuest ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-extrabold text-on-surface">Guest Profile</h3>
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mt-1">Local Mode</p>
            </div>
            {/* Viewport audit follow-up — touch-target correction:
                measured 34px tall (px-4 py-2 alone), below the 44px
                minimum. min-h-[44px] + flex centering guarantees the real
                target without changing the pill's visual proportions. */}
            <div className="flex gap-2 justify-center">
              <Link
                to="/auth"
                className="px-4 min-h-[44px] flex items-center justify-center rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/auth?tab=signup"
                className="px-4 min-h-[44px] flex items-center justify-center rounded-full glass-panel border border-white/10 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all"
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

      {!isGuest && (
        <section className="space-y-2">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Account</h3>
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <Link to="/change-password" className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">password</span>
                Change Password
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
            <button onClick={() => setConfirmSignOut(true)} disabled={signingOut} className={`${rowClass} disabled:opacity-50`}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">logout</span>
                Sign out
              </span>
            </button>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Preferences</h3>
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

          <Link to="/settings/timezone" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">public</span>
              Timezone
            </span>
            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
              {effectiveTimezone}
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </span>
          </Link>

          <div className={`${infoRowClass} cursor-default flex-wrap gap-2`}>
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
                  className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all min-h-[44px] ${
                    routineDuration === opt.id ? 'bg-primary text-on-primary' : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </span>
          </div>

          <div className="p-4 space-y-2">
            <Link to="/settings/notifications" className="w-full flex items-center justify-between min-h-[44px] hover:opacity-80 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-xl">
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
                Reminder preferences
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
            <p className="text-[11px] text-on-surface-variant pl-8">Reminder settings are saved on this device.</p>
          </div>
        </div>
      </section>

      {!isGuest && (
        <section className="space-y-2">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Membership</h3>
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <div className={`${infoRowClass} cursor-default`}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">workspace_premium</span>
                Membership
              </span>
              <span className="text-sm font-bold text-on-surface">{membershipStatusLabel}</span>
            </div>

            <Link to="/subscription" className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">credit_card</span>
                Manage Subscription
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>

            {restoreSupported && (
              <div className="p-4 space-y-2">
                <button
                  type="button"
                  onClick={handleRestoreTap}
                  disabled={restoreState === 'restoring'}
                  className="w-full flex items-center justify-between min-h-[44px] hover:opacity-80 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-xl disabled:opacity-60"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                    <span className="material-symbols-outlined text-on-surface-variant text-xl">history</span>
                    {restoreState === 'restoring' ? 'Restoring…' : 'Restore Purchases'}
                  </span>
                </button>
                {restoreMessage && (
                  <p role={restoreMessage.role} className={`text-[11px] pl-8 ${restoreMessage.role === 'alert' ? 'text-red-400 font-medium' : 'text-on-surface-variant'}`}>
                    {restoreMessage.text ?? restoreError}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Privacy and support</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <Link to="/settings/privacy-policy" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">privacy_tip</span>
              Privacy Policy
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>

          <Link to="/settings/terms-of-service" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">gavel</span>
              Terms of Service
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>

          {!isGuest && (
            <button type="button" onClick={() => setExportDialogOpen(true)} className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">download</span>
                Download a copy of my data
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </button>
          )}

          {!isGuest && (
            <Link to="/profile/delete-account" className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">person_remove</span>
                Delete Account
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">More</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <Link to="/journey" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">analytics</span>
              Journey and progress
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>

          <Link to="/introduction" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">info</span>
              About WakeWise
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
      </section>

      {/* WakeWise Phase 2 (B7, dialog severity audit) — Sign out is
          reversible and must never visually resemble Delete Account's own
          heavy, genuinely irreversible flow. Neutral (no destructive/
          mildDestructive prop). */}
      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message={signOutError || 'You can always sign back in later.'}
        confirmLabel={signingOut ? 'Signing out…' : 'Sign out'}
        cancelLabel="Cancel"
        confirmPending={signingOut}
        onConfirm={handleSignOut}
        onDismiss={dismissSignOut}
      />

      <ConfirmDialog
        open={restoreSignInPrompt}
        title="Sign in required"
        message="Create an account or sign in to restore a previous purchase."
        confirmLabel="Sign in"
        cancelLabel="Cancel"
        onConfirm={() => navigate('/auth')}
        onDismiss={() => setRestoreSignInPrompt(false)}
      />

      <DataExportDialog open={exportDialogOpen} onDismiss={() => setExportDialogOpen(false)} />
    </div>
  );
};
