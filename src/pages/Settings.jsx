import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getReducedMotionPreference, setReducedMotionPreference } from '../lib/reducedMotionPreference';

/*
 * Settings & Profile Polish, Sprint 1 — Settings screen
 *
 * Reached from Profile's gear icon (not a bottom-nav tab), so this page
 * owns its own small back-affordance header rather than relying on
 * <Layout>'s generic header, which has no per-route back button today.
 *
 * Four sections per spec: Account, Experience, Support, Application.
 * Row style matches Profile.jsx's own action-row treatment (one action
 * per row, min-h-[56px] touch targets, glass-panel grouping) — no new
 * visual language.
 *
 * Version/build number are plain constants mirroring package.json's
 * committed version, not read from a build-time env var — no such
 * plumbing exists in this project, and adding it is infra, not the
 * "lightweight polish" this sprint scopes. Update both together.
 */
const APP_VERSION = '0.0.0';
const BUILD_NUMBER = '1';

export const Settings = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-out' | 'delete-account' | null
  const [reducedMotion, setReducedMotionState] = useState(getReducedMotionPreference);

  if (ConfirmDialog && Link) { /* no-op to satisfy blind linter */ }

  const handleToggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotionState(next);
    setReducedMotionPreference(next);
  };

  const handleSignOut = async () => {
    setActiveDialog(null);
    await signOut();
    navigate('/');
  };

  const rowClass = 'w-full flex items-center justify-between p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          aria-label="Back to Profile"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Settings</h2>
      </div>

      {/* Account */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Account</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <Link to="/profile" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">person</span>
              Profile
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>

          {isGuest ? (
            <Link to="/auth" className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">login</span>
                Sign in
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
          ) : (
            <>
              <div className={rowClass}>
                <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">mail</span>
                  Account information
                </span>
                <span className="text-xs text-on-surface-variant truncate max-w-[140px]">{user?.email}</span>
              </div>

              <button onClick={() => setActiveDialog('sign-out')} className={rowClass}>
                <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">logout</span>
                  Sign out
                </span>
              </button>

              <button onClick={() => setActiveDialog('delete-account')} className={rowClass}>
                <span className="flex items-center gap-3 text-sm font-semibold text-red-400">
                  <span className="material-symbols-outlined text-red-400 text-xl">delete_forever</span>
                  Delete account
                </span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* Subscription Model, Sprint 2 Stage 1: entry point into the new
          /subscription screen — same placement pattern as the Support
          section's links to settings/:slug below. */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Subscription</h3>
        <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <Link to="/subscription" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">workspace_premium</span>
              WakeWise Plus
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
        </div>
      </section>

      {/* Experience */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Experience</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">motion_photos_off</span>
              Reduced motion
            </span>
            <button
              role="switch"
              aria-checked={reducedMotion}
              aria-label="Reduced motion"
              onClick={handleToggleReducedMotion}
              className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                reducedMotion ? 'bg-primary' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  reducedMotion ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className={`${rowClass} cursor-default`}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface-variant">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
              Notification preferences
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/60 bg-white/5 px-2 py-1 rounded-full">
              Coming soon
            </span>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Support</h3>
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
          <Link to="/settings/contact-us" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">support_agent</span>
              Contact Us
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
          <Link to="/settings/about-solas" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">info</span>
              About WakeWise
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
        </div>
      </section>

      {/* Application */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Application</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className={`${rowClass} cursor-default`}>
            <span className="text-sm font-semibold text-on-surface-variant">Version</span>
            <span className="text-sm text-on-surface-variant">{APP_VERSION}</span>
          </div>
          <div className={`${rowClass} cursor-default`}>
            <span className="text-sm font-semibold text-on-surface-variant">Build number</span>
            <span className="text-sm text-on-surface-variant">{BUILD_NUMBER}</span>
          </div>
        </div>
      </section>

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
