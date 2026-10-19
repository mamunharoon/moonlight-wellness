import { describe, it, expect } from 'vitest';
import { summarizeAdminSubscriptions, isStatusEditable } from './adminSubscriptionsSummary';

describe('summarizeAdminSubscriptions - N-04 fix: distinguish unique subscribed users from subscription records', () => {
  it('counts a multi-provider user once, not once per provider record', () => {
    // One user, already resolved to a single winning row by the RPC
    // (provider_record_count=2 reflects two underlying records - an
    // expired Stripe row and a valid Apple row - but this is still one
    // row/one user as far as this summary is concerned).
    const rows = [
      { user_id: 'u1', plan: 'plus', provider: 'apple', environment: 'production', provider_record_count: 2 }
    ];
    const result = summarizeAdminSubscriptions(rows);
    expect(result.uniquePlusSubscribers).toBe(1);
    expect(result.totalProviderRecords).toBe(2);
  });

  it('separates sandbox from production Plus subscribers, never conflating them', () => {
    const rows = [
      { user_id: 'u1', plan: 'plus', provider: 'apple', environment: 'sandbox', provider_record_count: 1 },
      { user_id: 'u2', plan: 'plus', provider: 'google', environment: 'production', provider_record_count: 1 },
      { user_id: 'u3', plan: 'plus', provider: 'stripe', environment: null, provider_record_count: 1 }
    ];
    const result = summarizeAdminSubscriptions(rows);
    expect(result.uniquePlusSubscribers).toBe(3);
    expect(result.sandboxPlusSubscribers).toBe(1);
    expect(result.productionPlusSubscribers).toBe(1);
  });

  it('a free user (no winning provider) never counts toward uniquePlusSubscribers, even with real provider_record_count history', () => {
    const rows = [
      { user_id: 'u1', plan: 'free', provider: null, environment: null, provider_record_count: 2 }
    ];
    const result = summarizeAdminSubscriptions(rows);
    expect(result.uniquePlusSubscribers).toBe(0);
    expect(result.totalProviderRecords).toBe(2);
    expect(result.totalUsers).toBe(1);
  });

  it('tolerates malformed/missing input defensively, never throwing', () => {
    expect(summarizeAdminSubscriptions(null)).toEqual({
      totalUsers: 0, uniquePlusSubscribers: 0, sandboxPlusSubscribers: 0, productionPlusSubscribers: 0, totalProviderRecords: 0
    });
    expect(summarizeAdminSubscriptions([null, undefined, {}])).toEqual({
      totalUsers: 3, uniquePlusSubscribers: 0, sandboxPlusSubscribers: 0, productionPlusSubscribers: 0, totalProviderRecords: 0
    });
  });

  it('totalUsers always matches the row count regardless of plan mix - one row is one registered user', () => {
    const rows = [
      { user_id: 'u1', plan: 'free' }, { user_id: 'u2', plan: 'plus', provider: 'stripe' }, { user_id: 'u3', plan: 'free' }
    ];
    expect(summarizeAdminSubscriptions(rows).totalUsers).toBe(3);
  });
});

describe('isStatusEditable - N-04 fix: the status control only ever affects the legacy table', () => {
  it('is editable for stripe, manual, and no-winner (free) rows - exactly what admin_set_subscription_status() actually controls', () => {
    expect(isStatusEditable('stripe')).toBe(true);
    expect(isStatusEditable('manual')).toBe(true);
    expect(isStatusEditable(null)).toBe(true);
    expect(isStatusEditable(undefined)).toBe(true);
  });

  it('is NOT editable for apple or google - admin_set_subscription_status() has no effect on those real provider rows', () => {
    expect(isStatusEditable('apple')).toBe(false);
    expect(isStatusEditable('google')).toBe(false);
  });
});
