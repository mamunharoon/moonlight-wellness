/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { CONTACT_INFO } from '../lib/legalContent';
import { openBillingPortal } from '../lib/stripeApi';
import {
  cancelAccountDeletion,
  getMyBillingSnapshot,
  getMyDeletionRequest,
  requestAccountDeletion
} from '../lib/accountDeletionApi';

/*
 * Safe Account Management and Account Deletion — the deletion journey
 *
 * Reached only via Profile -> Privacy and Account -> Account management
 * -> Request account deletion. Never a single tap from anywhere else.
 * Mirrors this codebase's own established multi-step wizard shape
 * (Support.jsx, Meditate.jsx): one route, local step state, a local
 * back-arrow that moves one logical step backwards, never circular.
 *
 * Steps: status (if a request already exists) -> explain -> billing ->
 * reauth -> confirm -> submitting -> done. Guests never reach this
 * screen at all (redirected to /profile before render).
 *
 * Password handling: the password the user re-enters at the reauth step
 * is held only in this component's own React state, for the lifetime of
 * this one journey. It is used twice, both times via Supabase Auth's own
 * signInWithPassword — once here (client-side, fail-fast UX) and once
 * again inside the request-account-deletion Edge Function (the real,
 * authoritative check — the client-side pass is never trusted alone). It
 * is never written to localStorage/sessionStorage, never logged, and is
 * cleared from state as soon as submission finishes, succeeds or fails.
 *
 * Submission does not itself delete anything. It calls
 * request-account-deletion, which only ever inserts a row into
 * account_deletion_requests with status='pending' — see that function
 * and the Phase 5 migration proposal. Final, permanent processing stays
 * a manual, documented operator step (see docs/account-deletion-*), not
 * an automated worker — the copy below states this honestly rather than
 * promising something this batch does not build.
 */
const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

const formatDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getFriendlyReauthError = (error) => {
  const msg = error?.message || '';
  if (msg.includes('Invalid login credentials')) {
    return 'The password you entered is incorrect.';
  }
  return 'Something went wrong. Please try again.';
};

const BackArrow = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Go back"
    className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary shrink-0"
  >
    <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
  </button>
);

const PrimaryButton = ({ children, disabled, loading, onClick, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-50 disabled:active:scale-100 min-h-[44px]"
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px]"
  >
    {children}
  </button>
);

export const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();

  const [phase, setPhase] = useState('loading');
  // 'loading' | 'status' | 'explain' | 'billing' | 'reauth' | 'confirm' | 'submitting' | 'done' | 'load-error'

  const [existingRequest, setExistingRequest] = useState(null);
  const [statusError, setStatusError] = useState(null);

  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState(null);

  const [confirmationInput, setConfirmationInput] = useState('');
  // Starts read-only and flips writable on the field's own first focus.
  // Chrome will still offer to autofill a just-used password into this
  // field despite its own <form>, autoComplete="off" and a
  // non-credential name (confirmed live) — a read-only field at render
  // time is not an autofill target at all, which is what actually stops
  // it, per Chrome's own documented autofill behaviour.
  const [confirmFieldReady, setConfirmFieldReady] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const [result, setResult] = useState(null);

  // Initial load: is there already a pending request? A real read
  // failure (not "table doesn't exist yet") is shown but does not block
  // starting a fresh request below — this check is informational, not
  // itself a safety gate.
  useEffect(() => {
    if (!user || isGuest) return;
    let cancelled = false;

    (async () => {
      const { request, error } = await getMyDeletionRequest(user.id);
      if (cancelled) return;
      if (error) setStatusError(error);
      if (request?.status === 'pending') {
        setExistingRequest(request);
        setPhase('status');
      } else {
        setPhase('explain');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (isGuest) {
    return <Navigate to="/profile" replace />;
  }

  const loadBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    const { subscription, error } = await getMyBillingSnapshot(user.id);
    setBillingLoading(false);
    if (error) {
      setBillingError(error);
      return;
    }
    setBilling(subscription);
  };

  const goToBilling = () => {
    setPhase('billing');
    loadBilling();
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await openBillingPortal();
      // On success this redirects the browser away entirely.
    } catch (e) {
      setPortalLoading(false);
      setBillingError("We couldn't open billing management. Please try again.");
    }
  };

  const handleReauth = async () => {
    if (!password) return;
    setReauthLoading(true);
    setReauthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    setReauthLoading(false);
    if (error) {
      setReauthError(getFriendlyReauthError(error));
      return;
    }
    // Fresh every time this step is (re-)entered — including a second
    // pass after Back -> Continue — so the confirmation field is never
    // left holding a stale value or already flipped writable from a
    // prior visit.
    setConfirmationInput('');
    setConfirmFieldReady(false);
    setPhase('confirm');
  };

  // This field's expected content ("DELETE MY ACCOUNT") is not sensitive
  // — it's printed on this same screen — so a large single-event change
  // (autofill, Chrome's own remembered-value suggestion, a paste) isn't
  // itself a problem; rejecting those broke the legitimate case where
  // Chrome re-suggests the exact correct phrase in one shot. The one
  // thing that must never land here is the real password, so that's the
  // only thing this guards against directly — confirmed live that a
  // scoped <form>, autoComplete="off", a non-credential name, and a
  // readOnly-until-focus field were each insufficient on their own to
  // stop Chrome offering the just-used password the instant this field
  // became focusable.
  const handleConfirmationChange = (e) => {
    const next = e.target.value;
    if (password && next === password) return;
    setConfirmationInput(next);
  };

  const handleSubmit = async () => {
    setPhase('submitting');
    setSubmitError(null);
    try {
      const data = await requestAccountDeletion({ password, confirmationPhrase: confirmationInput });
      setPassword('');
      setResult(data);
      setPhase('done');
    } catch (e) {
      setPassword('');
      setSubmitError('Something went wrong submitting your request. Please try again.');
      setPhase('confirm');
    }
  };

  const handleCancelRequest = async () => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      await cancelAccountDeletion();
      setExistingRequest(null);
      setPhase('explain');
    } catch (e) {
      setCancelError('Something went wrong cancelling your request. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => navigate('/profile/account-management')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Request account deletion</h2>
        </div>
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  if (phase === 'status' && existingRequest) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => navigate('/profile/account-management')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Deletion requested</h2>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
          <p className="text-sm text-on-surface leading-relaxed">
            You've asked us to delete your WakeWise account. You can still cancel this request and keep your account.
          </p>
          <div className="space-y-1 text-xs text-on-surface-variant">
            <p>Requested: {formatDate(existingRequest.requested_at)}</p>
            <p>Scheduled for: {formatDate(existingRequest.scheduled_for)}</p>
          </div>
          <p className="text-xs text-on-surface-variant">
            You can keep using WakeWise normally until then, and cancel any time before that date.
          </p>
        </div>

        {cancelError && <p role="alert" className="text-xs text-red-400 font-medium px-1">{cancelError}</p>}

        <PrimaryButton onClick={handleCancelRequest} loading={cancelLoading}>
          {cancelLoading ? 'Cancelling…' : 'Cancel deletion request — keep my account'}
        </PrimaryButton>
        <SecondaryButton onClick={() => navigate('/profile/account-management')}>
          Back to Account management
        </SecondaryButton>
      </div>
    );
  }

  if (phase === 'explain') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => navigate('/profile/account-management')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Request account deletion</h2>
        </div>

        {statusError && <p className="text-xs text-on-surface-variant px-1">{statusError}</p>}

        <div className="glass-panel rounded-2xl p-5 space-y-4 border-white/10">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">What will be deleted</p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Your profile, wake/bed time and timezone settings, journal entries, and intentions.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">What may be retained</p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              A minimal billing record, kept only as long as required by law and by our payment processor, Stripe — never your wellness data.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Billing</p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Deleting your account does not automatically refund previous payments. We'll show you what happens to any active subscription on the next screen.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Timing</p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              This isn't immediate. Your request is scheduled for 7 days from now, and you can cancel it any time before then from Account management.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <PrimaryButton onClick={() => navigate('/profile/account-management')}>
            Keep my account
          </PrimaryButton>
          <SecondaryButton onClick={goToBilling}>Continue</SecondaryButton>
        </div>
      </div>
    );
  }

  if (phase === 'billing') {
    const plusActive = billing && billing.plan === 'plus' && ['trial', 'active'].includes(billing.status);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => setPhase('explain')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Your subscription</h2>
        </div>

        {billingLoading && <p className="text-sm text-on-surface-variant">Checking your billing status…</p>}

        {!billingLoading && billingError && (
          <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
            <p className="text-sm text-on-surface-variant leading-relaxed">{billingError}</p>
            <SecondaryButton onClick={loadBilling}>Retry</SecondaryButton>
          </div>
        )}

        {!billingLoading && !billingError && billing && (
          <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
            {!plusActive && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                You don't have an active subscription. Continuing won't affect any billing.
              </p>
            )}
            {plusActive && billing.provider === 'stripe' && (
              <>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  You have an active WakeWise Plus subscription. If you continue, it will be cancelled at the end of your current billing period when your deletion request is processed — you'll keep access until then, and no refund is issued for the current period.
                </p>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="w-full glass-panel text-on-surface py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 min-h-[44px]"
                >
                  {portalLoading ? 'Opening billing management…' : 'Manage subscription in Stripe'}
                </button>
              </>
            )}
            {plusActive && billing.provider !== 'stripe' && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Your WakeWise Plus access was granted manually and isn't linked to Stripe billing. It will simply end when your account is deleted.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <PrimaryButton disabled={billingLoading || Boolean(billingError)} onClick={() => setPhase('reauth')}>
            Continue
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate('/profile/account-management')}>
            Keep my account
          </SecondaryButton>
        </div>
      </div>
    );
  }

  if (phase === 'reauth') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => setPhase('billing')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Confirm it's you</h2>
        </div>
        <p className="text-sm text-on-surface-variant">For your security, please confirm your password before continuing.</p>

        {/* Its own <form> so the browser scopes autofill to this one
            field — without a form boundary, a single-page app never
            triggers a real page load between steps, and Chrome will
            happily re-autofill the same saved password into the very
            next plain-text input it sees (confirmed live: it filled the
            phrase field below with this password before this fix). */}
        <form onSubmit={(e) => { e.preventDefault(); handleReauth(); }} autoComplete="on" className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="reauthPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Password</label>
            <div className="relative">
              <input
                id="reauthPassword"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-3 pr-10 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {reauthError && <p role="alert" className="text-xs text-red-400 font-medium">{reauthError}</p>}
          </div>

          <PrimaryButton type="submit" disabled={!password} loading={reauthLoading}>
            {reauthLoading ? 'Checking…' : 'Continue'}
          </PrimaryButton>
        </form>
      </div>
    );
  }

  if (phase === 'confirm' || phase === 'submitting') {
    const phraseMatches = confirmationInput === CONFIRMATION_PHRASE;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => setPhase('reauth')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Final confirmation</h2>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
          <p className="text-sm text-on-surface leading-relaxed">
            This action affects your WakeWise account and personal data. It cannot be undone after the cancellation period ends.
          </p>
        </div>

        {/* A separate, unrelated <form> (autoComplete="off", a
            non-credential-looking name) — its own scope, so this plain
            text field is never a target for password-manager autofill. */}
        <form onSubmit={(e) => { e.preventDefault(); if (phraseMatches) handleSubmit(); }} autoComplete="off" className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="confirmPhrase" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">
              Type {CONFIRMATION_PHRASE} to confirm
            </label>
            <input
              id="confirmPhrase"
              name="account-deletion-confirmation-phrase"
              type="text"
              placeholder={CONFIRMATION_PHRASE}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              readOnly={!confirmFieldReady}
              onFocus={() => setConfirmFieldReady(true)}
              onPaste={(e) => e.preventDefault()}
              value={confirmationInput}
              onChange={handleConfirmationChange}
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-3 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary min-h-[44px] placeholder:text-on-surface-variant/40"
            />
            {/* This field is plain text on purpose, so you can verify the
                phrase before submitting — it is never your password. */}
            <p className="text-[11px] text-on-surface-variant/70">This is not your password — type the exact phrase above, nothing else.</p>
          </div>

          {submitError && <p role="alert" className="text-xs text-red-400 font-medium px-1">{submitError}</p>}

          <PrimaryButton type="submit" disabled={!phraseMatches} loading={phase === 'submitting'}>
            {phase === 'submitting' ? 'Submitting…' : 'Request account deletion'}
          </PrimaryButton>
        </form>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Request received</h2>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
          <p className="text-sm text-on-surface leading-relaxed">
            Your account deletion request has been received.
          </p>
          <div className="space-y-1 text-xs text-on-surface-variant">
            {result?.scheduledFor && <p>Scheduled for: {formatDate(result.scheduledFor)}</p>}
            <p>You can keep using WakeWise normally until then.</p>
            <p>You can cancel this request any time before that date from Account management.</p>
            <p>Questions? Contact us at {CONTACT_INFO.email}.</p>
          </div>
        </div>

        <PrimaryButton onClick={() => navigate('/')}>Return to Today</PrimaryButton>
        <SecondaryButton onClick={() => navigate('/profile/account-management')}>
          Back to Account management
        </SecondaryButton>
      </div>
    );
  }

  return null;
};
