/**
 * The single decision for whether /reset-password should accept a new
 * password submission. Pulled out of ResetPassword.jsx's effect so this
 * exact security invariant is independently unit-testable:
 *
 * - A genuine Supabase PASSWORD_RECOVERY event is always sufficient (the
 *   existing, unmodified web behaviour).
 * - Otherwise, only a native recovery link that useNativeDeepLinks.js /
 *   nativeAuthRecovery.js already verified end-to-end (recoveryVerified)
 *   AND an actually-established session together are sufficient — the
 *   flag alone is never trusted.
 * - A direct visit, an ordinary signed-in session, or a guest/anonymous
 *   session must never satisfy this on their own.
 */
export const shouldTreatAsValidRecovery = ({ recoveryEventFired, nativeRecoveryVerified, hasSession }) => {
  if (recoveryEventFired) return true;
  return Boolean(nativeRecoveryVerified) && Boolean(hasSession);
};
