import { useEffect, useRef } from 'react';
import { PREMIUM_GATE } from '../lib/premiumAccess';

/*
 * Phase 2C — PlusPaywallDialog
 *
 * Shown instead of opening BetaVideoModal/switching a breathing pattern
 * whenever premiumAccess.js's resolvePremiumGate() resolves to LOCKED or
 * VERIFICATION_UNAVAILABLE for a signed-in, non-guest user (a guest still
 * sees SignInPromptDialog first, exactly as before — this dialog is never
 * shown to a guest). Same visual language and a11y pattern as
 * SignInPromptDialog.jsx (backdrop, glass-panel surface, focus-trap-to-
 * primary-button, Escape/backdrop dismiss) — this app's one other
 * "locked content" dialog — deliberately not a third, differently-shaped
 * pattern.
 *
 * Two distinct states, never conflated (§6 of
 * docs/phase-2c-access-specification.md): a genuine LOCKED subscriber
 * sees an ordinary upsell ("View Plus options"); a VERIFICATION_UNAVAILABLE
 * read (e.g. connectivity loss) sees an honest "can't verify right now"
 * message with a Retry action instead — never an upsell pitch for someone
 * whose real entitlement this app simply failed to confirm, and never a
 * silent grant either.
 */
export const PlusPaywallDialog = ({ open, state = PREMIUM_GATE.LOCKED, onViewPlus, onRetry, onDismiss }) => {
  const primaryButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement;
    primaryButtonRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onDismiss]);

  if (!open) return null;

  const isUnavailable = state === PREMIUM_GATE.VERIFICATION_UNAVAILABLE;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      role="presentation"
      onClick={onDismiss}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plus-paywall-title"
        aria-describedby="plus-paywall-message"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm glass-panel rounded-3xl p-6 space-y-5 border-white/10 shadow-2xl"
      >
        <div className="space-y-2 text-center">
          <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">
            {isUnavailable ? 'cloud_off' : 'diamond'}
          </span>
          <h2 id="plus-paywall-title" className="text-lg font-bold text-on-surface">
            {isUnavailable ? "Can't verify your subscription" : 'This is a WakeWise Plus session'}
          </h2>
          <p id="plus-paywall-message" className="text-sm text-on-surface-variant leading-relaxed">
            {isUnavailable
              ? "We couldn't confirm your subscription status right now — check your connection and try again."
              : 'Upgrade to WakeWise Plus to unlock this session, or choose a free session instead.'}
          </p>
        </div>

        <div className="space-y-3">
          {isUnavailable ? (
            <button
              ref={primaryButtonRef}
              onClick={onRetry}
              className="w-full py-3.5 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              Try Again
            </button>
          ) : (
            <button
              ref={primaryButtonRef}
              onClick={onViewPlus}
              className="w-full py-3.5 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              View Plus Options
            </button>
          )}
          <button
            onClick={onDismiss}
            className="w-full min-h-[44px] flex items-center justify-center text-center text-xs text-on-surface-variant font-semibold hover:text-on-surface transition-colors"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
};
