/**
 * The single decision for whether /reset-password should accept a new
 * password submission. Pulled out of ResetPassword.jsx's effect so this
 * exact security invariant is independently unit-testable:
 *
 * - A genuine Supabase PASSWORD_RECOVERY event is always sufficient,
 *   whether it was caught live just now (`recoveryEventFired`) or caught
 *   earlier by passwordRecoveryLatch.js's own always-subscribed-first
 *   listener (`latchedEarlier`) — both are the exact same event type,
 *   just observed at different times; see that module's own header for
 *   why a live subscriber can miss it.
 * - Otherwise, only a native recovery link that useNativeDeepLinks.js /
 *   nativeAuthRecovery.js already verified end-to-end (recoveryVerified)
 *   AND an actually-established session together are sufficient — the
 *   flag alone is never trusted.
 * - A direct visit, an ordinary signed-in session, or a guest/anonymous
 *   session must never satisfy this on their own — and never could,
 *   since nothing but a genuine PASSWORD_RECOVERY event can ever set
 *   `latchedEarlier` either.
 */
export const shouldTreatAsValidRecovery = ({ recoveryEventFired, nativeRecoveryVerified, hasSession, latchedEarlier }) => {
  if (recoveryEventFired) return true;
  if (latchedEarlier) return true;
  return Boolean(nativeRecoveryVerified) && Boolean(hasSession);
};
