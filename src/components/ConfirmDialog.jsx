import { useEffect, useRef } from 'react';

/*
 * Settings & Profile Polish, Sprint 1 — ConfirmDialog
 *
 * Generic centered dialog, reused by every confirmation/placeholder
 * surface this batch needs (Sign out, Delete account, Edit profile,
 * Notification preferences) rather than each screen inventing its own —
 * no dialog/modal component existed anywhere in the codebase before this.
 *
 * Two modes, chosen by whether `onConfirm` is passed:
 *   - Confirm/cancel (Sign out): two buttons, Cancel and confirmLabel.
 *   - Acknowledge-only (Delete account / Edit profile placeholders):
 *     omit onConfirm entirely and only `onDismiss` renders — a single
 *     button, since there is nothing to confirm, only to close.
 *
 * Accessibility: role="dialog"/aria-modal, focus moves to the primary
 * button on open and returns to whatever triggered it on close, Escape
 * and a backdrop click both dismiss (treated the same as Cancel).
 */
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onDismiss,
  destructive = false
}) => {
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
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-message' : undefined}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm glass-panel rounded-3xl p-6 space-y-5 border-white/10 shadow-2xl"
      >
        <div className="space-y-2 text-center">
          <h2 id="confirm-dialog-title" className="text-lg font-bold text-on-surface">
            {title}
          </h2>
          {message && (
            <p id="confirm-dialog-message" className="text-sm text-on-surface-variant leading-relaxed">
              {message}
            </p>
          )}
        </div>

        {onConfirm ? (
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-3.5 glass-panel text-on-surface rounded-full font-bold border-white/10 hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              {cancelLabel}
            </button>
            <button
              ref={primaryButtonRef}
              onClick={onConfirm}
              className={`flex-1 py-3.5 rounded-full font-bold active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                destructive
                  ? 'bg-red-500/90 text-white hover:opacity-90 focus-visible:ring-red-400'
                  : 'bg-primary text-on-primary hover:opacity-90 focus-visible:ring-primary'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        ) : (
          <button
            ref={primaryButtonRef}
            onClick={onDismiss}
            className="w-full py-3.5 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
};
