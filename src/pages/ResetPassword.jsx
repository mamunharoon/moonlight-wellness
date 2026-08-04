/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const MIN_PASSWORD_LENGTH = 8;

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(() => (supabase ? 'checking' : 'invalid')); // 'checking' | 'valid' | 'invalid' | 'success'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('valid');
      }
    });

    // getSession() is used only to know when Supabase has finished processing
    // the URL for a recovery token — never as proof of recovery itself. Any
    // pre-existing session (anonymous or normal) must not grant access.
    supabase.auth.getSession().then(() => {
      setStatus((current) => (current === 'valid' ? current : 'invalid'));
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabase) return;
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError('Something went wrong updating your password. Please request a new reset link.');
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
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <p className="text-[10px] text-on-surface-variant">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmNewPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Confirm new password</label>
            <input
              id="confirmNewPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
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
