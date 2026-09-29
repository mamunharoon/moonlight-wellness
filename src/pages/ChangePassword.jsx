/* eslint-disable no-unused-vars */
import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { BackButton } from '../components/BackButton';
import { resolveAuthError, logAuthDiagnostic, isWeakPasswordError, WEAK_PASSWORD_MESSAGE } from '../lib/authErrorMessages';
import { NEW_PASSWORD_HINT, getPasswordTooShortMessage, isPasswordTooShort, PASSWORD_MISMATCH_MESSAGE } from '../lib/passwordPolicy';

/*
 * WakeWise Phase 2A — in-app Change Password (Profile → Account)
 *
 * For an already-authenticated email/password user only. Reuses the exact
 * same rule/message building blocks as ResetPassword.jsx (passwordPolicy.js,
 * authErrorMessages.js) and the same supabase.auth.updateUser({ password })
 * call — this is deliberately the same operation ResetPassword.jsx performs
 * once its recovery session is established, just reached from inside the
 * app instead of from an email link. No current-password field: the
 * existing authenticated session itself is the proof of identity, same as
 * ResetPassword.jsx's own 'valid' phase requires no re-entry of anything
 * but the new password.
 *
 * Never logs or persists the password anywhere — held only in this
 * component's own state, cleared immediately on success or a weak-password
 * rejection, exactly like DeleteAccount.jsx's own reauth password handling.
 *
 * Provider guard: this app has no OAuth/social sign-in anywhere (confirmed
 * by repo-wide search — every account is created via Auth.jsx's own
 * email/password signUp), so `app_metadata.provider` is expected to always
 * be 'email' today. The check below is kept anyway so a future sign-in
 * method never silently renders a broken "change password" form for an
 * account that has no password to change.
 */
export const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [success, setSuccess] = useState(false);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  if (isGuest) {
    return <Navigate to="/profile" replace />;
  }

  const provider = user?.app_metadata?.provider ?? 'email';
  const supportsPasswordChange = provider === 'email';

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
    setPassword('');
    setConfirmPassword('');

    if (updateError) {
      if (isWeakPasswordError(updateError)) {
        setPasswordError(WEAK_PASSWORD_MESSAGE);
        passwordInputRef.current?.focus();
        return;
      }

      const resolved = resolveAuthError(updateError, {
        fallbackMessage: 'Something went wrong updating your password. Please try again.'
      });
      logAuthDiagnostic('changePassword', resolved);
      setError(resolved.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile" />
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Change Password</h2>
      </div>

      {!supportsPasswordChange && (
        <div className="glass-panel rounded-2xl p-5 space-y-2 border-white/10">
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Your account signs in through an external provider, so there's no WakeWise password to change here.
          </p>
        </div>
      )}

      {supportsPasswordChange && success && (
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

      {supportsPasswordChange && !success && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="glass-panel border border-red-400/30 rounded-2xl px-4 py-3 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="changePasswordNew" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">New password</label>
            <div className="relative">
              <input
                id="changePasswordNew"
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
                aria-describedby={passwordError ? 'changePasswordNewHint changePasswordNewError' : 'changePasswordNewHint'}
                className="w-full glass-panel border border-white/10 rounded-2xl px-3 py-2.5 pr-12 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
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
            <p id="changePasswordNewHint" className="text-[10px] text-on-surface-variant">{NEW_PASSWORD_HINT}</p>
            {passwordError && (
              <p id="changePasswordNewError" role="alert" className="text-[10px] text-red-400 font-medium">{passwordError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="changePasswordConfirm" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Confirm new password</label>
            <input
              id="changePasswordConfirm"
              ref={confirmPasswordInputRef}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              aria-invalid={Boolean(confirmPasswordError)}
              aria-describedby={confirmPasswordError ? 'changePasswordConfirmError' : undefined}
              className="w-full glass-panel border border-white/10 rounded-2xl px-3 py-2.5 text-base text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
            {confirmPasswordError && (
              <p id="changePasswordConfirmError" role="alert" className="text-[10px] text-red-400 font-medium">{confirmPasswordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
          >
            {isSubmitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
};
