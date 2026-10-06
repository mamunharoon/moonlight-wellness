// WakeWise — native purchase integration: shared RevenueCat identity
// readiness status.
//
// useRevenueCatIdentity.js already tracks (in a private ref, invisible
// outside that hook) which Supabase user id RevenueCat is currently
// logged in as. That was enough while nothing read it back - but
// Subscription.jsx and useNativeRestore.js (Profile.jsx's restore) both
// now need to answer "is it actually safe to purchase/restore right now,
// for THIS signed-in user" before calling any RevenueCat adapter
// function - a purchase/restore attempted while RevenueCat is still
// mid-configure/logIn, still holding a PREVIOUS user's identity (an
// account switch in flight), or has failed to establish an identity at
// all must never be allowed through.
//
// A plain external store (subscribe/getSnapshot via useSyncExternalStore),
// not a new React Context - matches this app's own established pattern
// for cross-tree state that isn't naturally owned by a single provider
// (see signOutCleanup.js's window-event broadcast for the same
// reasoning), and avoids wrapping App.jsx in a new Provider for this.
import { useSyncExternalStore } from 'react';

export const REVENUECAT_IDENTITY_STATUS = Object.freeze({
  // RevenueCat does not apply on this platform/build at all (web, or no
  // public SDK key configured) - purchase/restore call sites should NOT
  // block on this status; the adapter's own isRevenueCatSupported()
  // guards already make every real function safely no-op in this case.
  UNAVAILABLE: 'unavailable',
  // No user is signed in yet, OR configure()/logIn() for the current
  // user is in flight (including an account switch: the previous
  // identity is being logged out before the new one logs in) - never
  // safe to purchase/restore.
  PENDING: 'pending',
  // RevenueCat is confirmed logged in as forUserId - safe to purchase/
  // restore ONLY if forUserId matches the caller's own current user id;
  // a mismatch means a switch is in flight that this snapshot hasn't
  // caught up to yet, which isRevenueCatIdentityReadyFor below treats as
  // not ready, not as "ready for someone else."
  READY: 'ready',
  // configure()/logIn() itself failed for the current user (e.g. a real
  // SDK/network error) - never safe to purchase/restore until a retry
  // (a future sign-in-state change) succeeds.
  FAILED: 'failed'
});

let currentStatus = { status: REVENUECAT_IDENTITY_STATUS.PENDING, forUserId: null };
const listeners = new Set();

/** Called only by useRevenueCatIdentity.js - the one place this ever changes. */
export const setRevenueCatIdentityStatus = (next) => {
  currentStatus = next;
  listeners.forEach((listener) => listener());
};

export const getRevenueCatIdentityStatus = () => currentStatus;

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * @returns {{status: 'unavailable'|'pending'|'ready'|'failed', forUserId: string|null}}
 */
export const useRevenueCatIdentityStatus = () => useSyncExternalStore(subscribe, getRevenueCatIdentityStatus);

/**
 * The one question every purchase/restore call site actually needs
 * answered: is it safe to act right now, for this exact signed-in user id?
 * UNAVAILABLE also means "safe to proceed" - there is nothing to be ready
 * FOR on this platform/build; the adapter's own no-ops take over from
 * there. A null/undefined userId (guest, or not yet loaded) can never be
 * considered ready - callers gate guests out earlier anyway, but this
 * stays correct even if called before that gate.
 */
export const isRevenueCatIdentityReadyFor = (status, userId) =>
  status.status === REVENUECAT_IDENTITY_STATUS.UNAVAILABLE ||
  (status.status === REVENUECAT_IDENTITY_STATUS.READY && Boolean(userId) && status.forUserId === userId);
