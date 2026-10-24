/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getReducedMotionPreference, setReducedMotionPreference } from '../lib/reducedMotionPreference';
import { isBetaProgramVisible, isSubscriptionSandboxTestVisible } from '../lib/featureFlags';
import { BackButton } from '../components/BackButton';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from '../lib/platform';
import { BUILD_COMMIT } from '../lib/buildInfo';
import { ENVIRONMENT_LABEL, formatBuildCommitLabel } from '../lib/environmentBuildInfo';

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

// WakeWise Phase 3 (R13) — "Subscription" is the row's fixed label ("what
// this row is"); the actual plan is its live value, same split every
// other value-bearing row here uses (Wake time / Bedtime). Matches
// Subscription.jsx's own PLAN_LABELS mapping so a Free-plan account
// never reads as already-subscribed at a glance.
const PLAN_LABELS = { free: 'Free', plus: 'WakeWise Plus' };

export const Settings = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const { subscription } = useSubscription();
  const [activeDialog, setActiveDialog] = useState(null); // 'sign-out' | null
  const [reducedMotion, setReducedMotionState] = useState(getReducedMotionPreference);

  // Environment row (Settings -> Application) - native build number is
  // read at runtime from the installed binary's own Info.plist via
  // @capacitor/app, never hardcoded; null on web, where this plugin has
  // nothing meaningful to report. See environmentBuildInfo.js's own
  // header for why this is a separate row from the existing Version/
  // Build number constants above, not a replacement for them.
  const [nativeBuild, setNativeBuild] = useState(null);
  useEffect(() => {
    if (!isNativePlatform()) return;
    CapacitorApp.getInfo()
      .then((info) => setNativeBuild(info?.build ?? null))
      .catch(() => setNativeBuild(null));
  }, []);
  const buildCommitLabel = formatBuildCommitLabel({ nativeBuild, commit: BUILD_COMMIT });

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
        <BackButton fallback="/profile" label="Back to Profile" />
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
              Subscription
            </span>
            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
              {PLAN_LABELS[subscription.plan] ?? subscription.plan}
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </span>
          </Link>
        </div>
      </section>

      {/* Audio Architecture, Phase C1: entry point into the audio
          library — same placement pattern as the Subscription section
          above. No audio plays yet (see AudioPlayerPlaceholder.jsx). */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Content</h3>
        <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <Link to="/audio" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">library_music</span>
              Audio Library
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
            {/* WakeWise Phase 1 correction — this button's own visible pill
                measured 48x28px (w-12 h-7), under the 44px tap-target
                minimum on its shorter axis. Same established fix as
                MusicPreferenceToggle.jsx (see its own doc comment): the
                w-12 h-7 pill moves onto a decorative aria-hidden inner
                span, and the real <button> grows its own hit box via
                symmetric py-2 padding (28 + 8 + 8 = 44px) with a matching
                -my-2 negative margin, so the surrounding row's layout
                height is unaffected. role="switch"/aria-checked/aria-label/
                onClick and the on/off colour logic are unchanged, just
                relocated. */}
            <button
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              aria-label="Reduced motion"
              onClick={handleToggleReducedMotion}
              className="shrink-0 rounded-full -my-2 py-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <span
                aria-hidden="true"
                className={`block w-12 h-7 rounded-full transition-colors relative ${
                  reducedMotion ? 'bg-primary' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    reducedMotion ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          <Link to="/settings/notifications" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
              Notification preferences
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
        </div>
      </section>

      {/* Closed Beta Preparation, Phase A, later retired: the "Beta
          Program" heading and its /beta entry point are deliberately
          removed from this list — the hub page itself (Beta.jsx) no
          longer renders any real content either (see that file's own
          header), so there is no in-app affordance left pointing at it
          at all. Feedback and Release Notes are unrelated to that
          specific program and stay reachable here, still gated behind
          isBetaProgramVisible() exactly as before — this task only
          removed the Beta Program row/heading, not that gate's own
          meaning for these two. */}
      {isBetaProgramVisible() && (
        <section className="space-y-2">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Feedback &amp; Updates</h3>
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <Link to="/feedback" className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">feedback</span>
                Send Feedback
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
            <Link to="/release-notes" className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">history_edu</span>
                Release Notes
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
          </div>
        </section>
      )}

      {/* RevenueCat sandbox test surface — the authenticated, DEV-only
          entry point SubscriptionSandboxTest.jsx's own route was missing
          (it was reachable only by typing its exact URL, with no in-app
          affordance at all). Gated on the exact same build-time flag
          that page itself checks (isSubscriptionSandboxTestVisible,
          featureFlags.js) — never shown for a build where that flag
          isn't the literal string 'true', same as the page's own stub
          fallback — AND never shown to a guest (isGuest), since the real
          page's own purchase/restore controls act as the genuinely
          signed-in RevenueCat identity already established elsewhere in
          this app (App.jsx's RevenueCatIdentityHandler), not a fresh
          anonymous one. Same gated-section pattern as the Feedback &
          Updates section above - visible by default is never the goal
          here, the opposite of that section's own default. */}
      {!isGuest && isSubscriptionSandboxTestVisible() && (
        <section className="space-y-2">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Diagnostics</h3>
          <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <Link to="/dev/subscription-sandbox-test" className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">bug_report</span>
                Subscription Sandbox Test
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
          </div>
        </section>
      )}

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
          <Link to="/settings/subscription-terms" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">receipt_long</span>
              Subscription Terms
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
          <Link to="/settings/refund-policy" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">currency_exchange</span>
              Refund Policy
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
          <Link to="/settings/medical-disclaimer" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">health_and_safety</span>
              Medical and Wellbeing Disclaimer
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
          <Link to="/settings/account-deletion-policy" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">person_remove</span>
              Account Deletion Policy
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
          <Link to="/settings/data-retention-policy" className={rowClass}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">database</span>
              Data Retention Policy
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
          <div className={`${rowClass} cursor-default`}>
            <span className="text-sm font-semibold text-on-surface-variant">Environment</span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-semibold text-on-surface">{ENVIRONMENT_LABEL}</span>
              {buildCommitLabel && (
                <span className="text-xs text-on-surface-variant">{buildCommitLabel}</span>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* WakeWise Phase 2 (B7, dialog severity audit) — Sign out is
          reversible (sign back in any time, nothing is deleted or lost)
          and must never visually resemble Delete Account's own heavy,
          multi-step, genuinely irreversible flow. Neutral (no destructive/
          mildDestructive prop) - the plain default ConfirmDialog styling. */}
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
