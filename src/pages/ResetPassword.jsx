/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { shouldTreatAsValidRecovery } from '../lib/resetPasswordAccess';
import { resolveAuthError, logAuthDiagnostic, isWeakPasswordError, WEAK_PASSWORD_MESSAGE } from '../lib/authErrorMessages';
import { NEW_PASSWORD_HINT, getPasswordTooShortMessage, isPasswordTooShort, PASSWORD_MISMATCH_MESSAGE } from '../lib/passwordPolicy';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState(() => (supabase ? 'checking' : 'invalid')); // 'checking' | 'valid' | 'invalid' | 'success'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Same accessible field-error pattern as Auth.jsx's Sign Up form (see its
  // own comment) — this is also a "create/replace a password" moment, not
  // login, so it gets the same 8-character rule and weak_password/breach
  // handling, never the Sign In flow.
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;

    let recoveryEventFired = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryEventFired = true;
        setStatus('valid');
      }
    });

    // getSession() is used only to know when Supabase has finished processing
    // the URL for a recovery token — never as proof of recovery itself. Any
    // pre-existing session (anonymous or normal) must not grant access.
    //
    // The one narrow exception: a native wakewise:// recovery link, which
    // never becomes window.location the way a web link does, so Supabase's
    // own URL-detection here never runs and PASSWORD_RECOVERY never fires
    // for it. useNativeDeepLinks.js / nativeAuthRecovery.js already fully
    // validated that link (genuine type=recovery tokens) and established
    // the session itself via the official setSession() API *before*
    // navigating here with `recoveryVerified` in router state — state only
    // reachable via our own internal navigate() call, never present in a
    // URL, browser history, or anything a direct/crafted visit could set.
    // Still independently re-confirm a session actually exists rather than
    // trusting that flag alone.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (recoveryEventFired) return;
      const valid = shouldTreatAsValidRecovery({
        recoveryEventFired,
        nativeRecoveryVerified: location.state?.recoveryVerified,
        hasSession: Boolean(session),
      });
      setStatus((current) => (current === 'valid' ? current : valid ? 'valid' : 'invalid'));
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabase) return;
    setError('');
    setPasswordError('');
    setConfirmPasswordError('');

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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      if (isWeakPasswordError(updateError)) {
        setPassword('');
        setConfirmPassword('');
        setPasswordError(WEAK_PASSWORD_MESSAGE);
        passwordInputRef.current?.focus();
        return;
      }

      const resolved = resolveAuthError(updateError, {
        fallbackMessage: 'Something went wrong updating your password. Please request a new reset link.',
      });
      logAuthDiagnostic('updateUser', resolved);
      setError(resolved.message);
      return;
    }

    setStatus('success');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-6 max-w-md mx-auto space-y-8">
      <div className="text-center space-y-2">
        <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock_reset</span>
        <h2 className="text-2xl font-bold text-on-surface">Reset your password</h2>
      </div>

      {status === 'checking' && (
        <p className="text-center text-xs text-on-surface-variant">Checking your reset link...</p>
      )}

      {status === 'invalid' && (
        <div className="space-y-4 text-center">
          <div role="alert" className="glass-panel border border-red-400/30 rounded-2xl px-4 py-3 text-xs text-red-400 font-medium">
            This reset link is invalid or has expired. Please request a new one.
          </div>
          <Link
            to="/auth"
            className="block w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            Back to Sign In
          </Link>
        </div>
      )}

      {status === 'valid' && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="glass-panel border border-red-400/30 rounded-2xl px-4 py-3 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">New password</label>
            <div className="relative">
              <input
                id="newPassword"
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
                aria-describedby={passwordError ? 'newPasswordHint newPasswordError' : 'newPasswordHint'}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
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
            <p id="newPasswordHint" className="text-[10px] text-on-surface-variant">{NEW_PASSWORD_HINT}</p>
            {passwordError && (
              <p id="newPasswordError" role="alert" className="text-[10px] text-red-400 font-medium">{passwordError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmNewPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Confirm new password</label>
            <input
              id="confirmNewPassword"
              ref={confirmPasswordInputRef}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              aria-invalid={Boolean(confirmPasswordError)}
              aria-describedby={confirmPasswordError ? 'confirmNewPasswordError' : undefined}
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
            {confirmPasswordError && (
              <p id="confirmNewPasswordError" role="alert" className="text-[10px] text-red-400 font-medium">{confirmPasswordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      {status === 'success' && (
        <div className="space-y-4 text-center">
          <div role="status" className="glass-panel border border-primary/30 rounded-2xl px-4 py-3 text-xs text-primary font-medium">
            Your password has been updated successfully.
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};
