/* eslint-disable no-unused-vars */
import { useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { consumePendingContent } from '../lib/pendingContent';
import { getPasswordResetRedirectUrl } from '../lib/authRedirect';
import { markGuestEntryChosen } from '../lib/guestEntry';
import { shouldShowIntroduction } from '../lib/introductionVersion';
import { BackButton } from '../components/BackButton';
import {
  resolveAuthError,
  logAuthDiagnostic,
  isAccountAlreadyExistsError,
  isWeakPasswordError,
  isEmailRateLimitError,
  NEUTRAL_NO_SESSION_MESSAGE,
  WEAK_PASSWORD_MESSAGE,
  EMAIL_RATE_LIMIT_MESSAGE,
  SIGNUP_FALLBACK_MESSAGE,
} from '../lib/authErrorMessages';
import { NEW_PASSWORD_HINT, getPasswordTooShortMessage, isPasswordTooShort, PASSWORD_MISMATCH_MESSAGE } from '../lib/passwordPolicy';

// The two ambiguous-signup outcomes that replace the Sign Up form with a
// message-plus-actions panel instead of a plain error/success banner - see
// the state/JSX below. 'neutral': a no-session success OR the rare
// explicit user_already_exists error (both enumeration-safe, identical
// copy - see NEUTRAL_NO_SESSION_MESSAGE's own comment). 'rateLimited':
// Supabase's real over_email_send_rate_limit, which very often fires on a
// perfectly legitimate repeat attempt, not a mistake - same "stop
// resubmitting, here's what to do instead" treatment as 'neutral'.
const SIGNUP_OUTCOME_MESSAGES = {
  neutral: NEUTRAL_NO_SESSION_MESSAGE,
  rateLimited: EMAIL_RATE_LIMIT_MESSAGE,
};

export const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('tab') === 'signup' ? 'signUp' : 'signIn';
  const [mode, setMode] = useState(initialMode); // 'signIn' | 'signUp' | 'forgotPassword'
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Field-level, accessibility-wired errors for the Sign Up form only (see
  // the accessible-error JSX below) — kept separate from the generic
  // `error` banner above, which stays reserved for whole-form problems
  // (missing name, rate limiting, offline, an unmapped server error) that
  // aren't attributable to one specific input.
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  // Signup UX Remediation — replaces the old "Account created! Check your
  // email..." success message, and also replaces a bare rate-limit error
  // banner. null | 'neutral' | 'rateLimited' — see SIGNUP_OUTCOME_MESSAGES
  // above. Setting this to a non-null value swaps the Sign Up form out for
  // a message-plus-actions panel (see the JSX below), which incidentally
  // also satisfies "no repeated Create Account submission for a completed
  // request" — there is no submit button left to double-tap once an
  // outcome is showing.
  // Deliberately NOT reset by goToSignInAfterSignup (below) — the whole
  // point is that this guidance survives that specific transition onto the
  // Sign In form (rendered there too - see the JSX below). It IS reset by
  // every other route to Sign In (the top Sign In/Sign Up pills, or
  // actually submitting Sign In) via switchMode/handleSignIn, since those
  // represent the user deliberately moving on.
  const [signupOutcome, setSignupOutcome] = useState(null);

  // Accessible error focus management (Sign Up form only — see the
  // corrective-pattern JSX below): each ref lets a handler move focus to
  // the exact input its error describes, synchronously, right after
  // setting that error's state — the input is already mounted (setState
  // re-renders it in place, never unmounts it), so no effect/timer is
  // needed to wait for it to exist.
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setMessage('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setSignupOutcome(null);
  };

  // The outcome panel's own "Go to Sign In" action - deliberately NOT
  // switchMode('signIn'): switchMode always clears signupOutcome, but here
  // the whole point is that the confirmation/rate-limit guidance the user
  // just saw survives onto the Sign In screen (rendered as a banner there
  // - see the JSX below), so they don't lose it mid-flow.
  const goToSignInAfterSignup = () => {
    setMode('signIn');
    setError('');
    setMessage('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
  };

  // Guest access repair: if this sign-in/sign-up was reached via a
  // locked-content sign-in prompt (Library, Support, Prepare for Rest,
  // any contextual exercise row) or a protected-routine gate
  // (RoutineDetail.jsx), return the user to that exact page with the
  // tapped item ready to open — see lib/pendingContent.js,
  // hooks/useProtectedVideo.js and RoutineDetail.jsx's own handleSignIn.
  //
  // Routing policy fix: an ORDINARY sign-in (no pending destination) must
  // land on Home, never Profile. This previously fell back to
  // navigate('/profile') unconditionally, which is what a plain
  // Welcome/Auth sign-in with nothing pending was silently landing on -
  // reproduced live (sign out, sign back in as an ordinary user, land on
  // /profile instead of Home). consumePendingContent() already discards
  // anything invalid/expired/unsafe (see its own isSafeReturnPath guard)
  // and reads-and-clears in one step, so an external/invalid or already-
  // consumed destination naturally falls through to this same Home
  // fallback - no separate handling needed here.
  // First-login Introduction gate — a ONE-SHOT check performed exactly
  // once here, right after a successful sign-in/sign-up, never a
  // persistent per-route gate (unlike OnboardingGate) - this is what
  // prevents a redirect loop by construction: nothing re-evaluates this
  // on a later navigation, so leaving /introduction without completing it
  // can never bounce the user back.
  //
  // Queries this user's own profile row DIRECTLY (never AuthContext's own
  // `profile` state, which is fetched by a separate effect keyed on
  // `user` and may not have resolved yet at this exact moment - trusting
  // it here could both show a stale decision and risk a flash of
  // authenticated Home before a slow profile fetch settles). `authUser`
  // is the user object the calling handler already has in hand from its
  // own signIn/signUp response - not a re-fetch, not a context read.
  //
  // A pending-content destination always wins over Introduction (an
  // explicit "come back to this exact locked item" intent from before
  // sign-in is more specific than a generic first-login screen).
  //
  // Failure handling: a query error here fails OPEN toward Home, never
  // toward forcing the Introduction on uncertain data - logged via
  // console.warn (no user-identifying detail: no email, no user id, just
  // the fact that the check failed) rather than surfaced to the user,
  // since Home remains a perfectly good landing either way.
  const redirectAfterAuth = async (authUser) => {
    const pending = consumePendingContent();
    if (pending) {
      if (!pending.id) {
        navigate(pending.returnPath);
        return;
      }
      const separator = pending.returnPath.includes('?') ? '&' : '?';
      navigate(`${pending.returnPath}${separator}openId=${encodeURIComponent(pending.id)}`);
      return;
    }

    if (supabase && authUser && !authUser.is_anonymous) {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('introduction_completed_version')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        console.warn('redirectAfterAuth: introduction-version check failed, defaulting to Home', profileError.message);
      } else if (shouldShowIntroduction(profileRow?.introduction_completed_version)) {
        // replace: true - Back from Introduction must not return to the
        // Auth form (already submitted, nothing to resubmit). `?auto=1`
        // marks this as an automatic first-use visit (new sign-up, or an
        // existing account below CURRENT_INTRODUCTION_VERSION) so
        // Introduction.jsx itself can hide its Back control - there is
        // nothing in-app to go back TO on this exact visit. See
        // Introduction.jsx's own doc comment for the full rationale.
        //
        // `&existing=1` (Personalised Welcome copy) is set only when this
        // account already had a real, previously-completed version
        // (truthy introduction_completed_version) - distinguishing "brand
        // new account, never completed any version" from "existing
        // account, refreshed screen below the current version" right at
        // the one place that already has this exact data in scope,
        // rather than relying on AuthContext's own separately-timed
        // profile fetch (which could still be loading at this exact
        // moment for a just-created account) for a decision this
        // synchronous redirect needs immediately.
        const existingParam = profileRow?.introduction_completed_version ? '&existing=1' : '';
        navigate(`/introduction?auto=1${existingParam}`, { replace: true });
        return;
      }
    }

    navigate('/');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabase) return;
    setError('');
    setMessage('');
    // A real sign-in attempt means the user is done acting on whatever
    // signup guidance (see signupOutcome/goToSignInAfterSignup above) may
    // still be showing here - clear it now rather than leaving it to
    // linger past this point.
    setSignupOutcome(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password
    });

    if (signInError) {
      setIsSubmitting(false);
      const resolved = resolveAuthError(signInError);
      logAuthDiagnostic('signIn', resolved);
      setError(resolved.message);
      return;
    }

    // isSubmitting stays true through the redirect decision itself (never
    // reset here) - this is what keeps the form's own submit control
    // disabled/showing "Signing in..." for the brief extra moment the
    // introduction-version check takes, rather than flashing back to an
    // idle, re-enabled Auth form right before navigating away.
    await redirectAfterAuth(signInData?.user);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabase) return;
    setError('');
    setMessage('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setSignupOutcome(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!trimmedEmail) {
      setEmailError('Please enter your email address.');
      emailInputRef.current?.focus();
      return;
    }
    if (isPasswordTooShort(password)) {
      setPasswordError(getPasswordTooShortMessage());
      passwordInputRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError(PASSWORD_MISMATCH_MESSAGE);
      confirmPasswordInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          first_name: trimmedFirst,
          last_name: trimmedLast
        }
      }
    });

    if (signUpError) {
      setIsSubmitting(false);

      // Enumeration-safe: routes the rare explicit `user_already_exists`
      // error to the exact same neutral panel as a genuine no-session
      // success below — never a distinct "this email is taken" message.
      if (isAccountAlreadyExistsError(signUpError)) {
        setSignupOutcome('neutral');
        return;
      }

      // Checked via the structured error code first (see isWeakPasswordError),
      // not string-matched here, so this survives a GoTrue wording change.
      // Password/confirm are deliberately cleared — reusing a password
      // Supabase just confirmed is breached/predictable is never correct
      // guidance — while first/last name and email are left untouched.
      if (isWeakPasswordError(signUpError)) {
        setPassword('');
        setConfirmPassword('');
        setPasswordError(WEAK_PASSWORD_MESSAGE);
        passwordInputRef.current?.focus();
        return;
      }

      // A real, live Supabase rate limit - routed to its own outcome panel
      // (not the generic `error` banner) specifically so "Create Account"
      // isn't left sitting there inviting an immediate identical retry,
      // which would just be rate-limited again. Never triggers another
      // email send itself.
      if (isEmailRateLimitError(signUpError)) {
        setSignupOutcome('rateLimited');
        return;
      }

      const resolved = resolveAuthError(signUpError, { fallbackMessage: SIGNUP_FALLBACK_MESSAGE });
      logAuthDiagnostic('signUp', resolved);

      // email_address_invalid/validation_failed are, in this form, only
      // ever actually about the email field — password length/mismatch
      // are already fully caught client-side above before any network
      // call, and first/last name are unvalidated metadata GoTrue never
      // rejects.
      if (resolved.code === 'email_address_invalid' || resolved.code === 'validation_failed') {
        setEmailError(resolved.message);
        emailInputRef.current?.focus();
        return;
      }

      setError(resolved.message);
      return;
    }

    if (data.user && !data.session) {
      setIsSubmitting(false);
      setSignupOutcome('neutral');
      return;
    }

    // isSubmitting stays true through the redirect decision itself - see
    // handleSignIn's identical comment above.
    await redirectAfterAuth(data.user);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabase) return;
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: getPasswordResetRedirectUrl()
    });
    setIsSubmitting(false);

    if (resetError) {
      const resolved = resolveAuthError(resetError);
      logAuthDiagnostic('resetPasswordForEmail', resolved);
      setError(resolved.message);
      return;
    }

    setMessage("If an account exists for that email, a password reset link is on its way.");
  };

  return (
    <div
      className="min-h-[85vh] flex flex-col justify-center max-w-md mx-auto space-y-8"
      // Safe-area support: Auth/ResetPassword render outside <Layout> (see
      // App.jsx routing) and capacitor.config.ts sets `contentInset:
      // 'never'`, so nothing else insets these two pages from the notch/
      // Dynamic Island or the home indicator - CSS env() is the only
      // mechanism, same convention Layout.jsx already uses for its own
      // header/nav (see Layout.jsx's own safe-area comments). Adds to the
      // existing 1.5rem (previously py-6) padding rather than replacing
      // it, and never doubles up since this is the only safe-area padding
      // either page applies. No overflow/height constraint exists on this
      // div, index.css, or index.html (confirmed - no #root or html/body
      // height/overflow rule anywhere in this repo), so content taller
      // than the viewport already scrolls via the normal document scroll;
      // nothing here needs to change to keep that working.
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* Navigation audit: rendered outside <Layout> (no shared header),
          and reached from several places (Profile's Sign In/Create
          Account, and locked-content sign-in prompts elsewhere) - so
          BackButton's own goBack() is used rather than a hardcoded
          destination, returning to wherever the user actually came from. */}
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile" />
      </div>

      <div className="text-center space-y-2">
        <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
        <h2 className="text-2xl font-bold text-on-surface">
          {mode === 'signUp' ? 'Create your account' : mode === 'forgotPassword' ? 'Reset your password' : 'Welcome back'}
        </h2>
        <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
          {mode === 'signUp'
            ? 'Save your progress and access it from any device.'
            : mode === 'forgotPassword'
              ? "Enter your email and we'll send you a link to reset your password."
              : 'Sign in to pick up right where you left off.'}
        </p>
      </div>

      {mode !== 'forgotPassword' && (
        <div className="glass-panel p-1 rounded-full flex items-center gap-1">
          <button
            type="button"
            onClick={() => switchMode('signIn')}
            className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'signIn' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signUp')}
            className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'signUp' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            Sign Up
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="glass-panel border border-red-400/30 rounded-2xl px-4 py-3 text-xs text-red-400 font-medium">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="glass-panel border border-primary/30 rounded-2xl px-4 py-3 text-xs text-primary font-medium">
          {message}
        </div>
      )}

      {mode === 'signUp' && signupOutcome && (
        <div className="space-y-4">
          <div role="status" className="glass-panel border border-primary/30 rounded-2xl px-4 py-3 text-xs text-primary font-medium">
            {SIGNUP_OUTCOME_MESSAGES[signupOutcome]}
          </div>
          {/* Deliberately goToSignInAfterSignup, not switchMode('signIn') -
              this is the one transition where the message above must
              survive onto the Sign In screen (rendered again there below)
              rather than being cleared. */}
          <button
            type="button"
            onClick={goToSignInAfterSignup}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            Go to Sign In
          </button>
          {/* Switches to the Forgot Password form only — never sends a
              reset email itself. That form still requires its own
              explicit "Send Reset Link" submit (see handleForgotPassword
              above), so arriving here never triggers an email on its
              own. */}
          <button
            type="button"
            onClick={() => switchMode('forgotPassword')}
            className="w-full glass-panel border border-white/10 py-3.5 rounded-full font-bold text-on-surface hover:opacity-90 active:scale-95 transition-all"
          >
            Forgot Password
          </button>
        </div>
      )}

      {mode === 'signUp' && !signupOutcome && (
        <form onSubmit={handleSignUp} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="firstName" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">First name</label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lastName" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Last name</label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signUpEmail" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Email</label>
            <input
              id="signUpEmail"
              ref={emailInputRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'signUpEmailError' : undefined}
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
            {emailError && (
              <p id="signUpEmailError" role="alert" className="text-[10px] text-red-400 font-medium">{emailError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signUpPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Password</label>
            <div className="relative">
              <input
                id="signUpPassword"
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                  if (confirmPasswordError) setConfirmPasswordError('');
                }}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'signUpPasswordHint signUpPasswordError' : 'signUpPasswordHint'}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 pr-12 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-full text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            <p id="signUpPasswordHint" className="text-[10px] text-on-surface-variant">{NEW_PASSWORD_HINT}</p>
            {passwordError && (
              <p id="signUpPasswordError" role="alert" className="text-[10px] text-red-400 font-medium">{passwordError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Confirm password</label>
            <div className="relative">
              <input
                id="confirmPassword"
                ref={confirmPasswordInputRef}
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmPasswordError) setConfirmPasswordError('');
                }}
                aria-invalid={Boolean(confirmPasswordError)}
                aria-describedby={confirmPasswordError ? 'confirmPasswordError' : undefined}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 pr-12 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-full text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined text-lg">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {confirmPasswordError && (
              <p id="confirmPasswordError" role="alert" className="text-[10px] text-red-400 font-medium">{confirmPasswordError}</p>
            )}
          </div>

          <p className="text-[11px] text-on-surface-variant text-center leading-relaxed">
            By creating an account, you agree to our{' '}
            <Link to="/settings/terms-of-service" className="text-primary font-semibold">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/settings/privacy-policy" className="text-primary font-semibold">Privacy Policy</Link>.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}

      {mode === 'signIn' && signupOutcome && (
        <div role="status" className="glass-panel border border-primary/30 rounded-2xl px-4 py-3 text-xs text-primary font-medium">
          {SIGNUP_OUTCOME_MESSAGES[signupOutcome]}
        </div>
      )}

      {mode === 'signIn' && (
        <form onSubmit={handleSignIn} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="signInEmail" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Email</label>
            <input
              id="signInEmail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signInPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Password</label>
            <div className="relative">
              <input
                id="signInPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 pr-12 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-full text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => switchMode('forgotPassword')}
              className="text-xs text-primary font-semibold"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      {mode === 'forgotPassword' && (
        <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="resetEmail" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Email</label>
            <input
              id="resetEmail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
          >
            {isSubmitting ? 'Sending link...' : 'Send Reset Link'}
          </button>

          <button
            type="button"
            onClick={() => switchMode('signIn')}
            className="w-full text-center text-xs text-on-surface-variant font-semibold"
          >
            Back to Sign In
          </button>
        </form>
      )}

      {/* Guest Onboarding: this is a second, alternate path to the same
          "Continue as Guest" choice Welcome's own button offers — must
          persist the exact same way (lib/guestEntry.js), or a user who
          bailed out here would incorrectly see the Welcome screen again
          next launch despite having already said "just let me browse". */}
      <Link to="/profile" onClick={markGuestEntryChosen} className="block text-center text-xs text-on-surface-variant">
        Continue as guest
      </Link>
    </div>
  );
};
