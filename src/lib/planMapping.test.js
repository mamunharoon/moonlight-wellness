import { describe, it, expect } from 'vitest';
// Imports the actual Deno Edge Function shared module directly — it has
// no Deno-specific reference at module-evaluation scope (only inside a
// couple of unrelated function bodies this file's tests never call), so
// Vite/Vitest can load and test its pure logic exactly as written,
// without a separate Deno test runner. See
// supabase/migrations/20260916110000_stripe_trial_and_refund_support.sql's
// own header comment for why this cross-boundary import is the chosen
// approach (this repo has no Deno test infrastructure at all — a
// pre-existing gap this task does not attempt to fix wholesale).
import {
  mapStripeStatus,
  isTrialEligible,
  mapRefundOrDisputeEventToStatus,
  isKnownApplePlusProductId,
  KNOWN_APPLE_PLUS_PRODUCT_IDS
} from '../../supabase/functions/_shared/planMapping.ts';

describe('mapStripeStatus (pre-existing, given a dedicated test file for the first time in this task)', () => {
  it('maps every known Stripe status to this app\'s vocabulary', () => {
    expect(mapStripeStatus('trialing')).toBe('trial');
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('past_due')).toBe('active');
    expect(mapStripeStatus('canceled')).toBe('cancelled');
    expect(mapStripeStatus('paused')).toBe('cancelled');
    expect(mapStripeStatus('unpaid')).toBe('expired');
    expect(mapStripeStatus('incomplete')).toBe('expired');
    expect(mapStripeStatus('incomplete_expired')).toBe('expired');
  });

  it('defaults an unrecognised Stripe status to expired, never throwing', () => {
    expect(mapStripeStatus('some-future-stripe-status')).toBe('expired');
    expect(mapStripeStatus(undefined)).toBe('expired');
  });
});

describe('isTrialEligible (Phase D — server-side trial eligibility)', () => {
  it('is eligible for a brand-new subscriber with no row at all', () => {
    expect(isTrialEligible(null)).toBe(true);
    expect(isTrialEligible(undefined)).toBe(true);
  });

  it('is eligible for an existing row that has never used a trial', () => {
    expect(isTrialEligible({ plan: 'free', status: 'active', trial_used_at: null })).toBe(true);
  });

  it('is NOT eligible once trial_used_at is set — a repeat trial is refused', () => {
    expect(isTrialEligible({ plan: 'plus', status: 'expired', trial_used_at: '2026-01-01T00:00:00Z' })).toBe(false);
  });

  it('never reads any field other than trial_used_at — a malicious/forged plan or status on the row cannot influence this', () => {
    expect(isTrialEligible({ plan: 'plus', status: 'active', trial_used_at: null, eligible: true })).toBe(true);
  });
});

describe('mapRefundOrDisputeEventToStatus (Phase D — refund/dispute handling)', () => {
  it('maps charge.refunded to the new refunded status', () => {
    expect(mapRefundOrDisputeEventToStatus('charge.refunded')).toBe('refunded');
  });

  it('maps charge.dispute.created to the existing cancelled status (immediate suspension)', () => {
    expect(mapRefundOrDisputeEventToStatus('charge.dispute.created')).toBe('cancelled');
  });

  it('returns null for any other event type — the caller must skip, never guess', () => {
    expect(mapRefundOrDisputeEventToStatus('customer.subscription.updated')).toBeNull();
    expect(mapRefundOrDisputeEventToStatus('charge.succeeded')).toBeNull();
    expect(mapRefundOrDisputeEventToStatus(undefined)).toBeNull();
  });
});

describe('isKnownApplePlusProductId / KNOWN_APPLE_PLUS_PRODUCT_IDS (server-side allow-list)', () => {
  it('matches the same proposed identifiers the client adapter uses', () => {
    expect(KNOWN_APPLE_PLUS_PRODUCT_IDS).toEqual([
      'com.zavaraai.wakewise.plus.monthly',
      'com.zavaraai.wakewise.plus.annual'
    ]);
  });

  it('accepts only the two known product ids', () => {
    expect(isKnownApplePlusProductId('com.zavaraai.wakewise.plus.monthly')).toBe(true);
    expect(isKnownApplePlusProductId('com.zavaraai.wakewise.plus.annual')).toBe(true);
  });

  it('rejects anything else, including a plausible-looking forged id', () => {
    expect(isKnownApplePlusProductId('com.zavaraai.wakewise.plus.lifetime')).toBe(false);
    expect(isKnownApplePlusProductId('com.attacker.wakewise.plus.monthly')).toBe(false);
    expect(isKnownApplePlusProductId(undefined)).toBe(false);
    expect(isKnownApplePlusProductId(null)).toBe(false);
  });
});
