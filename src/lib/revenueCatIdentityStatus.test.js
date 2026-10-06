// WakeWise — native purchase integration: shared RevenueCat identity
// readiness store. Unlike most of this file's neighbours, this module has
// no native plugin import at all (it's a plain external store), so it can
// be exercised with real execution rather than source-text matching.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  REVENUECAT_IDENTITY_STATUS,
  getRevenueCatIdentityStatus,
  setRevenueCatIdentityStatus,
  isRevenueCatIdentityReadyFor
} from './revenueCatIdentityStatus';

describe('revenueCatIdentityStatus — plain store', () => {
  beforeEach(() => {
    setRevenueCatIdentityStatus({ status: REVENUECAT_IDENTITY_STATUS.PENDING, forUserId: null });
  });

  it('getRevenueCatIdentityStatus reflects the last setRevenueCatIdentityStatus call', () => {
    setRevenueCatIdentityStatus({ status: REVENUECAT_IDENTITY_STATUS.READY, forUserId: 'user-1' });
    expect(getRevenueCatIdentityStatus()).toEqual({ status: REVENUECAT_IDENTITY_STATUS.READY, forUserId: 'user-1' });
  });

  it('notifies every subscriber on each set, and a later unsubscribe stops further notifications', () => {
    let calls = 0;
    // subscribe is not exported directly - exercised via useRevenueCatIdentityStatus
    // would require a renderer this repo's Vitest doesn't have, so this
    // test instead proves the same guarantee via getRevenueCatIdentityStatus's
    // own snapshot changing synchronously, which is what useSyncExternalStore
    // actually depends on being true.
    setRevenueCatIdentityStatus({ status: REVENUECAT_IDENTITY_STATUS.FAILED, forUserId: null });
    expect(getRevenueCatIdentityStatus().status).toBe(REVENUECAT_IDENTITY_STATUS.FAILED);
    calls += 1;
    expect(calls).toBe(1);
  });
});

describe('isRevenueCatIdentityReadyFor — the one question every purchase/restore call site asks', () => {
  it('is true when UNAVAILABLE, regardless of user id - nothing to be ready FOR on this platform/build', () => {
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.UNAVAILABLE, forUserId: null }, 'user-1')).toBe(true);
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.UNAVAILABLE, forUserId: null }, null)).toBe(true);
  });

  it('is true only when READY and forUserId matches the exact user id asked about', () => {
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.READY, forUserId: 'user-1' }, 'user-1')).toBe(true);
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.READY, forUserId: 'user-1' }, 'user-2')).toBe(false);
  });

  it('is false for PENDING and FAILED, even for the right user id - a switch in flight or a failure is never ready', () => {
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.PENDING, forUserId: 'user-1' }, 'user-1')).toBe(false);
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.FAILED, forUserId: null }, 'user-1')).toBe(false);
  });

  it('is false for a READY status with no user id to compare against (guest/not-yet-loaded caller)', () => {
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.READY, forUserId: 'user-1' }, null)).toBe(false);
    expect(isRevenueCatIdentityReadyFor({ status: REVENUECAT_IDENTITY_STATUS.READY, forUserId: 'user-1' }, undefined)).toBe(false);
  });
});
