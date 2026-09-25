import { useEffect, useRef } from 'react';

/*
 * Guest access repair — SignInPromptDialog
 *
 * Shown the instant a guest taps ANY locked exercise/sleep-sound row,
 * anywhere in the app (Library, Support's "Need a moment?" flow,
 * Prepare for Rest's Sleep Sounds, every contextual exercise row) —
 * replacing the previous silent no-op (Library) or a plain inline
 * "Sign in to play" link (Support) with one consistent, always-visible
 * response. Never a blank/frozen state: every tap on locked content
 * results in this dialog, immediately.
 *
 * Same visual language and a11y pattern as ConfirmDialog.jsx (this
 * app's one existing dialog component) — backdrop, glass-panel surface,
 * focus-trap-to-primary-button, Escape/backdrop dismiss — but with three
 * actions instead of ConfirmDialog's two, so it isn't built on top of
 * that component rather than duplicating its shape with a prop that
 * doesn't fit.
 */
export const SignInPromptDialog = ({ open, onSignIn, onCreateAccount, onDismiss }) => {
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
        aria-labelledby="sign-in-prompt-title"
        aria-describedby="sign-in-prompt-message"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm glass-panel rounded-3xl p-6 space-y-5 border-white/10 shadow-2xl"
      >
        <div className="space-y-2 text-center">
          <h2 id="sign-in-prompt-title" className="text-lg font-bold text-on-surface">
            Sign in to continue
          </h2>
          <p id="sign-in-prompt-message" className="text-sm text-on-surface-variant leading-relaxed">
            Create a free account or sign in to play this session and save your WakeWise progress.
          </p>
        </div>

        <div className="space-y-3">
          <button
            ref={primaryButtonRef}
            onClick={onSignIn}
            className="w-full py-3.5 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Sign In
          </button>
          <button
            onClick={onCreateAccount}
            className="w-full py-3.5 glass-panel text-on-surface rounded-full font-bold border-white/10 hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            Create Free Account
          </button>
          {/* Viewport audit follow-up — touch-target correction: measured
              32px tall (py-2 alone), below the 44px minimum. This is a
              shared dialog (Library, Support, Anytime gate, every
              locked-content row), so the fix applies everywhere at once. */}
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
