// WakeWise Phase 2A — Profile membership status row. Real execution: this
// is a plain, framework-agnostic function, so its actual decision logic is
// exercised directly rather than via source regex.
import { describe, it, expect } from 'vitest';
import {
  getMembershipStatusLabel,
  getMembershipStatusLabelFromEntitlement,
  MEMBERSHIP_STATUS_UNAVAILABLE,
  MEMBERSHIP_STATUS_LOADING
} from './membershipStatus';
import { ENTITLEMENT_STATES } from './entitlementResolver';

describe('getMembershipStatusLabel — honest states only, never fabricated', () => {
  it('shows Loading while the subscription fetch is in flight, regardless of any stale subscription value', () => {
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'active' }, { loading: true })).toBe(MEMBERSHIP_STATUS_LOADING);
  });

  it('shows the neutral unavailable state on a real fetch error, never the stale/default value underneath it', () => {
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'active' }, { error: 'boom' })).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
  });

  it('shows the neutral unavailable state when there is no subscription record at all', () => {
    expect(getMembershipStatusLabel(null, {})).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
    expect(getMembershipStatusLabel(undefined, {})).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
  });

  it('a non-plus plan is always Free, regardless of status', () => {
    expect(getMembershipStatusLabel({ plan: 'free', status: 'active' }, {})).toBe('Free');
  });

  it('plan=plus, status=trial is Trial', () => {
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'trial' }, {})).toBe('Trial');
  });

  it('plan=plus, status=active, not scheduled to cancel, is Plus — Active', () => {
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'active', cancel_at_period_end: false }, {})).toBe('Plus — Active');
  });

  it('plan=plus, status=active, cancel_at_period_end with a real expiry date, shows the real formatted date - never a fabricated one', () => {
    // Noon UTC, matching subscriptionStatusMessages.test.js's own
    // convention, so this assertion is never sensitive to the test
    // runner's local timezone flipping the calendar date at a midnight
    // boundary.
    const label = getMembershipStatusLabel(
      { plan: 'plus', status: 'active', cancel_at_period_end: true, expires_at: '2026-12-25T12:00:00Z' },
      {}
    );
    expect(label).toBe('Plus — Cancels on December 25, 2026');
  });

  it('cancel_at_period_end true but no expires_at falls back to Plus — Active rather than a broken "Cancels on [nothing]" sentence', () => {
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'active', cancel_at_period_end: true, expires_at: null }, {})).toBe('Plus — Active');
  });

  it('cancelled and expired both map to Expired - status=cancelled already means no Plus access per entitlements.js, so it is never shown as a softer "cancels later" state', () => {
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'cancelled' }, {})).toBe('Expired');
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'expired' }, {})).toBe('Expired');
  });

  it('an unrecognised status value never guesses which honest state it might mean', () => {
    expect(getMembershipStatusLabel({ plan: 'plus', status: 'something_new' }, {})).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
  });

  it('this phase never returns "Plus — Grace period" - the live subscriptions table has no distinct grace-period status to read (see this file\'s own header comment)', () => {
    const allPossibleInputs = ['trial', 'active', 'cancelled', 'expired', 'something_new'].map((status) =>
      getMembershipStatusLabel({ plan: 'plus', status, cancel_at_period_end: true, expires_at: '2026-01-01T00:00:00.000Z' }, {})
    );
    expect(allPossibleInputs).not.toContain('Plus — Grace period');
  });
});

describe('getMembershipStatusLabelFromEntitlement — WakeWise Phase 2B, the unified (multi-provider) label Profile.jsx now actually uses', () => {
  it('every ENTITLEMENT_STATES value maps to a distinct, honest label', () => {
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.LOADING })).toBe(MEMBERSHIP_STATUS_LOADING);
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.VERIFICATION_UNAVAILABLE })).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.FREE })).toBe('Free');
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.TRIAL })).toBe('Trial');
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.ACTIVE })).toBe('Plus — Active');
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.GRACE_PERIOD })).toBe('Plus — Grace period');
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.BILLING_ISSUE })).toBe('Plus — Billing issue');
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.EXPIRED })).toBe('Expired');
  });

  it('this function CAN say "Plus — Grace period" and "Plus — Billing issue" - closing the exact gap Phase 2A\'s own getMembershipStatusLabel disclosed as impossible', () => {
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.GRACE_PERIOD })).not.toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
    expect(getMembershipStatusLabelFromEntitlement({ state: ENTITLEMENT_STATES.BILLING_ISSUE })).not.toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
  });

  it('cancelled_active_until_period_end shows the real currentPeriodEnd date, never a fabricated one, and falls back honestly if it is somehow missing', () => {
    const withDate = getMembershipStatusLabelFromEntitlement({
      state: ENTITLEMENT_STATES.CANCELLED_ACTIVE_UNTIL_PERIOD_END,
      currentPeriodEnd: '2026-12-25T12:00:00Z'
    });
    expect(withDate).toBe('Plus — Cancels on December 25, 2026');

    const withoutDate = getMembershipStatusLabelFromEntitlement({
      state: ENTITLEMENT_STATES.CANCELLED_ACTIVE_UNTIL_PERIOD_END,
      currentPeriodEnd: null
    });
    expect(withoutDate).toBe('Plus — Active');
  });

  it('null/undefined/an unrecognised state never guesses - always the neutral unavailable label', () => {
    expect(getMembershipStatusLabelFromEntitlement(null)).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
    expect(getMembershipStatusLabelFromEntitlement(undefined)).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
    expect(getMembershipStatusLabelFromEntitlement({ state: 'something_new' })).toBe(MEMBERSHIP_STATUS_UNAVAILABLE);
  });
});
