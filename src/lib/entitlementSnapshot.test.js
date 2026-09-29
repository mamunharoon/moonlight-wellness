// WakeWise Phase 2B — entitlementSnapshot.js. Real execution against a
// fake Supabase client (same convention as rhythmPersistence.test.js) —
// no live network call, but real behavioural coverage of the actual
// query-building/mapping/error-handling logic.
import { describe, it, expect, vi } from 'vitest';
import { fetchEntitlementRecords } from './entitlementSnapshot';

// A minimal fake mirroring exactly the chain this module calls:
// supabase.from(table).select(cols).eq('user_id', id).maybeSingle() for
// `subscriptions`, and the same without .maybeSingle() for
// `provider_subscriptions` (a plain array-returning query).
const makeFakeSupabase = ({ legacyResult, providerResult }) => ({
  from: (table) => {
    if (table === 'subscriptions') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => legacyResult
          })
        })
      };
    }
    if (table === 'provider_subscriptions') {
      return {
        select: () => ({
          eq: async () => providerResult
        })
      };
    }
    throw new Error(`unexpected table: ${table}`);
  }
});

describe('fetchEntitlementRecords — no client / no user', () => {
  it('returns an empty, error-free result rather than throwing', async () => {
    expect(await fetchEntitlementRecords(null, 'user-1')).toEqual({ records: [], error: null });
    expect(await fetchEntitlementRecords({}, null)).toEqual({ records: [], error: null });
  });
});

describe('fetchEntitlementRecords — legacy subscriptions row', () => {
  it('a free-plan legacy row contributes no candidate record - it could never win anyway', async () => {
    const supabase = makeFakeSupabase({
      legacyResult: { data: { plan: 'free', status: 'active', provider: 'manual', expires_at: null, cancel_at_period_end: false }, error: null },
      providerResult: { data: [], error: null }
    });
    const { records, error } = await fetchEntitlementRecords(supabase, 'user-1');
    expect(error).toBeNull();
    expect(records).toEqual([]);
  });

  it('a plus-plan legacy row maps to a real candidate record, with the current read time as its verified-at approximation', async () => {
    const supabase = makeFakeSupabase({
      legacyResult: { data: { plan: 'plus', status: 'active', provider: 'stripe', expires_at: '2026-07-01T00:00:00Z', cancel_at_period_end: true }, error: null },
      providerResult: { data: [], error: null }
    });
    const { records, error } = await fetchEntitlementRecords(supabase, 'user-1');
    expect(error).toBeNull();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provider: 'stripe',
      status: 'active',
      productId: null,
      currentPeriodExpiresAt: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: true
    });
    expect(typeof records[0].lastVerifiedAt).toBe('string');
  });

  it('a missing subscriptions table is treated as "no legacy record," never a hard failure', async () => {
    const supabase = makeFakeSupabase({
      legacyResult: { data: null, error: { code: '42P01', message: 'relation "subscriptions" does not exist' } },
      providerResult: { data: [], error: null }
    });
    const { records, error } = await fetchEntitlementRecords(supabase, 'user-1');
    expect(error).toBeNull();
    expect(records).toEqual([]);
  });

  it('a genuine (non-missing-table) legacy read error surfaces honestly, never silently swallowed', async () => {
    const supabase = makeFakeSupabase({
      legacyResult: { data: null, error: { code: '42501', message: 'permission denied' } },
      providerResult: { data: [], error: null }
    });
    const { records, error } = await fetchEntitlementRecords(supabase, 'user-1');
    expect(error).toBe('permission denied');
    expect(records).toEqual([]);
  });
});

describe('fetchEntitlementRecords — provider_subscriptions rows', () => {
  it('maps every row (Apple and Google both present) into real candidate records', async () => {
    const supabase = makeFakeSupabase({
      legacyResult: { data: null, error: null },
      providerResult: {
        data: [
          { provider: 'apple', status: 'active', product_id: 'com.zavaraai.wakewise.plus.monthly', current_period_expires_at: '2026-06-01T00:00:00Z', cancel_at_period_end: false, last_verified_at: '2026-05-01T00:00:00Z' },
          { provider: 'google', status: 'grace_period', product_id: null, current_period_expires_at: '2026-06-05T00:00:00Z', cancel_at_period_end: false, last_verified_at: '2026-05-20T00:00:00Z' }
        ],
        error: null
      }
    });
    const { records, error } = await fetchEntitlementRecords(supabase, 'user-1');
    expect(error).toBeNull();
    expect(records).toHaveLength(2);
    expect(records.find((r) => r.provider === 'apple')).toMatchObject({ status: 'active', productId: 'com.zavaraai.wakewise.plus.monthly' });
    expect(records.find((r) => r.provider === 'google')).toMatchObject({ status: 'grace_period', lastVerifiedAt: '2026-05-20T00:00:00Z' });
  });

  it('never selects a column that does not exist on the live table yet (verification_source) - confirmed by inspecting the actual select() call arguments', async () => {
    const selectSpy = vi.fn(() => ({ eq: async () => ({ data: [], error: null }) }));
    const supabase = {
      from: (table) => {
        if (table === 'subscriptions') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
        if (table === 'provider_subscriptions') return { select: selectSpy };
        throw new Error('unexpected table');
      }
    };
    await fetchEntitlementRecords(supabase, 'user-1');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy.mock.calls[0][0]).not.toMatch(/verification_source/);
  });
});
