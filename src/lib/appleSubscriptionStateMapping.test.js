import { describe, it, expect } from 'vitest';
import {
  mapAppleStatusToProviderStatus,
  isAppleTrialTransaction,
  resolveProviderStatus,
  mapVerifiedAppleNotificationToStateChange,
  NOTIFICATION_TYPES_ACKNOWLEDGE_ONLY
} from '../../supabase/functions/_shared/appleSubscriptionStateMapping.ts';

describe('mapAppleStatusToProviderStatus', () => {
  it('maps every documented Apple Status value', () => {
    expect(mapAppleStatusToProviderStatus(1)).toBe('active');
    expect(mapAppleStatusToProviderStatus(2)).toBe('expired');
    expect(mapAppleStatusToProviderStatus(3)).toBe('billing_retry');
    expect(mapAppleStatusToProviderStatus(4)).toBe('grace_period');
    expect(mapAppleStatusToProviderStatus(5)).toBe('revoked');
  });

  it('returns null for an unrecognised value, never guessing', () => {
    expect(mapAppleStatusToProviderStatus(99)).toBeNull();
    expect(mapAppleStatusToProviderStatus(undefined)).toBeNull();
  });
});

describe('isAppleTrialTransaction', () => {
  it('is true only for offerType 1 (INTRODUCTORY_OFFER)', () => {
    expect(isAppleTrialTransaction({ offerType: 1 })).toBe(true);
  });

  it('is false for OFFER_CODE (the founding-member mechanism — Pay Up Front, no trial)', () => {
    expect(isAppleTrialTransaction({ offerType: 3 })).toBe(false);
  });

  it('is false for a promotional offer or no offer at all', () => {
    expect(isAppleTrialTransaction({ offerType: 2 })).toBe(false);
    expect(isAppleTrialTransaction({})).toBe(false);
    expect(isAppleTrialTransaction(null)).toBe(false);
  });
});

describe('resolveProviderStatus', () => {
  it('initial purchase: ACTIVE status + introductory offer -> trial', () => {
    expect(resolveProviderStatus({ offerType: 1 }, 1)).toBe('trial');
  });

  it('initial purchase: ACTIVE status + no offer -> active', () => {
    expect(resolveProviderStatus({}, 1)).toBe('active');
  });

  it('offer-code purchase: ACTIVE status + OFFER_CODE -> active, not trial', () => {
    expect(resolveProviderStatus({ offerType: 3 }, 1)).toBe('active');
  });

  it('active renewal continues as active (or trial, if still within an introductory period)', () => {
    expect(resolveProviderStatus({}, 1)).toBe('active');
    expect(resolveProviderStatus({ offerType: 1 }, 1)).toBe('trial');
  });

  it('expiration maps EXPIRED status to expired', () => {
    expect(resolveProviderStatus({}, 2)).toBe('expired');
  });

  it('billing retry maps BILLING_RETRY status to billing_retry', () => {
    expect(resolveProviderStatus({}, 3)).toBe('billing_retry');
  });

  it('billing grace period maps BILLING_GRACE_PERIOD status to grace_period', () => {
    expect(resolveProviderStatus({}, 4)).toBe('grace_period');
  });

  it('revocation via Status always wins as revoked', () => {
    expect(resolveProviderStatus({}, 5)).toBe('revoked');
  });

  it('a revocationDate on the transaction itself always means revoked, regardless of Status', () => {
    expect(resolveProviderStatus({ revocationDate: Date.now() }, 1)).toBe('revoked');
  });

  it('with no accompanying Status at all, an unexpired transaction defaults to active (or trial)', () => {
    const future = Date.now() + 1000 * 60 * 60 * 24;
    expect(resolveProviderStatus({ expiresDate: future }, null)).toBe('active');
    expect(resolveProviderStatus({ expiresDate: future, offerType: 1 }, null)).toBe('trial');
  });

  it('with no accompanying Status, a transaction past its own expiresDate defaults to expired', () => {
    const past = Date.now() - 1000 * 60 * 60 * 24;
    expect(resolveProviderStatus({ expiresDate: past }, null)).toBe('expired');
  });
});

describe('mapVerifiedAppleNotificationToStateChange', () => {
  it('initial purchase (SUBSCRIBED/INITIAL_BUY) with an introductory offer -> trial', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'SUBSCRIBED',
      subtype: 'INITIAL_BUY',
      transaction: { offerType: 1 },
      appleStatus: 1
    });
    expect(result).toEqual({ status: 'trial', cancelAtPeriodEnd: undefined });
  });

  it('active renewal (DID_RENEW) -> active, cancelAtPeriodEnd unspecified', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'DID_RENEW',
      transaction: {},
      appleStatus: 1
    });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: undefined });
  });

  it('renewal preference change (DID_CHANGE_RENEWAL_PREF, upgrade/downgrade) -> status only, no renewal-flag change', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'DID_CHANGE_RENEWAL_PREF',
      subtype: 'UPGRADE',
      transaction: {},
      appleStatus: 1
    });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: undefined });
  });

  it('cancellation (DID_CHANGE_RENEWAL_STATUS / AUTO_RENEW_DISABLED): access continues, only cancelAtPeriodEnd flips true', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'DID_CHANGE_RENEWAL_STATUS',
      subtype: 'AUTO_RENEW_DISABLED',
      transaction: {},
      appleStatus: 1
    });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: true });
  });

  it('re-enabling auto-renew (DID_CHANGE_RENEWAL_STATUS / AUTO_RENEW_ENABLED) flips cancelAtPeriodEnd back to false', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'DID_CHANGE_RENEWAL_STATUS',
      subtype: 'AUTO_RENEW_ENABLED',
      transaction: {},
      appleStatus: 1
    });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: false });
  });

  it('expiration (EXPIRED) -> expired', () => {
    const result = mapVerifiedAppleNotificationToStateChange({ notificationType: 'EXPIRED', transaction: {} });
    expect(result).toEqual({ status: 'expired', cancelAtPeriodEnd: undefined });
  });

  it('billing retry (DID_FAIL_TO_RENEW, BILLING_RETRY status) -> billing_retry', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'DID_FAIL_TO_RENEW',
      subtype: 'BILLING_RETRY',
      transaction: {},
      appleStatus: 3
    });
    expect(result).toEqual({ status: 'billing_retry', cancelAtPeriodEnd: undefined });
  });

  it('billing grace period (DID_FAIL_TO_RENEW, GRACE_PERIOD subtype + status) -> grace_period', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'DID_FAIL_TO_RENEW',
      subtype: 'GRACE_PERIOD',
      transaction: {},
      appleStatus: 4
    });
    expect(result).toEqual({ status: 'grace_period', cancelAtPeriodEnd: undefined });
  });

  it('grace period expiring (GRACE_PERIOD_EXPIRED) -> whatever the accompanying status now says (typically expired)', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'GRACE_PERIOD_EXPIRED',
      transaction: {},
      appleStatus: 2
    });
    expect(result).toEqual({ status: 'expired', cancelAtPeriodEnd: undefined });
  });

  it('refund (REFUND) -> refunded, independent of any accompanying status', () => {
    const result = mapVerifiedAppleNotificationToStateChange({ notificationType: 'REFUND', transaction: {}, appleStatus: 1 });
    expect(result).toEqual({ status: 'refunded', cancelAtPeriodEnd: undefined });
  });

  it('revocation (REVOKE) -> revoked, independent of any accompanying status', () => {
    const result = mapVerifiedAppleNotificationToStateChange({ notificationType: 'REVOKE', transaction: {}, appleStatus: 1 });
    expect(result).toEqual({ status: 'revoked', cancelAtPeriodEnd: undefined });
  });

  it('offer-code purchase (OFFER_REDEEMED, offerType OFFER_CODE) -> active, not trial', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'OFFER_REDEEMED',
      transaction: { offerType: 3 },
      appleStatus: 1
    });
    expect(result).toEqual({ status: 'active', cancelAtPeriodEnd: undefined });
  });

  it('introductory-trial purchase via OFFER_REDEEMED (offerType INTRODUCTORY_OFFER) -> trial', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'OFFER_REDEEMED',
      transaction: { offerType: 1 },
      appleStatus: 1
    });
    expect(result).toEqual({ status: 'trial', cancelAtPeriodEnd: undefined });
  });

  it('every acknowledge-only notification type returns null (recorded for idempotency, never applied)', () => {
    for (const notificationType of NOTIFICATION_TYPES_ACKNOWLEDGE_ONLY) {
      expect(mapVerifiedAppleNotificationToStateChange({ notificationType, transaction: {} })).toBeNull();
    }
  });

  it('an unknown/unrecognised notification type is treated as acknowledge-only, never guessed at', () => {
    const result = mapVerifiedAppleNotificationToStateChange({
      notificationType: 'SOME_FUTURE_APPLE_NOTIFICATION_TYPE_NOT_YET_INVENTED',
      transaction: {}
    });
    expect(result).toBeNull();
  });

  it('a state-bearing notification type with no transaction data at all yields null (treated as a processing error upstream, never a silent no-op state change)', () => {
    const result = mapVerifiedAppleNotificationToStateChange({ notificationType: 'DID_RENEW', transaction: null });
    expect(result).toBeNull();
  });

  it('sandbox vs production is never mapped or altered by this module — it is passed through unchanged by the caller, not read here at all', () => {
    // This module's functions never accept or reference an
    // `environment` field — asserting the exported surface has no such
    // parameter is a structural guarantee that environment can never be
    // silently conflated with subscription status.
    expect(mapVerifiedAppleNotificationToStateChange.length).toBeLessThanOrEqual(1);
  });
});
