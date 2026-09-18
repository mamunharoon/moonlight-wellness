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
  NON_TERMINAL_LEDGER_STATUSES,
  stripeSubscriptionIdentityMismatch,
  checkoutSessionAdmissionFailureReason,
  refundOrDisputeQuarantineReason
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

const KNOWN_LEDGER_ROW = Object.freeze({
  user_id: 'user-A',
  stripe_customer_id: 'cus_known',
  environment: 'sandbox'
});

describe('stripeSubscriptionIdentityMismatch (Legacy-Price Webhook Remediation)', () => {
  it('reports no mismatch when there is no ledger row yet (nothing to compare against)', () => {
    expect(stripeSubscriptionIdentityMismatch(null, { userId: 'user-A' })).toBeNull();
  });

  it('reports no mismatch when every provided field agrees with the ledger row', () => {
    expect(
      stripeSubscriptionIdentityMismatch(KNOWN_LEDGER_ROW, {
        userId: 'user-A',
        customerId: 'cus_known',
        environment: 'sandbox'
      })
    ).toBeNull();
  });

  it('does not invalidate a match merely because historical user metadata is absent', () => {
    expect(
      stripeSubscriptionIdentityMismatch(KNOWN_LEDGER_ROW, {
        userId: null,
        customerId: 'cus_known',
        environment: 'sandbox'
      })
    ).toBeNull();
  });

  it('flags a genuine user id mismatch even though everything else agrees', () => {
    expect(
      stripeSubscriptionIdentityMismatch(KNOWN_LEDGER_ROW, {
        userId: 'user-B',
        customerId: 'cus_known',
        environment: 'sandbox'
      })
    ).toBe('user_id_mismatch');
  });

  it('flags a customer id mismatch', () => {
    expect(
      stripeSubscriptionIdentityMismatch(KNOWN_LEDGER_ROW, { customerId: 'cus_someone_else' })
    ).toBe('customer_id_mismatch');
  });

  it('flags an environment mismatch — a sandbox event can never update a production row or vice versa', () => {
    expect(
      stripeSubscriptionIdentityMismatch(KNOWN_LEDGER_ROW, { environment: 'production' })
    ).toBe('environment_mismatch');
  });

  it('checks user id before customer id before environment, in that order', () => {
    expect(
      stripeSubscriptionIdentityMismatch(KNOWN_LEDGER_ROW, {
        userId: 'user-B',
        customerId: 'cus_someone_else',
        environment: 'production'
      })
    ).toBe('user_id_mismatch');
  });
});

const BASE_ADMISSION_INPUT = Object.freeze({
  isLivemode: false,
  resolvedUserId: 'user-A',
  attempt: Object.freeze({
    id: 'attempt-1',
    user_id: 'user-A',
    stripe_checkout_session_id: 'cs_test_123',
    expected_stripe_price_id: 'price_A'
  }),
  session: Object.freeze({ id: 'cs_test_123', customer: 'cus_known' }),
  stripeSubscription: Object.freeze({ customer: 'cus_known' }),
  priceId: 'price_A',
  storedCustomerId: 'cus_known'
});

describe('checkoutSessionAdmissionFailureReason (Legacy-Price Webhook Remediation — admission chain)', () => {
  it('admits a fully consistent checkout (the golden path)', () => {
    expect(checkoutSessionAdmissionFailureReason(BASE_ADMISSION_INPUT)).toBeNull();
  });

  it('rejects a livemode event on the sandbox-only DEV endpoint', () => {
    expect(checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, isLivemode: true })).toBe(
      'livemode_event_on_sandbox_endpoint'
    );
  });

  it('rejects when the Supabase user could not be resolved', () => {
    expect(checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, resolvedUserId: null })).toBe(
      'user_not_resolved'
    );
  });

  it('rejects when no checkout_attempt is linked at all', () => {
    expect(checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, attempt: null })).toBe(
      'attempt_not_found'
    );
  });

  it('rejects when the completed session id does not match the one recorded on the attempt', () => {
    expect(
      checkoutSessionAdmissionFailureReason({
        ...BASE_ADMISSION_INPUT,
        session: { id: 'cs_test_DIFFERENT', customer: 'cus_known' }
      })
    ).toBe('session_id_mismatch');
  });

  it('rejects when the linked attempt belongs to a different user than the one resolved from this event', () => {
    expect(
      checkoutSessionAdmissionFailureReason({
        ...BASE_ADMISSION_INPUT,
        attempt: { ...BASE_ADMISSION_INPUT.attempt, user_id: 'user-OTHER' }
      })
    ).toBe('attempt_user_mismatch');
  });

  it('rejects when the retrieved Stripe subscription is missing or its customer disagrees with the session', () => {
    expect(
      checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, stripeSubscription: null })
    ).toBe('subscription_customer_mismatch');
    expect(
      checkoutSessionAdmissionFailureReason({
        ...BASE_ADMISSION_INPUT,
        stripeSubscription: { customer: 'cus_DIFFERENT' }
      })
    ).toBe('subscription_customer_mismatch');
  });

  it('rejects when this user\'s own stored customer id disagrees with the session — but only when one is on file', () => {
    expect(
      checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, storedCustomerId: 'cus_DIFFERENT' })
    ).toBe('stored_customer_mismatch');
    expect(
      checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, storedCustomerId: null })
    ).toBeNull();
  });

  it('rejects on a price mismatch against the attempt\'s immutable expected price — never the live current secret', () => {
    expect(
      checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, priceId: 'price_SOMETHING_ELSE' })
    ).toBe('price_mismatch');
    expect(checkoutSessionAdmissionFailureReason({ ...BASE_ADMISSION_INPUT, priceId: null })).toBe(
      'price_mismatch'
    );
  });

  it('CORE FIX: admits a checkout whose price was current at session-creation time even if secrets have since rotated to a different price', () => {
    // The attempt recorded price_A as expected when the session was
    // created; the actual completed subscription is still on price_A
    // (Stripe never changes an existing subscription's price just
    // because our secrets changed). This must succeed regardless of
    // whatever knownPlusPriceIds() would return right now — this
    // function never consults it at all.
    const midRotationInput = {
      ...BASE_ADMISSION_INPUT,
      attempt: { ...BASE_ADMISSION_INPUT.attempt, expected_stripe_price_id: 'price_A' },
      priceId: 'price_A'
    };
    expect(checkoutSessionAdmissionFailureReason(midRotationInput)).toBeNull();
  });
});

describe('refundOrDisputeQuarantineReason (Legacy-Price Webhook Remediation — refund/dispute safety)', () => {
  it('quarantines a charge that cannot be tied to any subscription invoice', () => {
    expect(refundOrDisputeQuarantineReason(null, KNOWN_LEDGER_ROW, {})).toBe('charge_not_tied_to_subscription');
  });

  it('quarantines a charge tied to a subscription this app has never admitted', () => {
    expect(refundOrDisputeQuarantineReason('sub_unknown', null, {})).toBe('unknown_subscription');
  });

  it('accepts a charge tied to a known subscription whose identity fields all agree', () => {
    expect(
      refundOrDisputeQuarantineReason('sub_known', KNOWN_LEDGER_ROW, {
        customerId: 'cus_known',
        environment: 'sandbox'
      })
    ).toBeNull();
  });

  it('quarantines when the resolved subscription is known but its customer disagrees — a refund for subscription A must never touch a row belonging to a different customer', () => {
    expect(
      refundOrDisputeQuarantineReason('sub_known', KNOWN_LEDGER_ROW, { customerId: 'cus_someone_else' })
    ).toBe('customer_id_mismatch');
  });
});
