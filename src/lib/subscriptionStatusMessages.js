// Subscription status messaging — kept separate from Subscription.jsx (a
// React component; this project's Vitest runs in a plain Node
// environment with no DOM/component-rendering setup — see
// vite.config.js) so the actual message-selection logic is directly
// unit-testable, matching this codebase's established pattern of pulling
// pure decision logic out of components/Edge Functions (entitlements.js,
// supabase/functions/_shared/planMapping.ts) rather than testing it only
// through rendered UI.

// The one place subscription dates are formatted for display — used by
// both the renewal-date row and the scheduled-cancellation messaging
// below, so the two can never show the date in different formats.
export const formatExpiryDate = (expiresAt) => {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Status explanations shown under the status row — what each state
// actually means and, where relevant, what to do about it. A failed
// renewal payment is not a distinct stored status here (see
// supabase/functions/_shared/planMapping.ts's mapStripeStatus — Stripe's
// own "past_due" is deliberately folded into "active" as a short grace
// period, and "unpaid"/"incomplete" fold into "expired"), so payment
// failures surface to the user as one of these two existing states
// rather than a dedicated "payment failed" screen.
const STATUS_EXPLANATIONS = {
  trial: 'Your free trial is active. You will not be charged until it ends unless you cancel first.',
  active: "Your subscription is active and will renew automatically unless you cancel. If a recent payment failed, we're still retrying it — you keep access in the meantime.",
  cancelled: 'Your subscription is cancelled. Depending on your billing provider, you may keep access until the end of your current paid period.',
  expired: 'Your subscription has ended, including after repeated failed payments. Subscribe again any time to restore Plus access.'
};

// DEV Subscription-page cancellation messaging fix — a trial/active
// subscription with cancel_at_period_end=true previously showed the same
// generic message as a normal, still-auto-renewing subscription, giving
// no indication a cancellation was already scheduled. Only 'trial' and
// 'active' get a distinct message here: those are the only two statuses
// that still grant access (see entitlements.js's ACTIVE_STATUSES) and so
// the only two where "you still have access, but it's ending" is new
// information — 'cancelled'/'expired' already describe a lapsed/ending
// subscription on their own and are deliberately left untouched, falling
// through to STATUS_EXPLANATIONS unchanged. Never removes or alters
// access itself — this only changes displayed text; isSubscribed() is
// the sole source of truth for entitlement and is not touched here.
// Falls back to the normal status message whenever no expiry date is
// available, rather than ever rendering a broken "scheduled to cancel on
// [nothing]" sentence — the exact date is never hardcoded.
export const getStatusExplanation = (subscription) => {
  const status = subscription?.status;
  const expiryDate = formatExpiryDate(subscription?.expires_at);

  if (status === 'trial' && subscription?.cancel_at_period_end && expiryDate) {
    return `Your free trial is active until ${expiryDate}. Your subscription is scheduled to cancel on that date, and you will not be charged.`;
  }

  if (status === 'active' && subscription?.cancel_at_period_end && expiryDate) {
    return `Your subscription is scheduled to cancel on ${expiryDate}. You will retain WakeWise Plus access until then.`;
  }

  return STATUS_EXPLANATIONS[status];
};
