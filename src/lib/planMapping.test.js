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
  KNOWN_APPLE_PLUS_PRODUCT_IDS,
  isBlockingStripeStatus,
  BLOCKING_STRIPE_STATUSES,
  isNonTerminalLedgerStatus,
  NON_TERMINAL_LEDGER_STATUSES
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

describe('isBlockingStripeStatus (Duplicate-Subscription Remediation — checkout guard, raw Stripe vocabulary)', () => {
  it('blocks every access-bearing or still-resolving raw Stripe status', () => {
    expect(BLOCKING_STRIPE_STATUSES).toEqual(['trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete']);
    for (const status of BLOCKING_STRIPE_STATUSES) {
      expect(isBlockingStripeStatus(status)).toBe(true);
    }
  });

  it('does not block the two genuinely terminal raw Stripe statuses', () => {
    expect(isBlockingStripeStatus('canceled')).toBe(false);
    expect(isBlockingStripeStatus('incomplete_expired')).toBe(false);
  });

  it('does not block an unrecognised or missing status — never guesses a block', () => {
    expect(isBlockingStripeStatus('some-future-stripe-status')).toBe(false);
    expect(isBlockingStripeStatus(undefined)).toBe(false);
  });
});

describe('isNonTerminalLedgerStatus (Duplicate-Subscription Remediation — webhook projection selection, mapped vocabulary)', () => {
  it('treats every access-granting mapped status as non-terminal, mirroring entitlementResolution.js', () => {
    expect(NON_TERMINAL_LEDGER_STATUSES).toEqual(['trial', 'active', 'grace_period', 'billing_retry']);
    for (const status of NON_TERMINAL_LEDGER_STATUSES) {
      expect(isNonTerminalLedgerStatus(status)).toBe(true);
    }
  });

  it('treats cancelled/expired/refunded/revoked as terminal', () => {
    expect(isNonTerminalLedgerStatus('cancelled')).toBe(false);
    expect(isNonTerminalLedgerStatus('expired')).toBe(false);
    expect(isNonTerminalLedgerStatus('refunded')).toBe(false);
    expect(isNonTerminalLedgerStatus('revoked')).toBe(false);
  });

  it('never conflates raw Stripe statuses with the mapped ledger vocabulary', () => {
    // 'trialing'/'past_due' are raw Stripe statuses (see BLOCKING_STRIPE_STATUSES
    // above) — they must never be treated as non-terminal LEDGER statuses,
    // since the ledger only ever stores mapStripeStatus's mapped output.
    expect(isNonTerminalLedgerStatus('trialing')).toBe(false);
    expect(isNonTerminalLedgerStatus('past_due')).toBe(false);
  });
});
