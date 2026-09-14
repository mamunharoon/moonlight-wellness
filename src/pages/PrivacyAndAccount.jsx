/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BackButton } from '../components/BackButton';

/*
 * Daily Journey & Content Architecture — Privacy and Account
 *
 * Account deletion moves here, out of Profile's main row list — the
 * required Profile organisation keeps it reachable only via
 * Profile -> Privacy and Account -> Delete my account, not prominently
 * on the main screen. Reuses the exact same acknowledge-only
 * ConfirmDialog ("Account deletion will be available soon.") Profile.jsx
 * already used — deletion itself is still out of scope this batch, only
 * its placement changes.
 */
export const PrivacyAndAccount = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-out' | 'delete-account' | null

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
          <button onClick={() => setActiveDialog('delete-account')} className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-red-400">
              <span className="material-symbols-outlined text-red-400 text-xl">delete_forever</span>
              Delete my account
            </span>
          </button>
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
    </div>
  );
};
