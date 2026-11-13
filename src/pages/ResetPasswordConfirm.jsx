/* eslint-disable no-unused-vars */
import { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { parseResetConfirmParams, confirmPasswordReset } from '../lib/resetPasswordConfirm';

// WakeWise Password Reset — Click-to-Confirm Page.
//
// Reached from the email's reset link, which now points here instead of
// Supabase's hosted /verify endpoint (see resetPasswordConfirm.js's own
// header comment for the full root cause and the exact PROD template
// change this requires - not applied by this file).
//
// Deliberately does nothing with the token on mount - parseResetConfirmParams
// is pure and never touches Supabase. The token is only ever redeemed by
// the "Continue" button's own tap handler, via confirmPasswordReset. On
// success, hands off to the existing /reset-password form exactly the way
// the native wakewise:// deep-link flow already does (navigate with
// `state: { recoveryVerified: true }`, read by ResetPassword.jsx's own
// shouldTreatAsValidRecovery check) - this page never duplicates the
// password-entry form itself.
export const ResetPasswordConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => parseResetConfirmParams(location.search), [location.search]);
  const [status, setStatus] = useState(() => (params ? 'ready' : 'invalid')); // 'ready' | 'confirming' | 'invalid'

  const handleContinue = async () => {
    if (status !== 'ready' || !params) return;
    setStatus('confirming');
    const ok = await confirmPasswordReset(params);
    if (ok) {
      navigate('/reset-password', { replace: true, state: { recoveryVerified: true } });
      return;
    }
    setStatus('invalid');
  };

  return (
    <div
      className="min-h-[85vh] flex flex-col justify-center max-w-md mx-auto space-y-8"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="text-center space-y-2">
        <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock_reset</span>
        <h2 className="text-3xl font-morning-display italic font-semibold text-on-surface">Reset your password</h2>
      </div>

      {status === 'invalid' && (
        <div className="space-y-4 text-center">
          <div role="alert" className="glass-panel border border-red-400/30 rounded-2xl px-4 py-3 text-xs text-red-400 font-medium">
            This reset link is invalid or has expired. Please request a new one.
          </div>
          <Link
            to="/auth"
            className="block w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-welcome-glow"
          >
            Back to Sign In
          </Link>
        </div>
      )}

      {(status === 'ready' || status === 'confirming') && (
        <div className="space-y-4 text-center">
          <p className="text-xs text-on-surface-variant">
            Tap Continue to confirm it was you, then set a new password.
          </p>
          <button
            type="button"
            onClick={handleContinue}
            disabled={status === 'confirming'}
            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-welcome-glow disabled:opacity-40"
          >
            {status === 'confirming' ? 'Confirming...' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
};
