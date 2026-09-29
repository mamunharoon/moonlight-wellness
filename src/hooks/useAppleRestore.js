// WakeWise Phase 2A — shared Restore Purchases behaviour.
//
// Extracted so a second UI surface (Profile.jsx's Membership row) can
// offer Restore Purchases without re-implementing the security-sensitive
// part of Subscription.jsx's existing flow: a restored transaction is
// NEVER trusted on its own — it only ever reaches
// applePurchaseAdapter.js's own StoreKit transaction-update listener,
// which this hook forwards to the same server verification
// (verify-apple-transaction) Subscription.jsx already used, then re-reads
// real entitlement state via refreshSubscription(). This hook never
// writes plan/status itself.
//
// Correction (Phase 2A review) — this file previously inferred that no
// eligible purchase existed from a fixed 4-second timeout with no
// transaction event. That was withdrawn: a timeout cannot truthfully
// distinguish "no purchase exists" from "StoreKit/network/server
// verification is just slow" — the same purchase could legitimately
// arrive a few seconds late. There is now no such inference. The only
// three states this hook can
// honestly report are: restoring (the operation is in flight); restored
// (a transaction arrived, verified server-side, AND the freshly-refreshed
// subscription record itself shows active Plus access — not merely "a
// transaction was seen"); and failed (the native restore call itself
// failed). Anything else — the native call succeeded but no transaction
// has (yet) been confirmed restored — surfaces as a neutral completion
// message that promises nothing it can't back up.
//
// Subscription.jsx's own restore button is left as its separate,
// still-correct implementation for this phase (not yet migrated onto this
// hook) — see the Phase 2A report for why that consolidation was left for
// a follow-up rather than risked here.
import { useEffect, useState } from 'react';
import {
  isAppleIAPSupported,
  restoreApplePurchases,
  addAppleTransactionUpdateListener
} from '../lib/applePurchaseAdapter';
import { verifyAppleTransaction } from '../lib/appleVerificationApi';
import { useSubscription } from '../context/SubscriptionContext';
import { isSubscribed } from '../lib/entitlements';

export const NEUTRAL_RESTORE_COMPLETION_MESSAGE =
  'Restore request completed. If you have an eligible purchase, your membership will update shortly.';

export const useAppleRestore = () => {
  const { refreshSubscription } = useSubscription();
  const [state, setState] = useState('idle'); // idle | restoring | restored | completed | failed
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAppleIAPSupported()) return undefined;

    const removeListener = addAppleTransactionUpdateListener(async (result) => {
      if (result.outcome !== 'purchased') return;

      try {
        await verifyAppleTransaction({
          transactionId: result.transactionId,
          productIdentifier: result.productIdentifier,
          jwsRepresentation: result.jwsRepresentation
        });
      } catch (e) {
        console.warn('[useAppleRestore] verification call failed', e?.message);
      }

      // Whether or not verification above confirmed anything, the only
      // source of truth for access is a fresh read of real subscription
      // state — never this listener's own outcome, and never assumed from
      // the mere presence of a transaction event.
      const refreshed = await refreshSubscription();
      if (isSubscribed(refreshed?.plan, refreshed?.status)) {
        // Functional update: a slow verification here must never
        // downgrade a 'restored' the restore() call below may have
        // already produced from a different transaction, and must never
        // race restore()'s own 'completed' write the other way either -
        // 'restored' is always the most confident state and always wins.
        setState('restored');
      }
      // If the refresh does NOT show active Plus access, this deliberately
      // sets nothing — leaving whatever restore() already reported
      // ('completed', the honest neutral state) rather than fabricating a
      // failure or a "nothing to restore" this hook cannot truthfully know.
    });

    return removeListener;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restore = async () => {
    if (!isAppleIAPSupported() || state === 'restoring') return; // duplicate-tap guard
    setError(null);
    setState('restoring');

    const result = await restoreApplePurchases();
    if (result.outcome !== 'restored') {
      setState('failed');
      setError(result.message || "We couldn't restore purchases. Please try again.");
      return;
    }

    // The native "ask StoreKit to restore" call itself succeeded - that is
    // NOT the same as confirming an eligible purchase exists. Whether it
    // does is decided asynchronously by the transaction-update listener
    // above (verified server-side, then a fresh entitlement read), which
    // may resolve before or after this line. The functional update form
    // reads the LATEST state rather than a stale closure, so a 'restored'
    // the listener already produced is never downgraded back to the
    // neutral message by this call finishing late.
    setState((current) => (current === 'restored' ? current : 'completed'));
  };

  return { state, error, restore, supported: isAppleIAPSupported() };
};
