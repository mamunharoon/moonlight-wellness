/* eslint-disable no-unused-vars */
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CONTACT_INFO } from '../lib/legalContent';

/*
 * WakeWise Phase 2A — public account-deletion resource (/delete-account)
 *
 * Google Play requires an account-deletion request to be reachable from a
 * public web page, outside the app, for someone who has uninstalled it or
 * never installed it at all — the Data Safety section links directly to
 * this route. Registered in OnboardingGate.jsx's ALLOWED_PRE_ENTRY_PATHS
 * (the same allowlist /auth and /settings/privacy-policy already use) so
 * it renders for a visitor with no session and no prior "Continue as
 * Guest" choice — the normal case for this link, reached cold from outside
 * the app.
 *
 * Deliberately inert: this page never accepts a user id or email as a URL
 * parameter, never reads one from a query string, and performs no
 * destructive action itself — it only explains the process and, for a
 * signed-in visitor, links into the existing protected flow
 * (DeleteAccount.jsx, which independently redirects a guest away — this
 * page's own isGuest branch is a UX convenience, not the real gate). A
 * signed-out visitor is only ever offered "Sign in" — never a form, never
 * an account-existence check of any kind.
 */
export const PublicDeleteAccount = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();

  return (
    <div
      className="min-h-[85vh] max-w-md mx-auto space-y-6"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
      }}
    >
      <div className="text-center space-y-2">
        <span className="material-symbols-outlined text-primary text-3xl">person_remove</span>
        <h1 className="text-2xl font-morning-display italic font-semibold text-on-surface">
          Delete your {CONTACT_INFO.product} account
        </h1>
        <p className="text-xs text-on-surface-variant">{CONTACT_INFO.product} is provided by {CONTACT_INFO.company}.</p>
      </div>

      <div className="glass-panel rounded-2xl p-5 space-y-4 border-white/10">
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">How to request deletion</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Sign in to your {CONTACT_INFO.product} account and confirm the request — no separate form is needed, and
            we never ask for your account details on this page.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">What gets deleted</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Your profile, wake/bed time and timezone settings, journal entries, and intentions.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">A cancellable waiting period</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Requesting deletion does not delete anything immediately. It starts a 7-day period during which you can
            cancel the request and keep your account exactly as it was.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">What may be retained</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            We may keep a minimal billing or security record for as long as required by law — never your wellness
            data. See our Data Retention Policy for detail.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Subscriptions are separate</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Deleting your {CONTACT_INFO.product} account does not automatically cancel a subscription billed through
            the Apple App Store or Google Play — manage or cancel those directly with Apple or Google. A subscription
            billed through our own checkout is addressed as part of the deletion request itself.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {isGuest ? (
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            Sign in to request deletion
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/profile/delete-account')}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            Continue to request deletion
          </button>
        )}

        {/* WakeWise Phase 2A correction — a real, tappable path for a
            visitor who cannot sign in, reusing the one existing official
            support address (CONTACT_INFO.email, the same address the
            account-deletion-policy legal document and the in-app deletion
            flow already point to) rather than inventing a new contact
            channel. A mailto: link, not a form: this page never accepts a
            typed email/user id as input, never treats an email as proof
            of anything, and never implies whether an account exists —
            the actual verification still happens only inside the
            protected, re-authenticated deletion flow. */}
        <p className="text-xs text-on-surface-variant text-center leading-relaxed px-2">
          Can't sign in? Email{' '}
          <a href={`mailto:${CONTACT_INFO.email}`} className="text-primary font-semibold">{CONTACT_INFO.email}</a>
          {' '}from your account's email address and we'll assist.
        </p>
      </div>

      <p className="text-[11px] text-on-surface-variant text-center leading-relaxed px-2">
        <Link to="/settings/privacy-policy" className="text-primary font-semibold">Privacy Policy</Link>
        {' '}·{' '}
        <Link to="/settings/terms-of-service" className="text-primary font-semibold">Terms of Service</Link>
        {' '}·{' '}
        <Link to="/settings/account-deletion-policy" className="text-primary font-semibold">Full Account Deletion Policy</Link>
      </p>
    </div>
  );
};
