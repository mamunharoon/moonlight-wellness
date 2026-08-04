/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const MIN_PASSWORD_LENGTH = 8;

const getFriendlyErrorMessage = (error) => {
  const msg = error?.message || '';
  if (msg.includes('Invalid login credentials')) {
    return 'The email or password you entered is incorrect.';
  }
  if (msg.includes('User already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Please verify your email before signing in. Check your inbox for the verification link.';
  }
  if (msg.includes('Password should be at least')) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return 'Something went wrong. Please try again.';
};

export const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp' | 'forgotPassword'
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

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setMessage('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabase) return;
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password
    });
    setIsSubmitting(false);

    if (signInError) {
      setError(getFriendlyErrorMessage(signInError));
      return;
    }

    navigate('/profile');
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (isSubmitting || !supabase) return;
    setError('');
    setMessage('');

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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
    setIsSubmitting(false);

    if (signUpError) {
      setError(getFriendlyErrorMessage(signUpError));
      return;
    }

    if (data.user && !data.session) {
      setMessage('Account created! Check your email to verify your address before signing in.');
      switchMode('signIn');
      return;
    }

    navigate('/profile');
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
      redirectTo: `${window.location.origin}/reset-password`
    });
    setIsSubmitting(false);

    if (resetError) {
      setError(getFriendlyErrorMessage(resetError));
      return;
    }

    setMessage("If an account exists for that email, a password reset link is on its way.");
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-6 max-w-md mx-auto space-y-8">
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

      {mode === 'signUp' && (
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
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
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
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signUpEmail" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Email</label>
            <input
              id="signUpEmail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signUpPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Password</label>
            <div className="relative">
              <input
                id="signUpPassword"
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
            <label htmlFor="confirmPassword" className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Confirm password</label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
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
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
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
              className="w-full glass-panel border border-white/10 rounded-xl px-3 py-2.5 text-sm text-on-surface bg-transparent outline-none focus:ring-1 focus:ring-primary"
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

      <Link to="/profile" className="block text-center text-xs text-on-surface-variant">
        Continue as guest
      </Link>
    </div>
  );
};
