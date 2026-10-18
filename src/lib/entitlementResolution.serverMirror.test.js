import { describe, it, expect } from 'vitest';
import { resolveEntitlement as clientResolve, isCurrentlyAccessGranting as clientIsGranting } from './entitlementResolution.js';
import {
  resolveEntitlement as serverResolve,
  isCurrentlyAccessGranting as serverIsGranting
} from '../../supabase/functions/_shared/entitlementResolution.ts';

// RETARGETED (client expiry-guard fix): this file used to assert that the
// server's `resolveEntitlement` and the client's `resolveEntitlement`
// never drift apart. That invariant is now intentionally FALSE — the
// client's resolveEntitlement was deliberately changed to apply the
// expiry guard (isCurrentlyAccessGranting) so the display layer matches
// the real authorization boundary (see entitlementResolution.js's own
// header); the server's bare resolveEntitlement was deliberately left
// unchanged (it feeds nothing live — see that file's own header, "kept
// only for its own tests and any other still-legacy-only caller" is no
// longer even true; grep confirms no caller remains) and is a stricter
// subset by construction once the server's own isCurrentlyAccessGranting
// exists. Asserting the two STILL agreed would just pin the bug back in.
//
// The actually meaningful cross-implementation invariant now is: the
// client's NEW isCurrentlyAccessGranting (this fix) and the server's
// EXISTING isCurrentlyAccessGranting (already deployed, already the real
// media-authorization boundary — get-beta-video-url v34) must never
// silently drift apart on the one question both sides actually ask: "is
// this single record, by itself, currently valid." That per-record
// question is the whole surface area worth pinning here; each side's own
// separate multi-record policy (display's tie-break vs. authorization's
// pure OR) is tested in its own file and is out of scope for this one.
describe('client isCurrentlyAccessGranting mirrors the deployed server guard exactly', () => {
  const NOW = new Date('2026-10-18T00:00:00Z');

  const cases = [
    { provider: 'stripe', status: 'expired', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' },
    { provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' },
    { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' },
    { provider: 'google', status: 'active', currentPeriodExpiresAt: null },
    { provider: 'manual', status: 'active', currentPeriodExpiresAt: null },
    { provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' },
    { provider: 'manual', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' },
    { provider: 'apple', status: 'grace_period', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' },
    { provider: 'apple', status: 'grace_period', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' },
    { provider: 'apple', status: 'billing_retry', currentPeriodExpiresAt: null },
    { provider: 'apple', status: 'refunded', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' },
    { provider: 'stripe', status: 'active', currentPeriodExpiresAt: 'not-a-date' }
  ];

  it.each(cases)('agrees for input %#', (record) => {
    expect(clientIsGranting(record, NOW)).toBe(serverIsGranting(record, NOW));
  });
});

// Kept, unmodified in spirit: resolveEntitlement on both sides still
// agree for the subset of inputs where expiry is a non-issue (every
// record either has a far-future expiry or is already status-excluded) —
// proves the fix didn't change anything about status-only agreement
// where expiry was never going to matter.
describe('resolveEntitlement — client and server still agree when expiry is not the deciding factor', () => {
  const cases = [
    [],
    [null, undefined],
    [{ provider: 'stripe', status: 'expired', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }],
    [{ provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z', lastVerifiedAt: '2026-09-01T00:00:00Z' }],
    [{ provider: 'apple', status: 'refunded' }, { provider: 'stripe', status: 'revoked' }]
  ];

  it.each(cases)('agrees for input %#', (input) => {
    const server = serverResolve(input);
    const client = clientResolve(input);
    expect(server.plan).toBe(client.plan);
    expect(server.status).toBe(client.status);
    expect(server.activeProvider).toBe(client.activeProvider);
    expect(server.expiresAt).toBe(client.expiresAt);
  });
});
