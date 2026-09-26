/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BackButton } from '../components/BackButton';

/*
 * Safe Account Management — Privacy and Account
 *
 * Owner decision: account deletion must not be prominent here. This
 * screen no longer has its own red "Delete my account" row at all — the
 * only account-management entry point is the calm "Account management"
 * row below, which leads to /profile/account-management. Deletion itself
 * lives one screen further in, as "Request account deletion" (see
 * DeleteAccount.jsx) — never a single tap away from this list.
 */
export const PrivacyAndAccount = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-out' | null

  const handleSignOut = async () => {
    setActiveDialog(null);
    await signOut();
    navigate('/');
  };

  const rowClass = 'w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile" />
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Privacy and Account</h2>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        {!isGuest && (
          <div className={`${rowClass} cursor-default`}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">mail</span>
              Account email
            </span>
            <span className="text-xs text-on-surface-variant truncate max-w-[140px]">{user?.email}</span>
          </div>
        )}

        <button
          onClick={() => navigate('/settings/privacy-policy')}
          className={rowClass}
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">privacy_tip</span>
            Privacy Policy
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </button>

        <button
          onClick={() => navigate('/settings/data-retention-policy')}
          className={rowClass}
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">database</span>
            Data Retention Policy
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </button>

        {!isGuest && (
          <button onClick={() => setActiveDialog('sign-out')} className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">logout</span>
              Sign out
            </span>
          </button>
        )}

        {!isGuest && (
          <button onClick={() => navigate('/profile/account-management')} className={rowClass}>
            <span className="flex items-start gap-3 text-left">
              <span className="material-symbols-outlined text-on-surface-variant text-xl mt-0.5">manage_accounts</span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-on-surface">Account management</span>
                <span className="text-xs text-on-surface-variant">Manage your account, subscription and personal data</span>
              </span>
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant shrink-0">chevron_right</span>
          </button>
        )}
      </div>

      {/* WakeWise Phase 2 (B7, dialog severity audit) — Sign out is
          reversible and must never visually resemble Delete Account's own
          heavy, genuinely irreversible flow. Neutral (no destructive/
          mildDestructive prop). */}
      <ConfirmDialog
        open={activeDialog === 'sign-out'}
        title="Sign out?"
        message="You can always sign back in later."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        onConfirm={handleSignOut}
        onDismiss={() => setActiveDialog(null)}
      />
    </div>
  );
};
