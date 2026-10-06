// WakeWise — native purchase integration: shared, platform-aware
// (iOS + Android, via RevenueCat) restore hook.
//
// Consolidates Profile.jsx's and Subscription.jsx's restore actions
// through the SAME flow (readiness-gap item 1). Before this: Profile.jsx
// used useAppleRestore.js (iOS-only, the legacy direct-Apple adapter)
// while Subscription.jsx had its own separate, RevenueCat-based inline
// implementation, and Android had no restore action anywhere. This hook
// replaces both call sites; useAppleRestore.js itself is left on disk,
// unused, rather than deleted (see Subscription.jsx's own discipline
// around not removing the legacy Apple path outright) and remains
// available if a reason to fall back to it ever surfaces.
//
// Mirrors useAppleRestore.js's own documented discipline for exactly the
// same reason it was written there: a restored transaction is NEVER
// trusted on its own. Only a fresh, real entitlement read
// (refreshEntitlement() — the provider_subscriptions-aware, unified read;
// never refreshSubscription(), the legacy Stripe-only table a RevenueCat
// restore never writes to) can confirm access. The honest states this
// hook reports: restoring (in flight); restored (confirmed, via a real
// read showing access); and 'completed', the neutral state for "the
// native call succeeded but we can't (yet, or within our bounded wait)
// confirm it actually found something" — never upgraded to a false
// 'restored' and never downgraded to a false "nothing to restore". A
// fixed delay is used here only to BOUND a retry loop for UI purposes,
// never to INFER failure — that inference was explicitly withdrawn from
// useAppleRestore.js and must never return in any form.
//
// Identity-safety (readiness-gap items 3 and 5):
//   - restore() refuses to call the SDK at all unless RevenueCat's own
//     identity is confirmed READY for the CURRENT signed-in user —
//     attempting it mid-account-switch (or before the very first
//     configure()/logIn() completes) could resolve against the wrong
//     identity, or no identity at all.
//   - Every async continuation (the native call itself, the bounded
//     confirmation poll, the CustomerInfo listener) checks the user id
//     it was started for against the CURRENT signed-in user id before
//     applying ANY result — so a late callback from a previous account
//     can never write a result into a now-different signed-in user's
//     state, and never leaves a stale restore status visible to the next
//     signed-in user on a shared device.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { isNativePlatform, isIOS, isAndroid } from '../lib/platform';
import { restoreRevenueCatPurchases, addRevenueCatCustomerInfoListener } from '../lib/revenueCatAdapter';
import { useRevenueCatIdentityStatus, isRevenueCatIdentityReadyFor } from '../lib/revenueCatIdentityStatus';

export const NEUTRAL_RESTORE_COMPLETION_MESSAGE =
  'Restore request completed. If you have an eligible purchase, your membership will update shortly.';

export const IDENTITY_NOT_READY_MESSAGE = 'Still preparing your account. Please try again in a moment.';

// Bounded retry window for the delayed revenuecat-webhook confirmation —
// 5 attempts, 4s apart (~20s total), long enough to cover a typical
// webhook round-trip without leaving the user staring at a spinner
// indefinitely. Exported so tests (and, if ever needed, a caller wanting
// to show "about N seconds left") can reference the same real numbers
// rather than a second, independently-drifting copy.
export const CONFIRMATION_MAX_ATTEMPTS = 5;
export const CONFIRMATION_RETRY_DELAY_MS = 4000;

export const useNativeRestore = () => {
  // Guest-gating happens at the call site (Profile.jsx's handleRestoreTap)
  // exactly like Subscription.jsx's own purchase handlers - this hook
  // only needs `user` for identity-readiness and account-switch safety.
  const { user } = useAuth();
  const { refreshEntitlement } = useSubscription();
  const identityStatus = useRevenueCatIdentityStatus();
  // idle | restoring | restored | completed | failed | identity_not_ready
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  const supported = isNativePlatform() && (isIOS() || isAndroid());

  // The user id THIS restore attempt (and its bounded poll/listener
  // reaction) was started for — checked before applying any async
  // result, never assumed to still be the current signed-in user.
  const startedForUserIdRef = useRef(null);

  useEffect(() => {
    if (!supported) return undefined;

    // The real completion signal for anything RevenueCat observes
    // out-of-band (a restore, a renewal, a founder redemption triggered
    // from Subscription.jsx) — only acted on here if it's for the
    // account THIS hook's own restore() call was started for; a listener
    // fire with no in-flight restore from this hook (startedForUserIdRef
    // null) is correctly ignored here — Subscription.jsx's own listener
    // instance is what reacts to purchase-originated events.
    const removeListener = addRevenueCatCustomerInfoListener(() => {
      if (startedForUserIdRef.current && startedForUserIdRef.current === user?.id) {
        refreshEntitlement();
      }
    });
    return removeListener;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  // Account-switch safety: if the signed-in user changes while a restore
  // from a PREVIOUS user is still being tracked, forget it entirely —
  // never let its bounded poll or a late listener callback touch the new
  // user's state, and never show the previous user's restore status to
  // whoever is signed in now.
  useEffect(() => {
    if (startedForUserIdRef.current && startedForUserIdRef.current !== (user?.id ?? null)) {
      startedForUserIdRef.current = null;
      setState('idle');
      setError(null);
    }
  }, [user?.id]);

  const restore = async () => {
    if (!supported || state === 'restoring') return; // duplicate-tap guard
    if (!isRevenueCatIdentityReadyFor(identityStatus, user?.id)) {
      setState('identity_not_ready');
      setError(IDENTITY_NOT_READY_MESSAGE);
      return;
    }

    setError(null);
    setState('restoring');
    const forUserId = user?.id ?? null;
    startedForUserIdRef.current = forUserId;

    const result = await restoreRevenueCatPurchases();
    // The signed-in user may have changed WHILE the native call was in
    // flight — never apply its result to a now-different account.
    if (startedForUserIdRef.current !== forUserId) return;

    if (result.outcome === 'receipt_already_in_use') {
      setState('failed');
      setError('That purchase is already linked to a different account.');
      return;
    }
    if (result.outcome !== 'restored') {
      setState('failed');
      setError(result.message || "We couldn't restore purchases. Please try again.");
      return;
    }

    // The native "ask the store to restore" call succeeded — that is NOT
    // the same as confirming an eligible purchase exists; whether it does
    // is decided by a BOUNDED number of real entitlement re-reads below,
    // never a single fixed delay used to infer an answer either way.
    for (let attempt = 0; attempt < CONFIRMATION_MAX_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_RETRY_DELAY_MS));
      if (startedForUserIdRef.current !== forUserId) return;
      const refreshed = await refreshEntitlement();
      if (startedForUserIdRef.current !== forUserId) return;
      if (refreshed?.isEntitled) {
        setState('restored');
        return;
      }
    }
    if (startedForUserIdRef.current === forUserId) {
      // Functional update: a slow confirmation must never downgrade a
      // 'restored' the listener above may have already produced from a
      // different event arriving mid-poll.
      setState((current) => (current === 'restored' ? current : 'completed'));
    }
  };

  return { state, error, restore, supported };
};
