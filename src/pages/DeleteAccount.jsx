/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useBackHandler } from '../hooks/useBackHandler';
import { useAuth } from '../context/AuthContext';
import { useMorningReminder } from '../context/MorningReminderContext';
import { supabase } from '../lib/supabaseClient';
import { CONTACT_INFO } from '../lib/legalContent';
import { openBillingPortal } from '../lib/stripeApi';
import { IS_DEV_BACKEND } from '../lib/buildInfo';
import {
  cancelAccountDeletion,
  deleteAccountNow,
  getMyBillingSnapshot,
  getMyDeletionRequest
} from '../lib/accountDeletionApi';

/*
 * Immediate Account Deletion — the deletion journey
 *
 * Reached only via Profile -> Privacy and Account -> Account management
 * -> Request account deletion. Never a single tap from anywhere else.
 * Mirrors this codebase's own established multi-step wizard shape
 * (Support.jsx, Meditate.jsx): one route, local step state, a local
 * back-arrow that moves one logical step backwards, never circular.
 *
 * Steps: status (only if an OLD-model 'pending' row, or a 'processing'
 * row from a prior attempt that died partway, already exists) ->
 * explain -> billing -> reauth -> confirm -> submitting -> done. Guests
 * never reach this screen at all (redirected to /profile before
 * render).
 *
 * Password handling: the password the user re-enters at the reauth step
 * is held only in this component's own React state, for the lifetime of
 * this one journey. It is used twice, both times via Supabase Auth's own
 * signInWithPassword — once here (client-side, fail-fast UX) and once
 * again inside the delete-account Edge Function (the real, authoritative
 * check — the client-side pass is never trusted alone). It is never
 * written to localStorage/sessionStorage, never logged, and is cleared
 * from state as soon as submission finishes, succeeds or fails.
 *
 * Submission is immediate and permanent. It calls delete-account, which
 * cancels any active Stripe subscription, deletes every user-owned row,
 * and removes the Supabase Auth user itself, in that order, before
 * returning — see that function's own header. There is no cancellable
 * waiting period anymore; a 200 response means the account is already
 * gone. On success this component signs the user out (clearing local
 * data the same way an ordinary sign-out does) and navigates away —
 * there is nothing left here to show once the account no longer exists.
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

const BackArrow = ({ onClick }) => {
  // Android system Back button/gesture repair — this journey has no
  // shared BackButton component; each step renders its own BackArrow
  // with that step's real "leave this step" destination as `onClick`.
  // Only one BackArrow is ever mounted at a time (one per step), so
  // registering here, generically, covers every step of this wizard
  // without a per-step condition. See backHandlerRegistry.js.
  useBackHandler(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary shrink-0"
    >
      <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
    </button>
  );
};

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
  const { user, isGuest, signOut } = useAuth();
  const { disable: disableMorningReminder } = useMorningReminder();

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
  // This field is a perfectly normal, always-editable input from first
  // render — see the decoy fields at the 'confirm' phase below for how
  // Chrome autofill is kept off it. A PRIOR version of this field
  // started read-only and flipped writable on its own first focus (plus
  // a re-focus-on-ready useEffect, to work around iOS WebKit deciding
  // keyboard visibility from the input's readOnly state AT THE MOMENT of
  // the original touch, not after a later re-render). That re-focus call
  // ran from inside a useEffect — after React's commit, outside the
  // original touch event's own call stack — and did not reliably count
  // as a trusted user gesture to iOS WebKit either: confirmed live on
  // real iOS hardware (DEV B61) that the field still never opened the
  // keyboard. Removing the readOnly toggle entirely removes the whole
  // class of bug, since nothing iOS-specific happens to this field now.
  const [submitError, setSubmitError] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Initial load: is there an unresolved request already? Two real
  // cases, both shown via the 'status' phase below:
  //   - 'pending' — a request from the OLD 7-day model, never cancelled
  //     and never completed. Still fully cancellable (unchanged); also
  //     now offers "Delete my account now instead".
  //   - 'processing' — a PRIOR immediate-deletion attempt that died
  //     partway (e.g. the Stripe cancellation or a data delete failed
  //     and the user closed the app) — the account still exists, still
  //     intact, nothing was silently lost. Offers "Finish deleting my
  //     account" to safely resume.
  // 'cancelled'/'completed' are resolved history, not something to act
  // on — treated the same as "no existing request". A real read failure
  // (not "table doesn't exist yet") is shown but does not block starting
  // a fresh request below — this check is informational, not itself a
  // safety gate.
  useEffect(() => {
    if (!user || isGuest) return;
    let cancelled = false;

    (async () => {
      const { request, error } = await getMyDeletionRequest(user.id);
      if (cancelled) return;
      if (error) setStatusError(error);
      if (request?.status === 'pending' || request?.status === 'processing') {
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

  // DEV-only, read-only deletion-flow diagnostics (physical-iOS keyboard
  // investigation, B61-B63). Decomposes the one outstanding question into
  // three independently observable signals: did focus actually land on
  // the confirmation field, did the on-screen keyboard appear, and was
  // text actually entered. Absent entirely on PROD (IS_DEV_BACKEND false
  // there, same gate as DevBuildIndicator) and never logs a field value,
  // password, or session data.
  //
  // Deliberately NOT wired as an event handler on the confirmation field
  // or any ancestor of it — the prior round (8fe0c2a) did exactly that
  // (capture-phase pointerdown/touchstart on a wrapper, onFocus/onBlur on
  // the real input), and because those handlers fire setState synchronously
  // inside the same touch-to-focus call stack iOS WebKit uses to decide
  // keyboard visibility, that round's one success could not be ruled out
  // as a side effect of its own instrumentation rather than evidence of
  // anything about the field itself (see ba77c9d's own discussion). Every
  // signal here is designed to minimise that specific risk, NOT to
  // guarantee zero effect on timing or to prove anything about the
  // keyboard - treat each as an indicator, read alongside whatever the
  // device actually shows, not as proof on its own:
  //   - keyboard shown/hidden: window.visualViewport's own 'resize' event
  //     - fires on the OS's own schedule, never triggered by or wired to
  //     this field. An INDICATOR the keyboard opened/closed, not proof -
  //     Safari's dynamic toolbar and an orientation change can also move
  //     this by a similar amount, and this build has no way to tell those
  //     apart from an actual keyboard transition.
  //   - focus landed/left: a 100ms polling loop reading
  //     document.activeElement - a macrotask on its own timer, never
  //     inside the original touch/focus event's synchronous call stack,
  //     so it cannot be the thing that decides keyboard visibility for
  //     that gesture. It still calls setState on every observed
  //     transition, adding scheduled work (timers, re-renders) to the JS
  //     event loop that a truly diagnostics-free build would not have -
  //     minimised, not proven inert. Do not treat a pass or fail here as
  //     isolating the diagnostics-free code's own real-world behaviour;
  //     see the verification plan this investigation records separately
  //     for that.
  //   - entry: logged from the field's EXISTING onChange handler
  //     (handleConfirmationChange below), which can only ever fire after
  //     a keystroke has already landed - it cannot influence whether the
  //     keyboard appeared, only confirm, after the fact, that typing
  //     worked.
  // This cannot prove what causes the underlying defect, and is not
  // treated as one - it only gives the next on-device attempt a readable,
  // on-screen (no Mac/Xcode needed) record of which of the three stages
  // the flow actually reached. The cause stays unresolved regardless of
  // what any single attempt shows.
  const [diagLog, setDiagLog] = useState([]);
  const diagStartRef = useRef(null);
  const pushDiagEvent = (kind, detail) => {
    if (diagStartRef.current == null) diagStartRef.current = performance.now();
    const t = Math.round(performance.now() - diagStartRef.current);
    setDiagLog((prev) => [...prev.slice(-14), { t, kind, detail }]);
  };

  useEffect(() => {
    if (!IS_DEV_BACKEND || phase !== 'confirm') return undefined;
    diagStartRef.current = performance.now();
    // Deferred (not a direct setState call in the effect body) - purely
    // to satisfy the same lint rule every other state-setting effect in
    // this file already respects; timing-wise this still runs before the
    // next paint, well before the user can have tapped anything yet.
    queueMicrotask(() => setDiagLog([{ t: 0, kind: 'mount', detail: 'confirm step mounted - tap the field now' }]));

    const vv = window.visualViewport;
    let lastHeight = vv ? vv.height : null;
    const onViewportResize = () => {
      if (!vv) return;
      const delta = Math.round(vv.height - lastHeight);
      lastHeight = vv.height;
      // Ignore sub-40px noise (status bar/rotation jitter) - a real
      // keyboard opening/closing moves the visual viewport far more than
      // that on every iOS device size this app targets.
      if (Math.abs(delta) < 40) return;
      pushDiagEvent(delta < 0 ? 'keyboard-likely-shown' : 'keyboard-likely-hidden', `viewport ${Math.round(vv.height)}px (delta ${delta}px)`);
    };
    vv?.addEventListener('resize', onViewportResize);

    let lastActiveWasConfirmField = false;
    const pollId = window.setInterval(() => {
      const isActive = document.activeElement?.id === 'confirmPhrase';
      if (isActive !== lastActiveWasConfirmField) {
        lastActiveWasConfirmField = isActive;
        pushDiagEvent(isActive ? 'focus-landed' : 'focus-left', 'confirmPhrase');
      }
    }, 100);

    return () => {
      vv?.removeEventListener('resize', onViewportResize);
      window.clearInterval(pollId);
    };
  }, [phase]);

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
    // left holding a stale value from a prior visit.
    setConfirmationInput('');
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
    // Logged (length only, never the value) only after this keystroke has
    // already reached the field - onChange cannot fire before that, so
    // this can only ever confirm entry worked, never influence whether
    // the keyboard appeared for it. See the diagnostics effect above.
    if (IS_DEV_BACKEND && next.length !== confirmationInput.length) {
      pushDiagEvent('entry', `length ${next.length}`);
    }
    setConfirmationInput(next);
  };

  // Immediate, permanent deletion. A successful resolution here means
  // the account and its data are ALREADY gone server-side — everything
  // after that point (disabling the local reminder, signing out) is
  // best-effort, local-device-only cleanup that can never undo or
  // retroactively invalidate that fact, so neither is allowed to stop
  // the 'done' screen from showing. A thrown error means the opposite:
  // nothing irreversible happened this call (see delete-account/index.ts's
  // own outcome-to-message mapping, surfaced here via deleteAccountNow's
  // own error unwrapping) — password is deliberately NOT cleared on
  // failure, so the exact same "Request account deletion" tap on this
  // same confirm screen safely retries with no need to re-enter it or
  // return to the reauth step.
  const handleSubmit = async () => {
    setPhase('submitting');
    setSubmitError(null);
    try {
      await deleteAccountNow({ password, confirmationPhrase: confirmationInput });
      setPassword('');
      await disableMorningReminder?.().catch(() => {});
      await signOut().catch(() => {});
      setPhase('done');
    } catch (e) {
      // deleteAccountNow's own error unwrapping surfaces the real,
      // specific server message (which, per delete-account/index.ts's
      // own outcome-to-message map, is always honest about what state
      // deletion was actually left in - never "fully intact" once any
      // data could already be gone). This generic fallback is reached
      // only when no message could be read at all (e.g. the response
      // never arrived) - deliberately NOT claiming the account is
      // intact in that genuinely-unknown case either.
      setSubmitError(e?.message || "Something went wrong and we couldn't confirm whether deletion finished. Please try again.");
      setPhase('confirm');
    }
  };

  // Status-screen action for an existing, unresolved request (see the
  // loading effect above for the two real cases: an old-model 'pending'
  // row, or a 'processing' row from a prior attempt that died partway —
  // the account still fully exists either way, nothing was silently
  // lost). Both route through the exact same explain -> billing ->
  // reauth -> confirm chain as a fresh request; no client-side branching
  // is needed for "resume vs. start fresh" because delete-account's own
  // getExistingRequestRow (server-side) already reconciles whichever
  // row exists by reusing it, never duplicating it — see
  // accountDeletion.ts's own header.
  const startOrResumeImmediateDeletion = () => {
    setExistingRequest(null);
    setPhase('explain');
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

  if (phase === 'status' && existingRequest?.status === 'pending') {
    // Carried over from the old 7-day model — this exact row is still
    // fully cancellable (unchanged), and now also offers the current,
    // immediate flow as an alternative. Whichever one the user picks,
    // this exact row is the one that resolves (see
    // startOrResumeImmediateDeletion's own comment).
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => navigate('/profile/account-management')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Deletion requested</h2>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
          <p className="text-sm text-on-surface leading-relaxed">
            You've asked us to delete your WakeWise account. You can still cancel this request and keep your account,
            or delete it right now instead of waiting.
          </p>
          <div className="space-y-1 text-xs text-on-surface-variant">
            <p>Requested: {formatDate(existingRequest.requested_at)}</p>
          </div>
        </div>

        {cancelError && <p role="alert" className="text-xs text-red-400 font-medium px-1">{cancelError}</p>}

        <PrimaryButton onClick={handleCancelRequest} loading={cancelLoading}>
          {cancelLoading ? 'Cancelling…' : 'Cancel deletion request — keep my account'}
        </PrimaryButton>
        <SecondaryButton onClick={startOrResumeImmediateDeletion} disabled={cancelLoading}>
          Delete my account now instead
        </SecondaryButton>
        <SecondaryButton onClick={() => navigate('/profile/account-management')} disabled={cancelLoading}>
          Back to Account management
        </SecondaryButton>
      </div>
    );
  }

  if (phase === 'status' && existingRequest?.status === 'processing') {
    // A prior immediate-deletion attempt died partway through (e.g. the
    // Stripe cancellation or a data delete failed, or the app/network
    // dropped) — the account still exists, fully intact; nothing was
    // silently lost. There is no "cancel" here (unlike the pending case
    // above): resuming simply re-confirms identity and continues the
    // exact same, already-started deletion.
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BackArrow onClick={() => navigate('/profile/account-management')} />
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Deletion didn't finish</h2>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
          <p className="text-sm text-on-surface leading-relaxed">
            A previous attempt to delete your account didn't complete. Your account and data are still here — nothing
            was lost. You can finish deleting your account now, or go back and keep using WakeWise.
          </p>
        </div>

        <PrimaryButton onClick={startOrResumeImmediateDeletion}>
          Finish deleting my account
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
              Your profile, wake/bed time and timezone settings, journal entries, intentions, and your practice-completion and Momentum history.
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
              This is immediate and permanent. Once you confirm on the final screen, your account and data are deleted
              right away — there is no waiting period and no way to undo it afterward.
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
                  You have an active WakeWise Plus subscription. If you continue, it will be cancelled at the end of your current billing period (no refund is issued for the current period) as part of deleting your account — but your WakeWise account itself is deleted immediately, right now, not at that later billing date.
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
            {/* WakeWise Phase 2A — billing-provider honesty. Deleting the
                WakeWise account never itself reaches Apple's or Google's
                billing systems, so it never cancels a store subscription —
                the previous version of this screen only distinguished
                Stripe from "everything else" and told every non-Stripe
                subscriber their access would "simply end," which becomes
                false and misleading the moment a real Apple/Google
                subscriber exists (their store subscription keeps renewing
                and charging them after this WakeWise account is gone). Each
                real provider gets its own honest statement; an unrecognised
                provider value gets a safe general warning rather than being
                assumed manual. */}
            {plusActive && billing.provider === 'apple' && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Your WakeWise Plus subscription is billed through the App Store. Deleting your WakeWise account does
                not cancel it — it will keep renewing and charging you until you cancel it yourself in
                Settings → [your name] → Subscriptions on your iPhone.
              </p>
            )}
            {plusActive && billing.provider === 'google' && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Your WakeWise Plus subscription is billed through Google Play. Deleting your WakeWise account does
                not cancel it — it will keep renewing and charging you until you cancel it yourself in the Google
                Play app under Subscriptions.
              </p>
            )}
            {plusActive && billing.provider === 'manual' && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Your WakeWise Plus access was granted manually and isn't linked to Stripe, Apple, or Google billing.
                It will simply end when your account is deleted.
              </p>
            )}
            {plusActive && !['stripe', 'apple', 'google', 'manual'].includes(billing.provider) && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                We couldn't confirm how your subscription is billed. If you have an active subscription through
                Apple, Google Play, or another provider, deleting your WakeWise account will not automatically
                cancel it — please check and cancel it directly with that provider if you no longer want to be
                charged.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {/* Dialog-severity correction — found on audit: this step had
              the hierarchy inverted relative to every other pre-final-
              confirmation step in this flow ("explain" above, "status"
              below) - "Continue" was the prominent PrimaryButton and
              "Keep my account" was the muted SecondaryButton. Per the
              approved hierarchy, Keep-my-account must stay the prominent
              safe action until the final typed-phrase confirmation step;
              only the actual consequence/wording changed nowhere - this
              swaps which button uses which component, nothing else. */}
          <PrimaryButton onClick={() => navigate('/profile/account-management')}>
            Keep my account
          </PrimaryButton>
          <SecondaryButton disabled={billingLoading || Boolean(billingError)} onClick={() => setPhase('reauth')}>
            Continue
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
          <p role="alert" className="text-sm text-on-surface leading-relaxed font-semibold">
            This permanently deletes your WakeWise account and all of your personal data immediately. This cannot be
            undone.
          </p>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Deleting WakeWise does not cancel a subscription billed through the Apple App Store or Google Play — you
            must cancel those directly with Apple or Google, using the links on the previous screen. A subscription
            billed through our own checkout (Stripe) is cancelled as part of this request, as already explained.
          </p>
        </div>

        {/* A separate, unrelated <form> (autoComplete="off", a
            non-credential-looking name) — its own scope, so this plain
            text field is never a target for password-manager autofill. */}
        <form onSubmit={(e) => { e.preventDefault(); if (phraseMatches) handleSubmit(); }} autoComplete="off" className="space-y-6">
          {/* Autofill decoy. Chrome offers to autofill the just-used
              password into the real field below regardless of its own
              <form>, autoComplete="off" and non-credential name
              (confirmed live) — Chrome fills the first matching
              username/password pair it finds anywhere in the form, so
              these two real, interactive fields placed ahead of the
              real one absorb that offer instead. Positioned off-screen
              via layout (not display:none/visibility:hidden, which
              Chrome's autofill heuristic ignores as targets), unreachable
              by keyboard (tabIndex={-1}) and hidden from screen readers
              (aria-hidden) — no sighted, keyboard, or AT user ever
              encounters them. This replaces the previous
              readOnly-until-focus mechanism entirely; the real field
              below is now a normal, always-editable input with nothing
              iOS-specific happening to it. */}
          <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
            <input type="text" name="username" autoComplete="username" tabIndex={-1} defaultValue="" />
            <input type="password" name="password" autoComplete="current-password" tabIndex={-1} defaultValue="" />
          </div>
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
            {phase === 'submitting' ? 'Deleting…' : 'Permanently delete my account'}
          </PrimaryButton>
        </form>

        {/* DEV-only diagnostic readout - see the diagnostics effect above
            for exactly what each line means and why none of this wiring
            touches the field or its wrapper. Fixed to the bottom of the
            viewport, pointer-events-none so it can never itself become a
            tap target, gated on IS_DEV_BACKEND the same way
            DevBuildIndicator is - absent entirely from PROD. */}
        {IS_DEV_BACKEND && (
          <div
            className="fixed bottom-0 left-0 right-0 z-[998] max-h-32 overflow-y-auto bg-black/85 text-[9px] font-mono text-lime-300 px-2 py-1 pointer-events-none"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div>DEV diag - focus / keyboard / entry (no values logged)</div>
            {diagLog.map((d, i) => (
              <div key={i}>+{d.t}ms {d.kind} - {d.detail}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    // The account is already gone (handleSubmit's own signOut() already
    // ran) — nothing on this screen reads `user` or any other
    // now-stale AuthContext value, and there is deliberately no "Back to
    // Account management" action, since that destination requires a
    // session that no longer exists.
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Account deleted</h2>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3 border-white/10">
          <p className="text-sm text-on-surface leading-relaxed">
            Your WakeWise account and personal data have been permanently deleted.
          </p>
          <div className="space-y-1 text-xs text-on-surface-variant">
            <p>
              If you had a subscription billed through the Apple App Store or Google Play, it has not been cancelled
              by this — please cancel it directly with Apple or Google if you no longer want to be charged.
            </p>
            <p>Questions? Contact us at {CONTACT_INFO.email}.</p>
          </div>
        </div>

        <PrimaryButton onClick={() => navigate('/')}>Done</PrimaryButton>
      </div>
    );
  }

  return null;
};
