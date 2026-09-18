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
  it('trial + cancellation scheduled: names the actual expiry date, never a hardcoded one', () => {
    const message = getStatusExplanation({
      status: 'trial',
      cancel_at_period_end: true,
      expires_at: '2026-09-25T12:00:00Z'
    });
    expect(message).toBe(
      'Your free trial is active until September 25, 2026. Your subscription is scheduled to cancel on that date, and you will not be charged.'
    );
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

  it('active + cancellation scheduled: names the actual expiry date and confirms continued access', () => {
    const message = getStatusExplanation({
      status: 'active',
      cancel_at_period_end: true,
      expires_at: '2026-11-08T12:00:00Z'
    });
    expect(message).toBe(
      'Your subscription is scheduled to cancel on November 8, 2026. You will retain WakeWise Plus access until then.'
    );
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
