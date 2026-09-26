/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BackButton } from '../components/BackButton';
import { CONTACT_INFO } from '../lib/legalContent';
import { getMyDeletionRequest } from '../lib/accountDeletionApi';

/*
 * Safe Account Management and Account Deletion — Account Management hub
 *
 * Reached only via Profile -> Privacy and Account -> Account management.
 * This is the calm landing point the owner asked for: subscription
 * management stays clearly available (delegates straight to the existing
 * /subscription screen — Stage 3A's real Stripe Checkout/Portal
 * integration, not rebuilt here), a data-export row that is labelled
 * honestly as not yet automated (no export mechanism exists in this
 * codebase today — see the Phase 1 audit), Sign out, and — last, not
 * first — "Request account deletion", which leads to the guarded
 * multi-step journey in DeleteAccount.jsx. Nothing on this screen is
 * itself destructive; it only navigates or opens an informational
 * dialog.
 */
export const AccountManagement = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-out' | 'export' | null
  const [pendingDeletion, setPendingDeletion] = useState(null);

  // Discoverability: a user who already has a pending request sees it
  // called out here too, not only inside the deletion journey itself —
  // "the deletion option must remain discoverable and not be hidden."
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { request } = await getMyDeletionRequest(user.id);
      if (!cancelled && request?.status === 'pending') setPendingDeletion(request);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (isGuest) {
    return <Navigate to="/profile" replace />;
  }

  const handleSignOut = async () => {
    setActiveDialog(null);
    await signOut();
    navigate('/');
  };

  const rowClass = 'w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset text-left';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile/privacy-account" />
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Account management</h2>
      </div>
      <p className="text-xs text-on-surface-variant -mt-4 px-1">Manage your account, subscription and personal data.</p>

      {pendingDeletion && (
        <button
          onClick={() => navigate('/profile/delete-account')}
          className="w-full glass-panel rounded-2xl p-4 flex items-center justify-between border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] text-left"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-amber-400 text-xl">schedule</span>
            Account deletion requested — tap to view or cancel
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </button>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <button onClick={() => navigate('/subscription')} className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">workspace_premium</span>
            Manage subscription
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </button>

        <button onClick={() => setActiveDialog('export')} className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">download</span>
            Download a copy of my data
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </button>

        <button onClick={() => setActiveDialog('sign-out')} className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">logout</span>
            Sign out
          </span>
        </button>
      </div>

      {/* Deletion is its own, visually separate group — reachable, but
          deliberately not styled like the routine actions above (no red,
          no shouting icon here either; DeleteAccount.jsx's own first
          screen is where the real explanation lives). */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <button onClick={() => navigate('/profile/delete-account')} className={rowClass}>
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">person_remove</span>
            Request account deletion
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
        </button>
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

      <ConfirmDialog
        open={activeDialog === 'export'}
        title="Download a copy of your data"
        message={`Automated data export isn't available in the app yet. Email us at ${CONTACT_INFO.email} from your account's email address and we'll prepare a copy for you.`}
        cancelLabel="Got it"
        onDismiss={() => setActiveDialog(null)}
      />
    </div>
  );
};
