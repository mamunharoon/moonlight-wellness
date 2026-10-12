import { describe, it, expect } from 'vitest';
import { formatExpiryDate, getStatusExplanation } from './subscriptionStatusMessages';

describe('formatExpiryDate', () => {
  it('formats an ISO date string using the app-wide long-date convention', () => {
    expect(formatExpiryDate('2026-09-25T12:00:00Z')).toBe('September 25, 2026');
  });

  it('returns null for a missing/empty expiry date, never a broken string', () => {
    expect(formatExpiryDate(null)).toBeNull();
    expect(formatExpiryDate(undefined)).toBeNull();
    expect(formatExpiryDate('')).toBeNull();
  });
});

describe('getStatusExplanation — DEV cancellation-messaging fix', () => {
  // Wording correction (physical-device finding, iOS build 35): a
  // cancelled-but-still-active subscription previously read "is scheduled
  // to cancel on {date}", which implies the cancellation itself happens
  // LATER. cancel_at_period_end=true means the renewal is ALREADY
  // cancelled now - only access continues until {date}. These three tests
  // replace the old "scheduled to cancel" assertions with the corrected
  // "renewal is cancelled, access continues until {date}" wording.
  it('trial + cancellation scheduled: says the renewal is cancelled (not "scheduled to cancel"), names the actual expiry date, never a hardcoded one', () => {
    const message = getStatusExplanation({
      status: 'trial',
      cancel_at_period_end: true,
      expires_at: '2026-09-25T12:00:00Z'
    });
    expect(message).toBe(
      "Your free trial's renewal is cancelled. You will not be charged, and access continues until September 25, 2026."
    );
    expect(message).not.toMatch(/scheduled to cancel/);
  });

  it('trial + cancellation scheduled uses whatever expires_at actually is, not a fixed date', () => {
    const message = getStatusExplanation({
      status: 'trial',
      cancel_at_period_end: true,
      expires_at: '2027-01-03T12:00:00Z'
    });
    expect(message).toContain('January 3, 2027');
    expect(message).not.toContain('September 25, 2026');
  });

  it('active + cancellation scheduled: says the renewal is cancelled (not "scheduled to cancel") and access continues until the actual expiry date', () => {
    const message = getStatusExplanation({
      status: 'active',
      cancel_at_period_end: true,
      expires_at: '2026-11-08T12:00:00Z'
    });
    expect(message).toBe("Your subscription's renewal is cancelled. Access continues until November 8, 2026.");
    expect(message).not.toMatch(/scheduled to cancel/);
  });

  it('trial without a scheduled cancellation keeps the existing normal trial messaging', () => {
    const message = getStatusExplanation({
      status: 'trial',
      cancel_at_period_end: false,
      expires_at: '2026-09-25T12:00:00Z'
    });
    expect(message).toBe('Your free trial is active. You will not be charged until it ends unless you cancel first.');
  });

  it('active without a scheduled cancellation keeps the existing normal active messaging', () => {
    const message = getStatusExplanation({
      status: 'active',
      cancel_at_period_end: false,
      expires_at: '2026-09-25T12:00:00Z'
    });
    expect(message).toBe(
      "Your subscription is active and will renew automatically unless you cancel. If a recent payment failed, we're still retrying it — you keep access in the meantime."
    );
  });

  it('falls back to the normal status message when cancel_at_period_end is true but no expiry date is available, rather than rendering a broken sentence', () => {
    expect(
      getStatusExplanation({ status: 'trial', cancel_at_period_end: true, expires_at: null })
    ).toBe('Your free trial is active. You will not be charged until it ends unless you cancel first.');

    expect(
      getStatusExplanation({ status: 'active', cancel_at_period_end: true, expires_at: undefined })
    ).toBe(
      "Your subscription is active and will renew automatically unless you cancel. If a recent payment failed, we're still retrying it — you keep access in the meantime."
    );
  });

  it('leaves cancelled/expired messaging completely untouched regardless of cancel_at_period_end', () => {
    expect(
      getStatusExplanation({ status: 'cancelled', cancel_at_period_end: true, expires_at: '2026-09-25T12:00:00Z' })
    ).toBe('Your subscription is cancelled. Depending on your billing provider, you may keep access until the end of your current paid period.');

    expect(getStatusExplanation({ status: 'expired', cancel_at_period_end: false, expires_at: null })).toBe(
      'Your subscription has ended, including after repeated failed payments. Subscribe again any time to restore Plus access.'
    );
  });

  it('returns undefined for an unrecognised status rather than guessing', () => {
    expect(getStatusExplanation({ status: 'some-future-status', cancel_at_period_end: false })).toBeUndefined();
  });
});

// Sandbox accuracy fix (physical-device finding, iOS build 35): the trial
// sentence's unconditional "you will not be charged until it ends unless
// you cancel first" claim is a platform-specific billing fact a sandbox
// build's own build flag cannot prove on every platform (iOS/TestFlight
// sandboxes every purchase unconditionally; Android only avoids a real
// charge for a Play Console License Tester account). The caller (
// Subscription.jsx) supplies the platform-accurate clause; this module
// never asserts one on its own, exactly like trialOfferWording.js's own
// sandboxConfirmationClause parameter.
describe('getStatusExplanation — sandbox-accurate trial charge wording (physical-device finding, iOS build 35)', () => {
  it('with no sandboxChargeClause (default/production), keeps the normal unconditional trial claim unchanged', () => {
    const message = getStatusExplanation({ status: 'trial', cancel_at_period_end: false, expires_at: '2026-09-25T12:00:00Z' });
    expect(message).toBe('Your free trial is active. You will not be charged until it ends unless you cancel first.');
  });

  it('with an iOS sandbox clause, substitutes the caller-supplied platform fact instead of the production claim', () => {
    const message = getStatusExplanation(
      { status: 'trial', cancel_at_period_end: false, expires_at: '2026-09-25T12:00:00Z' },
      'this sandbox build never charges real money'
    );
    expect(message).toBe('Your free trial is active. This sandbox build never charges real money.');
  });

  it('with an Android sandbox clause, never claims an unconditional "will not be charged" the build flag cannot prove', () => {
    const message = getStatusExplanation(
      { status: 'trial', cancel_at_period_end: false, expires_at: '2026-09-25T12:00:00Z' },
      'this sandbox build only avoids a real charge for Play Console License Tester accounts'
    );
    expect(message).toBe(
      'Your free trial is active. This sandbox build only avoids a real charge for Play Console License Tester accounts.'
    );
    expect(message).not.toMatch(/you will not be charged/);
  });

  it('a cancelled trial with a sandbox clause substitutes it into the cancellation sentence too, still naming the real expiry date', () => {
    const message = getStatusExplanation(
      { status: 'trial', cancel_at_period_end: true, expires_at: '2026-09-25T12:00:00Z' },
      'this sandbox build only avoids a real charge for Play Console License Tester accounts'
    );
    expect(message).toBe(
      "Your free trial's renewal is cancelled. This sandbox build only avoids a real charge for Play Console License Tester accounts, and access continues until September 25, 2026."
    );
  });

  it('a non-trial status ignores sandboxChargeClause entirely - it only ever affects trial wording', () => {
    const message = getStatusExplanation(
      { status: 'active', cancel_at_period_end: false, expires_at: '2026-09-25T12:00:00Z' },
      'this sandbox build never charges real money'
    );
    expect(message).toBe(
      "Your subscription is active and will renew automatically unless you cancel. If a recent payment failed, we're still retrying it — you keep access in the meantime."
    );
  });
});
