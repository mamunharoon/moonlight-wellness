// Real execution against the ACTUAL production handler/mapper - no
// defect-demonstration wrappers. Cross-boundary import, same pattern as
// revenueCatEventMapping.test.js (the real module lives under
// supabase/functions/_shared/ and is not itself Deno-specific).
import { describe, it, expect, vi } from 'vitest';
import {
  resolveEventVerifiedAt,
  resolveEventExpiresAt,
  buildApplyVerifiedEventArgs,
  processRevenueCatWebhookEvent,
  looksLikeSupabaseUuid,
  CLOCK_SKEW_TOLERANCE_MS
} from '../../supabase/functions/_shared/revenueCatWebhookHandler.js';

const APP_USER_ID = '12345678-1234-1234-1234-123456789abc';
// SUB-21/ST-29 fix: every state-changing event now requires a valid
// expiration_at_ms to reach the RPC (see the new expiration-quarantine
// describe block below) - this shared constant is added to pre-existing
// event fixtures below that test OTHER behaviour (ordering, dedup,
// provider routing, cancellation preference) and were never deliberately
// testing a missing expiry themselves.
const FUTURE_EXPIRY_MS = Date.parse('2099-01-01T00:00:00Z');

describe('resolveEventVerifiedAt - fix 1 (event-time ordering, finalised: processing time is never an authoritative fallback, and timestamp RANGE is validated)', () => {
  it('uses the official event_timestamp_ms field when present, valid, and within range', () => {
    const result = resolveEventVerifiedAt({ event_timestamp_ms: 1697451462232 });
    expect(result).toEqual({ verifiedAtIso: new Date(1697451462232).toISOString(), usedFallback: false, quarantineReason: null });
  });

  it('a past, significantly delayed event_timestamp_ms is preserved and accepted - there is no past-side bound (a retried delivery after an outage, or a drained backlog, must still be accepted)', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const twoHoursAgoMs = now.getTime() - 2 * 60 * 60 * 1000;
    expect(resolveEventVerifiedAt({ event_timestamp_ms: twoHoursAgoMs }, now)).toEqual({
      verifiedAtIso: new Date(twoHoursAgoMs).toISOString(),
      usedFallback: false,
      quarantineReason: null
    });
    // Arbitrarily far in the past is equally fine - no lower bound at all.
    const yearsAgoMs = Date.parse('2020-01-01T00:00:00Z');
    expect(resolveEventVerifiedAt({ event_timestamp_ms: yearsAgoMs }, now).usedFallback).toBe(false);
  });

  it('a future event_timestamp_ms WITHIN the documented clock-skew tolerance is accepted - ordinary clock skew between RevenueCat/Apple/Google and this server is expected, not an error', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const slightlyAheadMs = now.getTime() + 5000; // 5 seconds ahead.
    expect(resolveEventVerifiedAt({ event_timestamp_ms: slightlyAheadMs }, now)).toEqual({
      verifiedAtIso: new Date(slightlyAheadMs).toISOString(),
      usedFallback: false,
      quarantineReason: null
    });
    // Right at the edge of tolerance (still within it) is still accepted.
    const atToleranceMs = now.getTime() + CLOCK_SKEW_TOLERANCE_MS - 1;
    expect(resolveEventVerifiedAt({ event_timestamp_ms: atToleranceMs }, now).usedFallback).toBe(false);
  });

  // THE CORE NEW REQUIREMENT: an unreasonably future timestamp must be
  // quarantined, not accepted - accepting it would make this
  // transaction's ordering PERMANENTLY unbeatable (no future genuinely
  // real event could ever exceed it), poisoning it forever rather than
  // causing one bad write.
  it('an UNREASONABLY future event_timestamp_ms (beyond the documented tolerance) is quarantined with a distinct reason, never accepted', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const justBeyondToleranceMs = now.getTime() + CLOCK_SKEW_TOLERANCE_MS + 1;
    expect(resolveEventVerifiedAt({ event_timestamp_ms: justBeyondToleranceMs }, now)).toEqual({
      verifiedAtIso: null,
      usedFallback: true,
      quarantineReason: 'unreasonable_future'
    });

    // An absurd value (year 2099) is quarantined the same way - never
    // clamped to `now`, never accepted as-is.
    const absurdFutureMs = Date.parse('2099-01-01T00:00:00Z');
    expect(resolveEventVerifiedAt({ event_timestamp_ms: absurdFutureMs }, now)).toEqual({
      verifiedAtIso: null,
      usedFallback: true,
      quarantineReason: 'unreasonable_future'
    });
  });

  it('missing event_timestamp_ms returns no safe ordering value at all (verifiedAtIso: null) - no processing-time guess is computed or returned', () => {
    expect(resolveEventVerifiedAt({ type: 'RENEWAL' })).toEqual({ verifiedAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
  });

  it('a non-numeric event_timestamp_ms returns null, never throwing', () => {
    expect(resolveEventVerifiedAt({ event_timestamp_ms: 'not-a-number' })).toEqual({ verifiedAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
    expect(resolveEventVerifiedAt({ event_timestamp_ms: null })).toEqual({ verifiedAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
  });

  it('a non-finite event_timestamp_ms (NaN/Infinity) returns null', () => {
    expect(resolveEventVerifiedAt({ event_timestamp_ms: NaN })).toEqual({ verifiedAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
    expect(resolveEventVerifiedAt({ event_timestamp_ms: Infinity })).toEqual({ verifiedAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
  });
});

describe('resolveEventExpiresAt - SUB-21/ST-29 fix (expiration_at_ms validated BEFORE date conversion, never thrown)', () => {
  it('uses expiration_at_ms when present, valid, and in range', () => {
    const ms = 1697451462232;
    expect(resolveEventExpiresAt({ expiration_at_ms: ms })).toEqual({
      expiresAtIso: new Date(ms).toISOString(),
      usedFallback: false,
      quarantineReason: null
    });
  });

  it('a valid PAST expiration_at_ms is accepted unmodified - there is no "already expired, so reject" rule here, that decision belongs to the RPC/entitlement guard, not this mapping step', () => {
    const pastMs = Date.parse('2020-01-01T00:00:00Z');
    expect(resolveEventExpiresAt({ expiration_at_ms: pastMs })).toEqual({
      expiresAtIso: new Date(pastMs).toISOString(),
      usedFallback: false,
      quarantineReason: null
    });
  });

  it('a valid FUTURE expiration_at_ms is accepted unmodified - unlike event_timestamp_ms, an expiry has no "unreasonably future" rejection; a genuine multi-year subscription period is expected', () => {
    const futureMs = Date.parse('2099-01-01T00:00:00Z');
    expect(resolveEventExpiresAt({ expiration_at_ms: futureMs })).toEqual({
      expiresAtIso: new Date(futureMs).toISOString(),
      usedFallback: false,
      quarantineReason: null
    });
  });

  it('a missing expiration_at_ms is quarantined, never defaulted to null-and-proceed', () => {
    expect(resolveEventExpiresAt({ type: 'RENEWAL' })).toEqual({ expiresAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
    expect(resolveEventExpiresAt({})).toEqual({ expiresAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
  });

  it('a wrong-type expiration_at_ms (string, boolean, object, array) is quarantined - these ARE reachable from a real webhook JSON body', () => {
    for (const wrongType of ['not-a-number', '1697451462232', true, false, { ms: 1 }, [1697451462232], null]) {
      expect(resolveEventExpiresAt({ expiration_at_ms: wrongType })).toEqual({ expiresAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
    }
  });

  // THE DEMONSTRATED DEFECT THIS FIX CLOSES: the previous implementation
  // (`new Date(event.expiration_at_ms).toISOString()`, guarded only by
  // `typeof === 'number'`) threw an uncaught RangeError for exactly this
  // shape - reproduced directly before this fix, not assumed. This is a
  // syntactically ordinary JSON number (no NaN/Infinity involved) -
  // genuinely reachable from a real, malformed webhook payload, not a
  // synthetic unit-test-only value.
  it('an out-of-range NUMERIC expiration_at_ms (e.g. a corrupted/inflated value) is quarantined, never thrown - genuinely reachable via real JSON, unlike NaN/Infinity below', () => {
    for (const outOfRange of [1e20, -1e20, Number.MAX_VALUE]) {
      expect(() => resolveEventExpiresAt({ expiration_at_ms: outOfRange })).not.toThrow();
      expect(resolveEventExpiresAt({ expiration_at_ms: outOfRange })).toEqual({ expiresAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
    }
  });

  // Distinguished explicitly from the case above: NaN/Infinity have no
  // JSON representation at all (a real webhook body could never carry
  // either - req.json() would fail to parse a payload containing a bare
  // `NaN` or `Infinity` token long before this function ever saw it).
  // Exercised anyway because this is a plain, reusable JS function
  // callable from more than one context, and it must stay safe even for
  // an input shape only a direct test (or a future caller) could produce.
  it('a non-finite expiration_at_ms (NaN/Infinity - NOT JSON-representable, a direct unit-test value only) is quarantined the same way, as defense in depth', () => {
    for (const nonFinite of [NaN, Infinity, -Infinity]) {
      expect(() => resolveEventExpiresAt({ expiration_at_ms: nonFinite })).not.toThrow();
      expect(resolveEventExpiresAt({ expiration_at_ms: nonFinite })).toEqual({ expiresAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' });
    }
  });
});

describe('buildApplyVerifiedEventArgs - fix 2 chain (undefined/null must never become false/true)', () => {
  const baseEvent = { type: 'CANCELLATION', period_type: 'NORMAL', original_transaction_id: 'txn-1', event_timestamp_ms: 1697451462232 };

  it('stateChange.cancelAtPeriodEnd === undefined produces p_cancel_at_period_end === null, exactly (apple)', () => {
    const { args } = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: baseEvent,
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: undefined },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: { type: 'CANCELLATION' },
      eventId: 'evt-1'
    });
    expect(args.p_cancel_at_period_end).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(args, 'p_cancel_at_period_end')).toBe(true);
  });

  it('stateChange.cancelAtPeriodEnd === undefined produces p_cancel_at_period_end === null, exactly (google)', () => {
    const { args } = buildApplyVerifiedEventArgs({
      provider: 'google',
      event: { ...baseEvent, original_transaction_id: 'GPA.order-1' },
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: undefined },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: { type: 'CANCELLATION' },
      eventId: 'evt-2'
    });
    expect(args.p_cancel_at_period_end).toBeNull();
  });

  it('an explicit null is passed through as null, not coerced', () => {
    const { args } = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: baseEvent,
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: null },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: {},
      eventId: 'evt-3'
    });
    expect(args.p_cancel_at_period_end).toBeNull();
  });

  it('an explicit true/false is passed through unchanged - this function never re-interprets a real value', () => {
    const trueArgs = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: baseEvent,
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: true },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: {},
      eventId: 'evt-4'
    }).args;
    expect(trueArgs.p_cancel_at_period_end).toBe(true);

    const falseArgs = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: baseEvent,
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: false },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: {},
      eventId: 'evt-5'
    }).args;
    expect(falseArgs.p_cancel_at_period_end).toBe(false);
  });

  it('missing an Apple transaction identifier returns no args and an explicit reason, never a partially-built call', () => {
    const { args, reason } = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: { type: 'RENEWAL', period_type: 'NORMAL' },
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: undefined },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: {},
      eventId: 'evt-6'
    });
    expect(args).toBeNull();
    expect(reason).toBe('missing_transaction_id');
  });

  it('missing a Google purchase token returns no args and an explicit reason', () => {
    const { args, reason } = buildApplyVerifiedEventArgs({
      provider: 'google',
      event: { type: 'RENEWAL', period_type: 'NORMAL' },
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: undefined },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: {},
      eventId: 'evt-7'
    });
    expect(args).toBeNull();
    expect(reason).toBe('missing_purchase_token');
  });

  it('REFUND_REVERSED with a past expiration_at_ms carries that real (past) timestamp through unmodified - never fabricated as "still valid"', () => {
    const pastMs = Date.parse('2020-01-01T00:00:00Z');
    const { args } = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: { type: 'REFUND_REVERSED', period_type: 'NORMAL', original_transaction_id: 'txn-2', expiration_at_ms: pastMs },
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: undefined },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      expiresAtIso: new Date(pastMs).toISOString(),
      payloadSummary: {},
      eventId: 'evt-8'
    });
    expect(args.p_current_period_expires_at).toBe(new Date(pastMs).toISOString());
  });

  it('REFUND_REVERSED with a future expiration_at_ms carries that real (future) timestamp through unmodified', () => {
    const futureMs = Date.parse('2099-01-01T00:00:00Z');
    const { args } = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: { type: 'REFUND_REVERSED', period_type: 'NORMAL', original_transaction_id: 'txn-3', expiration_at_ms: futureMs },
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: undefined },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      expiresAtIso: new Date(futureMs).toISOString(),
      payloadSummary: {},
      eventId: 'evt-9'
    });
    expect(args.p_current_period_expires_at).toBe(new Date(futureMs).toISOString());
  });

  it('expiresAtIso not supplied (e.g. the caller never resolved one) produces p_current_period_expires_at === null, never re-deriving from the raw event', () => {
    const { args } = buildApplyVerifiedEventArgs({
      provider: 'apple',
      event: { type: 'REFUND_REVERSED', period_type: 'NORMAL', original_transaction_id: 'txn-10', expiration_at_ms: Date.parse('2099-01-01T00:00:00Z') },
      appUserId: APP_USER_ID,
      stateChange: { status: 'active', cancelAtPeriodEnd: undefined },
      verifiedAtIso: '2026-10-19T00:00:00.000Z',
      payloadSummary: {},
      eventId: 'evt-10'
    });
    expect(args.p_current_period_expires_at).toBeNull();
  });
});

// Faithful mirror of apply_verified_*_subscription_event's own staleness
// guard, used ONLY as a test double standing in for the real RPC/DB so
// the full pipeline (event -> verifiedAtIso -> RPC args -> accepted or
// rejected) can be exercised deterministically without a live database.
// `store` simulates the already-persisted row for one transaction key.
const makeFakeDb = () => {
  const store = new Map(); // key -> { lastVerifiedAt, args }
  const calls = [];
  return {
    calls,
    insertProviderEvent: vi.fn(async () => ({ error: null })),
    callApplyVerifiedEvent: vi.fn(async (provider, args) => {
      calls.push({ provider, args });
      const key =
        provider === 'apple' ? `apple:${args.p_apple_original_transaction_id}` : `google:${args.p_google_purchase_token}`;
      const existing = store.get(key);
      if (existing && existing.lastVerifiedAt >= args.p_last_verified_at) {
        return { error: null }; // mirrors the RPC's own non-error 'stale_event' return
      }
      store.set(key, { lastVerifiedAt: args.p_last_verified_at, args });
      return { error: null };
    }),
    store
  };
};

describe('processRevenueCatWebhookEvent - out-of-order delivery (fix 1, end to end)', () => {
  it('an old CANCELLATION delivered/processed AFTER a newer RENEWAL is correctly rejected by the staleness rule once ordering uses event_timestamp_ms', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-order-1';

    const renewal = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-renewal', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };
    const oldCancellation = { type: 'CANCELLATION', period_type: 'NORMAL', cancel_reason: 'UNSUBSCRIBE', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-cancel', event_timestamp_ms: 1697365062232 /* ~1 day earlier */, expiration_at_ms: FUTURE_EXPIRY_MS };

    // Processed in reverse-of-real-time order: renewal first, then the
    // chronologically OLDER cancellation (simulating a late redelivery).
    await processRevenueCatWebhookEvent(renewal, db);
    await processRevenueCatWebhookEvent(oldCancellation, db);

    expect(db.calls).toHaveLength(2);
    const stored = db.store.get(`apple:${originalTransactionId}`);
    // The renewal's own args must still be what's stored - the old
    // cancellation's late arrival never overwrote it.
    expect(stored.args.p_event_type).toBe('RENEWAL');
    expect(stored.args.p_status).toBe('active');
    expect(stored.lastVerifiedAt).toBe(new Date(renewal.event_timestamp_ms).toISOString());
  });

  it('genuinely in-order delivery (old event first, new event second) is unaffected', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-order-2';
    const oldCancellation = { type: 'CANCELLATION', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-a', event_timestamp_ms: 1697365062232, expiration_at_ms: FUTURE_EXPIRY_MS };
    const renewal = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-b', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };

    await processRevenueCatWebhookEvent(oldCancellation, db);
    await processRevenueCatWebhookEvent(renewal, db);

    const stored = db.store.get(`apple:${originalTransactionId}`);
    expect(stored.args.p_event_type).toBe('RENEWAL');
    expect(stored.lastVerifiedAt).toBe(new Date(renewal.event_timestamp_ms).toISOString());
  });
});

describe('processRevenueCatWebhookEvent - duplicate events', () => {
  it('an acknowledge-only event redelivered (unique-violation on insert) still reports success, never a 500', async () => {
    const db = makeFakeDb();
    db.insertProviderEvent = vi.fn(async () => ({ error: { code: '23505', message: 'duplicate key' } }));
    const result = await processRevenueCatWebhookEvent(
      { type: 'TEST', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-dup' },
      db
    );
    expect(result).toEqual({ status: 200, body: { received: true, processed: true } });
  });

  it('a genuinely failed acknowledge-only insert (not a duplicate) surfaces as a 500 so RevenueCat retries', async () => {
    const db = makeFakeDb();
    db.insertProviderEvent = vi.fn(async () => ({ error: { code: '08006', message: 'connection failure' } }));
    const result = await processRevenueCatWebhookEvent(
      { type: 'TEST', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-fail' },
      db
    );
    expect(result.status).toBe(500);
  });

  it('a redelivered state-changing event that the RPC itself recognises as a duplicate (no SQL error, simply not re-applied) still reports success', async () => {
    const db = makeFakeDb();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-dup', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-redelivered', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };
    const first = await processRevenueCatWebhookEvent(event, db);
    const second = await processRevenueCatWebhookEvent(event, db); // identical redelivery
    expect(first.body.processed).toBe(true);
    expect(second.body.processed).toBe(true);
    expect(db.calls).toHaveLength(2); // both calls happen; the fake DB's own staleness rule is what makes the second a no-op, exactly mirroring the real RPC's internal duplicate_event short-circuit.
  });
});

describe('processRevenueCatWebhookEvent - invalid/missing timestamps are QUARANTINED, never applied with a processing-time guess (finalised fix 1)', () => {
  it('a missing event_timestamp_ms is quarantined: the RPC is NEVER called, onTimestampQuarantined fires with the distinct reason, and the response says so explicitly', async () => {
    const db = makeFakeDb();
    const onTimestampQuarantined = vi.fn();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-fallback', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-fallback' };
    const result = await processRevenueCatWebhookEvent(event, { ...db, onTimestampQuarantined });
    expect(result).toEqual({ status: 200, body: { received: true, processed: false, reason: 'quarantined_invalid_timestamp' } });
    expect(db.calls).toHaveLength(0); // the RPC is never invoked for a quarantined event.
    expect(onTimestampQuarantined).toHaveBeenCalledTimes(1);
    expect(onTimestampQuarantined).toHaveBeenCalledWith(event, 'missing_or_invalid');
  });

  it('an unreasonably future event_timestamp_ms is quarantined with its OWN distinct reason, never conflated with missing/invalid', async () => {
    const db = makeFakeDb();
    const onTimestampQuarantined = vi.fn();
    const now = new Date('2026-10-20T00:00:00Z');
    const event = {
      type: 'RENEWAL',
      period_type: 'NORMAL',
      original_transaction_id: 'txn-future',
      store: 'APP_STORE',
      app_user_id: APP_USER_ID,
      id: 'evt-future',
      event_timestamp_ms: Date.parse('2099-01-01T00:00:00Z')
    };
    const result = await processRevenueCatWebhookEvent(event, { ...db, now, onTimestampQuarantined });
    expect(result).toEqual({ status: 200, body: { received: true, processed: false, reason: 'quarantined_future_timestamp' } });
    expect(db.calls).toHaveLength(0);
    expect(onTimestampQuarantined).toHaveBeenCalledWith(event, 'unreasonable_future');
  });

  it('a non-numeric/non-finite event_timestamp_ms is quarantined the same way', async () => {
    for (const malformedMs of ['not-a-number', NaN, Infinity, null]) {
      const db = makeFakeDb();
      const event = { type: 'CANCELLATION', period_type: 'NORMAL', original_transaction_id: 'txn-malformed', store: 'APP_STORE', app_user_id: APP_USER_ID, id: `evt-malformed-${String(malformedMs)}`, event_timestamp_ms: malformedMs };
      const result = await processRevenueCatWebhookEvent(event, db);
      expect(result.body.reason).toBe('quarantined_invalid_timestamp');
      expect(db.calls).toHaveLength(0);
    }
  });

  it('a valid event_timestamp_ms never triggers quarantine or the hook', async () => {
    const db = makeFakeDb();
    const onTimestampQuarantined = vi.fn();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-valid-ts', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-valid-ts', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };
    const result = await processRevenueCatWebhookEvent(event, { ...db, onTimestampQuarantined });
    expect(result.body.processed).toBe(true);
    expect(onTimestampQuarantined).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(1);
  });

  it('a quarantined event is still recorded to provider_events for idempotency, and a genuine insert failure (not a duplicate) still surfaces as a 500', async () => {
    const db = makeFakeDb();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-quarantine-insert-fail', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-q-fail' };
    const ok = await processRevenueCatWebhookEvent(event, db);
    expect(ok.body.reason).toBe('quarantined_invalid_timestamp');
    expect(db.insertProviderEvent).toHaveBeenCalledTimes(1);

    const dbFailing = makeFakeDb();
    dbFailing.insertProviderEvent = vi.fn(async () => ({ error: { code: '08006', message: 'connection failure' } }));
    const failed = await processRevenueCatWebhookEvent({ ...event, id: 'evt-q-fail-2' }, dbFailing);
    expect(failed.status).toBe(500);
  });

  // THE CORE RISK THIS FIX MUST NOT INTRODUCE: a malformed-timestamp
  // event redelivered/retried AFTER a genuinely newer, validly-timestamped
  // event for the SAME transaction must never overwrite it - this is the
  // exact failure mode "fall back to processing time" had, and
  // quarantining must close it completely, not just narrow it.
  it('CONFIRMED: a malformed-timestamp event can never overwrite an already-applied newer valid record, because it is never even sent to the RPC', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-malformed-cannot-overwrite';
    const validRenewal = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-valid', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };
    const malformedCancellation = { type: 'CANCELLATION', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-malformed', event_timestamp_ms: 'not-a-number', expiration_at_ms: FUTURE_EXPIRY_MS };

    await processRevenueCatWebhookEvent(validRenewal, db);
    const result = await processRevenueCatWebhookEvent(malformedCancellation, db);

    expect(result.body.reason).toBe('quarantined_invalid_timestamp');
    expect(db.calls).toHaveLength(1); // only the valid renewal ever reached the RPC.
    const stored = db.store.get(`apple:${originalTransactionId}`);
    expect(stored.args.p_event_type).toBe('RENEWAL'); // untouched by the quarantined event.
  });

  // Explicitly NOT dismissed as harmless: rejecting still carries real
  // risk, documented here rather than asserted away. If the quarantined
  // event were itself the genuine update (e.g. a real renewal whose
  // payload happened to have a malformed timestamp), the OLDER stored
  // expiry remains in place, and the already-deployed expiry guard
  // (157cd56) will correctly, but prematurely, deny access once that
  // older expiry passes - a real wrong-access window this fix does not
  // eliminate, only prevents from being made WORSE by a corrupted
  // ordering key. Resolving it fully requires either a later valid event
  // or (Apple only) a scheduled reconcile-apple-subscriptions pass -
  // both outside this fix's scope. This test documents that the
  // response/log make the condition observable, not that the underlying
  // risk is solved.
  it('quarantining a would-be-valid renewal leaves the OLDER stored expiry in place - documented risk, not silently treated as harmless', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-quarantine-risk';
    const olderRenewal = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-older', event_timestamp_ms: 1697451462232, expiration_at_ms: Date.parse('2026-10-20T00:00:00Z') };
    await processRevenueCatWebhookEvent(olderRenewal, db);

    // A genuine later renewal that would have EXTENDED the expiry, but
    // whose own timestamp is malformed - quarantined, not applied.
    const laterRenewalMalformed = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-later-malformed', event_timestamp_ms: NaN, expiration_at_ms: Date.parse('2027-10-20T00:00:00Z') };
    const result = await processRevenueCatWebhookEvent(laterRenewalMalformed, db);

    expect(result.body.reason).toBe('quarantined_invalid_timestamp');
    const stored = db.store.get(`apple:${originalTransactionId}`);
    // The OLD expiry is still what's on record - the extension never
    // landed. This is the documented, non-harmless residual risk.
    expect(stored.args.p_current_period_expires_at).toBe(new Date(Date.parse('2026-10-20T00:00:00Z')).toISOString());
  });

  // THE CORE NEW REQUIREMENT, end to end: an unreasonable future
  // timestamp must never poison ordering for a transaction - if it were
  // ever accepted and stored as last_verified_at, NO later genuinely-real
  // event could ever exceed it (real events don't occur in the year
  // 2099), permanently locking that transaction out of further updates.
  // Quarantining must prevent this entirely, not merely reduce it.
  it('CONFIRMED: an unreasonably-future-timestamped event never poisons ordering - nothing is ever written for it, so a later genuinely valid event is still accepted normally', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-cannot-poison';
    const now = new Date('2026-10-20T00:00:00Z');

    const poisonAttempt = {
      type: 'RENEWAL',
      period_type: 'NORMAL',
      original_transaction_id: originalTransactionId,
      store: 'APP_STORE',
      app_user_id: APP_USER_ID,
      id: 'evt-poison-attempt',
      event_timestamp_ms: Date.parse('2099-01-01T00:00:00Z')
    };
    const poisonResult = await processRevenueCatWebhookEvent(poisonAttempt, { ...db, now });
    expect(poisonResult.body.reason).toBe('quarantined_future_timestamp');
    expect(db.calls).toHaveLength(0);
    expect(db.store.has(`apple:${originalTransactionId}`)).toBe(false); // nothing was ever written - no poisoned value exists to beat.

    // A perfectly ordinary, real, LATER event for the same transaction
    // must still be accepted normally - it is not fighting a poisoned
    // stored value, because none was ever created.
    const laterValidEvent = {
      type: 'RENEWAL',
      period_type: 'NORMAL',
      original_transaction_id: originalTransactionId,
      store: 'APP_STORE',
      app_user_id: APP_USER_ID,
      id: 'evt-real-later',
      event_timestamp_ms: Date.parse('2026-10-21T00:00:00Z'),
      expiration_at_ms: FUTURE_EXPIRY_MS
    };
    const laterResult = await processRevenueCatWebhookEvent(laterValidEvent, { ...db, now: new Date('2026-10-21T00:05:00Z') });
    expect(laterResult.body.processed).toBe(true);
    expect(db.calls).toHaveLength(1);
    const stored = db.store.get(`apple:${originalTransactionId}`);
    expect(stored.args.p_event_type).toBe('RENEWAL');
    expect(stored.lastVerifiedAt).toBe(new Date(laterValidEvent.event_timestamp_ms).toISOString());
  });

  // "Preserve valid delayed events" at the handler level: a genuinely
  // old/delayed event (far in the past relative to `now`, e.g. a backlog
  // being drained after an outage) must be applied normally, exactly
  // like any other validly-timestamped event - delay alone is never a
  // quarantine reason.
  it('a significantly delayed but genuinely valid event (event_timestamp_ms far in the past) is applied normally, never quarantined', async () => {
    const db = makeFakeDb();
    const now = new Date('2026-10-20T00:00:00Z');
    const delayedEvent = {
      type: 'RENEWAL',
      period_type: 'NORMAL',
      original_transaction_id: 'txn-delayed',
      store: 'APP_STORE',
      app_user_id: APP_USER_ID,
      id: 'evt-delayed',
      event_timestamp_ms: now.getTime() - 6 * 60 * 60 * 1000, // 6 hours delayed.
      expiration_at_ms: FUTURE_EXPIRY_MS
    };
    const result = await processRevenueCatWebhookEvent(delayedEvent, { ...db, now });
    expect(result.body.processed).toBe(true);
    expect(db.calls).toHaveLength(1);
    const stored = db.store.get(`apple:${delayedEvent.original_transaction_id}`);
    expect(stored.lastVerifiedAt).toBe(new Date(delayedEvent.event_timestamp_ms).toISOString());
  });
});

describe('processRevenueCatWebhookEvent - invalid/missing expiration_at_ms is QUARANTINED, never applied with null/guessed data (SUB-21/ST-29 fix)', () => {
  it('a missing expiration_at_ms is quarantined: the RPC is NEVER called, onExpirationQuarantined fires, and the response says so explicitly', async () => {
    const db = makeFakeDb();
    const onExpirationQuarantined = vi.fn();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-no-expiry', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-no-expiry', event_timestamp_ms: 1697451462232 };
    const result = await processRevenueCatWebhookEvent(event, { ...db, onExpirationQuarantined });
    expect(result).toEqual({ status: 200, body: { received: true, processed: false, reason: 'quarantined_invalid_expiration' } });
    expect(db.calls).toHaveLength(0); // the RPC is never invoked for a quarantined event.
    expect(onExpirationQuarantined).toHaveBeenCalledTimes(1);
    expect(onExpirationQuarantined).toHaveBeenCalledWith(event);
  });

  // THE DEMONSTRATED DEFECT THIS FIX CLOSES, exercised through the FULL
  // real handler (not just the isolated resolveEventExpiresAt unit above):
  // before this fix, this exact event shape threw an uncaught RangeError
  // inside buildApplyVerifiedEventArgs, reproduced directly beforehand -
  // not assumed. A genuinely reachable malformed-JSON-payload shape (an
  // ordinary number, just wildly out of range), not a synthetic NaN/
  // Infinity value.
  it('an out-of-range numeric expiration_at_ms never throws through the real handler - quarantined the same way as missing', async () => {
    const db = makeFakeDb();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-bad-expiry', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-bad-expiry', event_timestamp_ms: 1697451462232, expiration_at_ms: 1e20 };
    await expect(processRevenueCatWebhookEvent(event, db)).resolves.not.toThrow();
    const result = await processRevenueCatWebhookEvent({ ...event, id: 'evt-bad-expiry-2' }, db);
    expect(result.body.reason).toBe('quarantined_invalid_expiration');
    expect(db.calls).toHaveLength(0);
  });

  it('a non-numeric/non-finite expiration_at_ms is quarantined the same way', async () => {
    for (const malformedMs of ['not-a-number', NaN, Infinity, null, -1e20]) {
      const db = makeFakeDb();
      const event = { type: 'CANCELLATION', period_type: 'NORMAL', original_transaction_id: 'txn-expiry-malformed', store: 'APP_STORE', app_user_id: APP_USER_ID, id: `evt-expiry-malformed-${String(malformedMs)}`, event_timestamp_ms: 1697451462232, expiration_at_ms: malformedMs };
      const result = await processRevenueCatWebhookEvent(event, db);
      expect(result.body.reason).toBe('quarantined_invalid_expiration');
      expect(db.calls).toHaveLength(0);
    }
  });

  it('a valid expiration_at_ms (past or future) never triggers expiration quarantine or the hook', async () => {
    const db = makeFakeDb();
    const onExpirationQuarantined = vi.fn();
    for (const [label, ms] of [['past', Date.parse('2020-01-01T00:00:00Z')], ['future', Date.parse('2099-01-01T00:00:00Z')]]) {
      const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: `txn-valid-expiry-${label}`, store: 'APP_STORE', app_user_id: APP_USER_ID, id: `evt-valid-expiry-${label}`, event_timestamp_ms: 1697451462232, expiration_at_ms: ms };
      const result = await processRevenueCatWebhookEvent(event, { ...db, onExpirationQuarantined });
      expect(result.body.processed).toBe(true);
    }
    expect(onExpirationQuarantined).not.toHaveBeenCalled();
  });

  it('an expiration-quarantined event is still recorded to provider_events for idempotency, and a genuine insert failure (not a duplicate) still surfaces as a 500', async () => {
    const db = makeFakeDb();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-expiry-quarantine-insert-fail', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-expiry-q-fail', event_timestamp_ms: 1697451462232 };
    const ok = await processRevenueCatWebhookEvent(event, db);
    expect(ok.body.reason).toBe('quarantined_invalid_expiration');
    expect(db.insertProviderEvent).toHaveBeenCalledTimes(1);

    const dbFailing = makeFakeDb();
    dbFailing.insertProviderEvent = vi.fn(async () => ({ error: { code: '08006', message: 'connection failure' } }));
    const failed = await processRevenueCatWebhookEvent({ ...event, id: 'evt-expiry-q-fail-2' }, dbFailing);
    expect(failed.status).toBe(500);
  });

  // THE EXACT RISK NAMED IN THIS FIX'S OWN INSTRUCTION: an event with an
  // invalid expiry must never overwrite an already-stored, genuinely
  // correct subscription using guessed/null data. Mirrors the equivalent
  // timestamp-quarantine overwrite-prevention test above.
  it('CONFIRMED: an event with an invalid expiry can never overwrite an already-applied valid subscription record, because it is never even sent to the RPC', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-expiry-cannot-overwrite';
    const validRenewal = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-expiry-valid', event_timestamp_ms: 1697451462232, expiration_at_ms: Date.parse('2027-01-01T00:00:00Z') };
    const laterBadExpiry = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-expiry-bad', event_timestamp_ms: 1697451462232 + 1000, expiration_at_ms: 1e20 };

    await processRevenueCatWebhookEvent(validRenewal, db);
    const result = await processRevenueCatWebhookEvent(laterBadExpiry, db);

    expect(result.body.reason).toBe('quarantined_invalid_expiration');
    expect(db.calls).toHaveLength(1); // only the valid renewal ever reached the RPC.
    const stored = db.store.get(`apple:${originalTransactionId}`);
    expect(stored.args.p_current_period_expires_at).toBe(new Date(Date.parse('2027-01-01T00:00:00Z')).toISOString()); // untouched by the quarantined event - never overwritten with null or a guessed value.
  });

  it('does not affect the RPC-level provider=manual NULL-expiry exception - this path only ever builds apple/google RPC calls, confirmed by which RPC function gets invoked', async () => {
    const db = makeFakeDb();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-manual-unrelated', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-manual-unrelated', event_timestamp_ms: 1697451462232, expiration_at_ms: Date.parse('2027-01-01T00:00:00Z') };
    const result = await processRevenueCatWebhookEvent(event, db);
    expect(result.body.processed).toBe(true);
    // This fix only ever reaches buildApplyVerifiedEventArgs's existing
    // apple/google branches (see that function's own header) - there is
    // no third branch, so the RPC-level provider='manual' NULL-expiry
    // exception (a separate, admin-only grant mechanism) is structurally
    // unreachable from this webhook regardless of this fix.
    expect(db.calls[0].provider).toBe('apple');
  });
});

describe('processRevenueCatWebhookEvent - compatibility with existing processing-time rows and Apple-direct signedDate values', () => {
  it('a new, validly-timestamped event comfortably later than an old PROCESSING-TIME-based stored value is still accepted - the normal, expected case', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-compat-normal';
    // Simulate a row written under the OLD (pre-fix) processing-time
    // rule - a real ISO string, not derived from any event_timestamp_ms.
    db.store.set(`apple:${originalTransactionId}`, {
      lastVerifiedAt: '2026-10-17T06:42:25.861Z',
      args: { p_event_type: 'RENEWAL', p_status: 'active' }
    });

    // Explicit `now`, safely after this event's own timestamp, so this
    // test is deterministic regardless of the real wall clock whenever
    // it actually runs (and never accidentally exercises the UNRELATED
    // future-timestamp tolerance check this same module also enforces).
    const now = new Date('2026-10-18T07:00:00Z');
    const newEvent = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-new', event_timestamp_ms: Date.parse('2026-10-18T06:40:00Z'), expiration_at_ms: FUTURE_EXPIRY_MS };
    await processRevenueCatWebhookEvent(newEvent, { ...db, now });

    const stored = db.store.get(`apple:${originalTransactionId}`);
    expect(stored.args.p_event_type).toBe('RENEWAL');
    expect(stored.lastVerifiedAt).toBe(new Date(newEvent.event_timestamp_ms).toISOString());
  });

  // Disclosed transition risk (see resolveEventVerifiedAt's own header),
  // confirmed here rather than left as an unverified claim: a new,
  // validly-timestamped event whose real event_timestamp_ms happens to
  // be EARLIER than an old row's stored processing-time value is
  // correctly rejected as stale by the unchanged RPC staleness rule -
  // this is the known, disclosed edge case, not a new bug introduced by
  // this fix, and it fails CLOSED (rejects a write) rather than
  // corrupting data.
  it('DISCLOSED RISK: a new valid event whose real time is earlier than an old processing-time-based stored value is rejected as stale - known, not a data-corruption bug', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-compat-edge';
    const processingTimeStoredAt = '2026-10-18T06:42:25.861Z';
    db.store.set(`apple:${originalTransactionId}`, {
      lastVerifiedAt: processingTimeStoredAt,
      args: { p_event_type: 'RENEWAL', p_status: 'active' }
    });

    // A real event whose own event_timestamp_ms is a few seconds BEFORE
    // the stored processing-time value (e.g. normal processing lag on
    // the earlier write).
    const newEvent = {
      type: 'PRODUCT_CHANGE',
      period_type: 'NORMAL',
      original_transaction_id: originalTransactionId,
      store: 'APP_STORE',
      app_user_id: APP_USER_ID,
      id: 'evt-edge',
      event_timestamp_ms: Date.parse(processingTimeStoredAt) - 2000,
      expiration_at_ms: FUTURE_EXPIRY_MS
    };
    await processRevenueCatWebhookEvent(newEvent, db);

    const stored = db.store.get(`apple:${originalTransactionId}`);
    // Still the OLD row - the new event was correctly rejected as stale
    // by the comparison, exactly as documented (fails closed, not
    // silently reinterpreted as harmless - this is reported, not hidden).
    expect(stored.args.p_event_type).toBe('RENEWAL');
    expect(stored.lastVerifiedAt).toBe(processingTimeStoredAt);
  });

  it('compatible with the Apple-direct path\'s own ordering basis (transaction.signedDate, applyVerifiedAppleTransaction.ts) for the same transaction - direct-path-first, RevenueCat-event-second', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-compat-apple-direct';
    // Simulates applyVerifiedAppleTransaction.ts's own write, using
    // Apple's real JWS-signed transaction.signedDate as last_verified_at
    // (see that file's own p_last_verified_at construction) - a real
    // event-time basis, same category as event_timestamp_ms, just from
    // a different verified source.
    const signedDateIso = new Date('2026-10-18T06:00:00.000Z').toISOString();
    db.store.set(`apple:${originalTransactionId}`, {
      lastVerifiedAt: signedDateIso,
      args: { p_event_type: 'server_verify_transaction', p_status: 'active' }
    });

    // Explicit `now`, same reasoning as the test above - deterministic,
    // and safely past this event's own timestamp.
    const now = new Date('2026-10-19T07:00:00Z');
    const laterRevenueCatEvent = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-after-direct', event_timestamp_ms: Date.parse('2026-10-19T06:40:11Z'), expiration_at_ms: FUTURE_EXPIRY_MS };
    await processRevenueCatWebhookEvent(laterRevenueCatEvent, { ...db, now });

    const stored = db.store.get(`apple:${originalTransactionId}`);
    expect(stored.args.p_event_type).toBe('RENEWAL');
    expect(stored.lastVerifiedAt).toBe(new Date(laterRevenueCatEvent.event_timestamp_ms).toISOString());
  });

  it('compatible in the reverse order too - a RevenueCat event first, then a later Apple-direct signedDate-based reconciliation write', async () => {
    const db = makeFakeDb();
    const originalTransactionId = 'txn-compat-apple-direct-reverse';
    // Explicit `now`, same reasoning as the two tests above - this test
    // must stay deterministic and never depend on whatever the real
    // wall clock happens to be when it runs.
    const rcEvent = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: originalTransactionId, store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-rc-first', event_timestamp_ms: Date.parse('2026-10-18T06:40:11Z'), expiration_at_ms: FUTURE_EXPIRY_MS };
    await processRevenueCatWebhookEvent(rcEvent, { ...db, now: new Date('2026-10-18T07:00:00Z') });

    // A later, real reconciliation write using Apple's own signedDate,
    // genuinely after the RevenueCat event above.
    const laterSignedDateIso = new Date('2026-10-19T07:00:00.000Z').toISOString();
    const { error } = await db.callApplyVerifiedEvent('apple', {
      p_apple_original_transaction_id: originalTransactionId,
      p_last_verified_at: laterSignedDateIso,
      p_event_type: 'server_verify_transaction',
      p_status: 'active'
    });
    expect(error).toBeNull();

    const stored = db.store.get(`apple:${originalTransactionId}`);
    expect(stored.args.p_event_type).toBe('server_verify_transaction');
    expect(stored.lastVerifiedAt).toBe(laterSignedDateIso);
  });
});

describe('processRevenueCatWebhookEvent - refund cancellation (fix 2, end to end)', () => {
  it('a CUSTOMER_SUPPORT-reason CANCELLATION calls the RPC with p_cancel_at_period_end: null, never true', async () => {
    const db = makeFakeDb();
    const event = { type: 'CANCELLATION', period_type: 'NORMAL', cancel_reason: 'CUSTOMER_SUPPORT', original_transaction_id: 'txn-refund', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-refund', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };
    await processRevenueCatWebhookEvent(event, db);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].args.p_cancel_at_period_end).toBeNull();
  });

  it('an ordinary UNSUBSCRIBE-reason CANCELLATION still calls the RPC with p_cancel_at_period_end: true, unchanged', async () => {
    const db = makeFakeDb();
    const event = { type: 'CANCELLATION', period_type: 'NORMAL', cancel_reason: 'UNSUBSCRIBE', original_transaction_id: 'txn-voluntary', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-voluntary', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };
    await processRevenueCatWebhookEvent(event, db);
    expect(db.calls[0].args.p_cancel_at_period_end).toBe(true);
  });
});

describe('processRevenueCatWebhookEvent - REFUND_REVERSED (fix 3, before/after expiry)', () => {
  it('a reversal with a future expiration_at_ms is passed through with that real future expiry - access restoration is then the RPC/entitlement-guard\'s own decision, not fabricated here', async () => {
    const db = makeFakeDb();
    const futureMs = Date.parse('2099-01-01T00:00:00Z');
    const event = { type: 'REFUND_REVERSED', period_type: 'NORMAL', original_transaction_id: 'txn-reversed-future', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-reversed-future', event_timestamp_ms: 1697451462232, expiration_at_ms: futureMs };
    await processRevenueCatWebhookEvent(event, db);
    expect(db.calls[0].args.p_status).toBe('active');
    expect(db.calls[0].args.p_current_period_expires_at).toBe(new Date(futureMs).toISOString());
    expect(db.calls[0].args.p_cancel_at_period_end).toBeNull();
  });

  it('a reversal with a PAST expiration_at_ms (the period already lapsed again by the time it was reversed) still carries that real past expiry through unmodified - never rewritten to "now" or cleared to imply restored access', async () => {
    const db = makeFakeDb();
    const pastMs = Date.parse('2020-01-01T00:00:00Z');
    const event = { type: 'REFUND_REVERSED', period_type: 'NORMAL', original_transaction_id: 'txn-reversed-past', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-reversed-past', event_timestamp_ms: 1697451462232, expiration_at_ms: pastMs };
    await processRevenueCatWebhookEvent(event, db);
    expect(db.calls[0].args.p_status).toBe('active');
    expect(db.calls[0].args.p_current_period_expires_at).toBe(new Date(pastMs).toISOString());
    // This handler never second-guesses the real expiry - whether the
    // RPC's own expiry guard then grants or withholds access is covered
    // by entitlementResolution.manualGrantExpiry.test.js and the RPC's
    // own migration, not re-tested here.
  });

  it('REFUND_REVERSED preserves the existing cancellation preference (null), it does not clear a prior cancel_at_period_end=true', async () => {
    const db = makeFakeDb();
    const event = { type: 'REFUND_REVERSED', period_type: 'NORMAL', original_transaction_id: 'txn-reversed-preserve', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-reversed-preserve', event_timestamp_ms: 1697451462232, expiration_at_ms: Date.parse('2099-01-01T00:00:00Z') };
    await processRevenueCatWebhookEvent(event, db);
    expect(db.calls[0].args.p_cancel_at_period_end).toBeNull();
  });
});

describe('processRevenueCatWebhookEvent - cross-provider independence', () => {
  it('an Apple event and a Google event are routed to their own RPCs with their own shaped args, never cross-contaminated', async () => {
    const db = makeFakeDb();
    const appleEvent = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'apple-txn-1', store: 'APP_STORE', app_user_id: APP_USER_ID, id: 'evt-apple', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };
    const googleEvent = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'GPA.order-1', store: 'PLAY_STORE', app_user_id: APP_USER_ID, id: 'evt-google', event_timestamp_ms: 1697451462232, expiration_at_ms: FUTURE_EXPIRY_MS };

    await processRevenueCatWebhookEvent(appleEvent, db);
    await processRevenueCatWebhookEvent(googleEvent, db);

    expect(db.calls).toHaveLength(2);
    const [appleCall, googleCall] = db.calls;
    expect(appleCall.provider).toBe('apple');
    expect(appleCall.args).toHaveProperty('p_apple_original_transaction_id', 'apple-txn-1');
    expect(appleCall.args).not.toHaveProperty('p_google_purchase_token');

    expect(googleCall.provider).toBe('google');
    expect(googleCall.args).toHaveProperty('p_google_purchase_token', 'GPA.order-1');
    expect(googleCall.args).not.toHaveProperty('p_apple_original_transaction_id');
  });

  it('an event for a non-UUID / anonymous app_user_id is acknowledge-only and never reaches either RPC, regardless of provider', async () => {
    const db = makeFakeDb();
    const event = { type: 'RENEWAL', period_type: 'NORMAL', original_transaction_id: 'txn-anon', store: 'APP_STORE', app_user_id: '$RCAnonymousID:abc123', id: 'evt-anon' };
    const result = await processRevenueCatWebhookEvent(event, db);
    expect(result.body.processed).toBe(true);
    expect(db.calls).toHaveLength(0);
    expect(db.insertProviderEvent).toHaveBeenCalledTimes(1);
  });
});

describe('looksLikeSupabaseUuid', () => {
  it('accepts a real UUID shape and rejects a RevenueCat anonymous id', () => {
    expect(looksLikeSupabaseUuid(APP_USER_ID)).toBe(true);
    expect(looksLikeSupabaseUuid('$RCAnonymousID:abc123')).toBe(false);
    expect(looksLikeSupabaseUuid(undefined)).toBe(false);
  });
});
