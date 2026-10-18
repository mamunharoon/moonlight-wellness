// ============================================================================
// SIMULATED COVERAGE — NOT LIVE DATABASE EXECUTION.
//
// Every assertion in this file runs against a hand-transcribed JS MIRROR
// of apply_verified_apple_subscription_event/
// apply_verified_google_subscription_event's own SQL
// (supabase/migrations/20261018040000_entitlements_expiry_guard.sql,
// applied and live-verified on DEV), defined below in this same file. NO
// call in this file ever reaches Postgres, Supabase, or any network — it
// is Vitest exercising a local re-implementation of the rule, not the
// real RPC. This goes one level deeper than argument forwarding (already
// covered by revenueCatWebhookHandler.test.js's own
// buildApplyVerifiedEventArgs tests, which verify what WOULD be sent to
// the real RPC) by also re-implementing what that RPC does WITH those
// arguments — but it remains a simulation, and must be read as evidence
// about the mirror's own logic, re-verified against the migration file
// text, not as a live-database test result.
//
// Why a mirror, not the real function: no local Postgres/Docker is
// available in this environment (confirmed — `supabase functions
// download` reports "Docker is not running"), and creating disposable
// rows against the real DEV database would require a real auth.users
// row (provider_subscriptions.user_id has an FK to auth.users), which
// this task does not authorise. The mirror below is transcribed
// statement-for-statement from the applied migration file — every
// COALESCE, every WHERE clause, every ORDER BY — re-verified against
// that file immediately before writing this module, not from memory
// alone. It is not a redesign or a simplification of the rule; it is
// the intended behaviour of that rule, executed in Vitest instead of
// Postgres. A genuine live-database integration test, if ever wanted,
// would require either a local Supabase stack (Docker) or a disposable
// auth user on a real project — neither available/authorised here.
// ============================================================================
import { describe, it, expect } from 'vitest';

// Mirrors the UPSERT's own COALESCE semantics exactly:
//   INSERT ... VALUES (..., COALESCE(p_cancel_at_period_end, false), ...)
//   ON CONFLICT DO UPDATE SET
//     cancel_at_period_end = COALESCE(p_cancel_at_period_end, public.provider_subscriptions.cancel_at_period_end),
//     status = excluded.status,                      -- direct, no COALESCE
//     current_period_expires_at = excluded.current_period_expires_at,  -- direct
//     last_verified_at = excluded.last_verified_at,   -- = COALESCE(p_last_verified_at, now()) from the VALUES list
const upsertProviderSubscription = (existingRow, args, now) => {
  const insertedLastVerifiedAt = args.p_last_verified_at ?? now.toISOString();
  if (!existingRow) {
    return {
      provider: args.provider,
      status: args.p_status,
      expires_at: args.p_current_period_expires_at,
      cancel_at_period_end: args.p_cancel_at_period_end ?? false,
      last_verified_at: insertedLastVerifiedAt
    };
  }
  return {
    provider: args.provider,
    status: args.p_status, // excluded.status - direct, never COALESCEd
    expires_at: args.p_current_period_expires_at, // excluded.current_period_expires_at - direct
    cancel_at_period_end: args.p_cancel_at_period_end ?? existingRow.cancel_at_period_end, // COALESCE(p_cancel_at_period_end, existing)
    last_verified_at: insertedLastVerifiedAt // excluded.last_verified_at
  };
};

// Mirrors the staleness guard exactly:
//   IF v_existing_verified_at IS NOT NULL AND p_last_verified_at IS NOT NULL
//      AND v_existing_verified_at >= p_last_verified_at THEN stale_event
const isStaleWrite = (existingRow, args) => {
  if (existingRow?.last_verified_at == null || args.p_last_verified_at == null) return false;
  return existingRow.last_verified_at >= args.p_last_verified_at;
};

// Mirrors the entitlements recompute CTE exactly:
//   granting: status IN ('trial','active','grace_period','billing_retry')
//     AND ((expires_at IS NULL AND provider='manual') OR (expires_at IS NOT NULL AND expires_at > now()))
//   winner: ORDER BY verified_at DESC NULLS LAST LIMIT 1
const ACCESS_GRANTING_STATUSES = ['trial', 'active', 'grace_period', 'billing_retry'];
const isGranting = (candidate, now) => {
  if (!ACCESS_GRANTING_STATUSES.includes(candidate.status)) return false;
  if (candidate.expires_at == null) return candidate.provider === 'manual';
  return new Date(candidate.expires_at).getTime() > now.getTime();
};

const recomputeEntitlements = (candidates, now) => {
  const granting = candidates.filter((c) => isGranting(c, now));
  if (granting.length === 0) {
    return { plan: 'free', status: 'active', active_provider: null, expires_at: null, cancel_at_period_end: false };
  }
  // NULLS LAST, most recent wins - verified_at is always present in these
  // tests (every fixture supplies last_verified_at), so NULLS LAST
  // ordering is exercised implicitly, not the focus here.
  const winner = [...granting].sort((a, b) => new Date(b.verified_at ?? 0).getTime() - new Date(a.verified_at ?? 0).getTime())[0];
  return {
    plan: 'plus',
    status: winner.status,
    active_provider: winner.provider,
    expires_at: winner.expires_at,
    cancel_at_period_end: winner.cancel_at_period_end ?? false
  };
};

// End-to-end: apply one RPC call's args against one existing row, then
// recompute entitlements from the full candidate set (this row plus
// whatever OTHER rows are passed in) - exactly the two things the real
// RPC does in sequence, inside one transaction.
const applyAndRecompute = ({ existingRow, args, now, otherCandidates = [] }) => {
  if (isStaleWrite(existingRow, args)) {
    return { applied: false, reason: 'stale_event', row: existingRow, entitlements: null };
  }
  const row = upsertProviderSubscription(existingRow, args, now);
  const candidateRow = { ...row, verified_at: row.last_verified_at };
  const entitlements = recomputeEntitlements([candidateRow, ...otherCandidates], now);
  return { applied: true, reason: 'applied', row, entitlements };
};

describe('[SIMULATED, NOT LIVE DB] REFUND_REVERSED through a mirror of the RPC upsert + entitlements recompute logic (not only argument forwarding)', () => {
  const now = new Date('2026-10-19T00:00:00Z');

  it('a reversal with a FUTURE expiry restores access, and the PRESERVED (not reset) cancel_at_period_end propagates all the way into entitlements', () => {
    // Existing row: a prior CANCELLATION already set
    // cancel_at_period_end=true; a later EXPIRATION set status='expired'.
    const existingRow = {
      provider: 'apple',
      status: 'expired',
      expires_at: '2026-10-17T00:00:00Z',
      cancel_at_period_end: true,
      last_verified_at: '2026-10-17T00:05:00Z'
    };
    // The REFUND_REVERSED event's own RPC args: status 'active' (from
    // period_type), cancel_at_period_end NULL (preserve - fix 2's own
    // pattern applied to fix 3), a real future expiry.
    const args = {
      provider: 'apple',
      p_status: 'active',
      p_current_period_expires_at: '2099-01-01T00:00:00Z',
      p_cancel_at_period_end: null,
      p_last_verified_at: '2026-10-19T00:00:00Z'
    };

    const result = applyAndRecompute({ existingRow, args, now });

    expect(result.applied).toBe(true);
    expect(result.row.cancel_at_period_end).toBe(true); // preserved from existingRow, not reset to false.
    expect(result.row.status).toBe('active');
    expect(result.row.expires_at).toBe('2099-01-01T00:00:00Z');

    expect(result.entitlements.plan).toBe('plus'); // access genuinely restored.
    expect(result.entitlements.active_provider).toBe('apple');
    expect(result.entitlements.expires_at).toBe('2099-01-01T00:00:00Z');
    expect(result.entitlements.cancel_at_period_end).toBe(true); // propagated through to the projection too.
  });

  it('a reversal with a PAST expiry (the period already re-lapsed by the time it was reversed) does NOT restore access, despite status becoming active again', () => {
    const existingRow = {
      provider: 'apple',
      status: 'expired',
      expires_at: '2020-01-01T00:00:00Z',
      cancel_at_period_end: true,
      last_verified_at: '2020-01-02T00:00:00Z'
    };
    const args = {
      provider: 'apple',
      p_status: 'active',
      p_current_period_expires_at: '2020-06-01T00:00:00Z', // a real, but already-past, expiry.
      p_cancel_at_period_end: null,
      p_last_verified_at: '2026-10-19T00:00:00Z'
    };

    const result = applyAndRecompute({ existingRow, args, now });

    expect(result.applied).toBe(true);
    expect(result.row.status).toBe('active'); // the row itself says active...
    expect(result.entitlements.plan).toBe('free'); // ...but access is correctly NOT restored, because expiry says otherwise.
    expect(result.entitlements.active_provider).toBeNull();
  });

  it('cross-provider: a reversal that fails to restore its OWN access (past expiry) never suppresses a separately-valid provider', () => {
    const existingAppleRow = {
      provider: 'apple',
      status: 'expired',
      expires_at: '2020-01-01T00:00:00Z',
      cancel_at_period_end: true,
      last_verified_at: '2020-01-02T00:00:00Z'
    };
    const reversalArgs = {
      provider: 'apple',
      p_status: 'active',
      p_current_period_expires_at: '2020-06-01T00:00:00Z',
      p_cancel_at_period_end: null,
      p_last_verified_at: '2026-10-19T00:00:00Z'
    };
    const validGoogleRow = {
      provider: 'google',
      status: 'active',
      expires_at: '2099-01-01T00:00:00Z',
      cancel_at_period_end: false,
      verified_at: '2026-10-18T00:00:00Z'
    };

    const result = applyAndRecompute({ existingRow: existingAppleRow, args: reversalArgs, now, otherCandidates: [validGoogleRow] });

    expect(result.entitlements.plan).toBe('plus');
    expect(result.entitlements.active_provider).toBe('google'); // the genuinely valid provider wins, unaffected by the apple reversal's own failure to restore.
  });

  it('a stale (out-of-order) REFUND_REVERSED is rejected before ever reaching the upsert - the existing row is untouched', () => {
    const existingRow = {
      provider: 'apple',
      status: 'active',
      expires_at: '2099-01-01T00:00:00Z',
      cancel_at_period_end: false,
      last_verified_at: '2026-10-19T12:00:00Z'
    };
    const staleReversalArgs = {
      provider: 'apple',
      p_status: 'active',
      p_current_period_expires_at: '2020-01-01T00:00:00Z',
      p_cancel_at_period_end: null,
      p_last_verified_at: '2026-10-19T06:00:00Z' // earlier than the existing row's own last_verified_at.
    };

    const result = applyAndRecompute({ existingRow, args: staleReversalArgs, now });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('stale_event');
    expect(result.row).toEqual(existingRow); // completely untouched.
  });

  it('a REFUND_REVERSED with a null expiry on a recurring provider does not restore access (same fail-closed rule as every other recurring-provider event)', () => {
    const existingRow = {
      provider: 'google',
      status: 'expired',
      expires_at: '2020-01-01T00:00:00Z',
      cancel_at_period_end: true,
      last_verified_at: '2020-01-02T00:00:00Z'
    };
    const args = {
      provider: 'google',
      p_status: 'active',
      p_current_period_expires_at: null,
      p_cancel_at_period_end: null,
      p_last_verified_at: '2026-10-19T00:00:00Z'
    };

    const result = applyAndRecompute({ existingRow, args, now });
    expect(result.entitlements.plan).toBe('free'); // null expiry on google -> never grants, exactly like any other recurring-provider event.
  });
});
