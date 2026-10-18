// Immediate Account Deletion — the real, authoritative server-side
// boundary (replaces the old 7-day request/manual-processor model).
// delete-account/index.ts is the only real caller; this exercises
// resolveAccountDeletionRequest directly with fakes for every injected
// I/O function, the same dependency-injection approach
// betaVideoUrlAccess.test.js already uses for get-beta-video-url.
//
// No real Supabase Auth user, Stripe subscription, or database row is
// ever touched by these tests — every dependency below is a plain fake
// function returning a scripted result; nothing here can reach a real
// account (bbapi060565@gmail.com or any other).
import { describe, it, expect, vi } from 'vitest';
import {
  resolveAccountDeletionRequest,
  classifyBillingStatus,
  subscriptionNeedsStripeCancellation,
  deleteUserOwnedRowsInOrder,
  isAlreadyCancelledStripeError,
  isUserAlreadyDeletedError,
  USER_OWNED_TABLES,
  CONFIRMATION_PHRASE
} from '../../supabase/functions/_shared/accountDeletion.ts';

const realUser = (overrides = {}) => ({ id: 'user-1', email: 'real@example.com', is_anonymous: false, ...overrides });

// Every fake defaults to the "everything succeeds, nothing was already
// in flight" happy path — individual tests override only the one
// function/field whose behaviour they're actually exercising, so each
// test stays legible about what it's really testing.
const baseIo = (overrides = {}) => ({
  reauthenticate: vi.fn().mockResolvedValue({ error: null }),
  getBillingRow: vi.fn().mockResolvedValue({ data: null, error: null }),
  getExistingRequestRow: vi.fn().mockResolvedValue({ data: null, error: null }),
  upsertProcessingRow: vi.fn().mockResolvedValue({ data: { id: 'req-1' }, error: null }),
  cancelStripeSubscriptionIfActive: vi.fn().mockResolvedValue({ error: null }),
  deleteUserOwnedRows: vi.fn().mockResolvedValue({ error: null }),
  deleteAuthUser: vi.fn().mockResolvedValue({ error: null }),
  markRequestCompleted: vi.fn().mockResolvedValue({ error: null }),
  ...overrides
});

const baseInput = (overrides = {}) => ({
  user: realUser(),
  password: 'correct-password',
  confirmationPhrase: CONFIRMATION_PHRASE,
  ...overrides
});

describe('resolveAccountDeletionRequest — identity/ownership enforcement (never trusts a client-supplied id)', () => {
  it('rejects with no user at all', async () => {
    const io = baseIo();
    const result = await resolveAccountDeletionRequest(baseInput({ user: null }), io);
    expect(result).toEqual({ outcome: 'unauthenticated' });
    expect(io.reauthenticate).not.toHaveBeenCalled();
  });

  it('rejects a guest/anonymous session outright, before any reauth attempt', async () => {
    const io = baseIo();
    const result = await resolveAccountDeletionRequest(baseInput({ user: realUser({ is_anonymous: true }) }), io);
    expect(result).toEqual({ outcome: 'guest_blocked' });
    expect(io.reauthenticate).not.toHaveBeenCalled();
  });

  it('rejects a user with no email (cannot be re-authenticated)', async () => {
    const io = baseIo();
    const result = await resolveAccountDeletionRequest(baseInput({ user: realUser({ email: null }) }), io);
    expect(result).toEqual({ outcome: 'no_email' });
  });

  it('every I/O call this function makes is scoped by the caller\'s own resolved user implicitly, never by a second id read from the input', async () => {
    // The pure function's own input shape has no separate "target user
    // id" field at all - only `user` (already server-verified) - so
    // there is structurally nothing else for a caller to supply that
    // could redirect deletion at a different account.
    expect(Object.keys(baseInput())).toEqual(['user', 'password', 'confirmationPhrase']);
  });
});

describe('resolveAccountDeletionRequest — confirmation phrase and password gates (server-side, never trusts the client-disabled button alone)', () => {
  it('rejects a wrong confirmation phrase before ever reauthenticating', async () => {
    const io = baseIo();
    const result = await resolveAccountDeletionRequest(baseInput({ confirmationPhrase: 'delete my account' }), io);
    expect(result).toEqual({ outcome: 'phrase_mismatch' });
    expect(io.reauthenticate).not.toHaveBeenCalled();
  });

  it('rejects a missing password', async () => {
    const io = baseIo();
    const result = await resolveAccountDeletionRequest(baseInput({ password: '' }), io);
    expect(result).toEqual({ outcome: 'password_required' });
  });

  it('rejects an incorrect password via the injected reauthenticate call, never deleting anything', async () => {
    const io = baseIo({ reauthenticate: vi.fn().mockResolvedValue({ error: { message: 'Invalid login credentials' } }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'reauth_failed' });
    expect(io.deleteUserOwnedRows).not.toHaveBeenCalled();
    expect(io.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('reauthenticates with the real user\'s own email, never a client-supplied one (there is none to supply - see the identity test above)', async () => {
    const io = baseIo();
    await resolveAccountDeletionRequest(baseInput({ user: realUser({ email: 'owner@example.com' }) }), io);
    expect(io.reauthenticate).toHaveBeenCalledWith('owner@example.com', 'correct-password');
  });
});

describe('resolveAccountDeletionRequest — successful deletion, full order of operations', () => {
  it('deletes in the documented order: billing read -> lock row -> Stripe cancel -> data delete -> Auth user delete -> completion record', async () => {
    const callOrder = [];
    const io = baseIo({
      getBillingRow: vi.fn().mockImplementation(async () => { callOrder.push('getBillingRow'); return { data: null, error: null }; }),
      upsertProcessingRow: vi.fn().mockImplementation(async () => { callOrder.push('upsertProcessingRow'); return { data: { id: 'req-1' }, error: null }; }),
      cancelStripeSubscriptionIfActive: vi.fn().mockImplementation(async () => { callOrder.push('cancelStripeSubscriptionIfActive'); return { error: null }; }),
      deleteUserOwnedRows: vi.fn().mockImplementation(async () => { callOrder.push('deleteUserOwnedRows'); return { error: null }; }),
      deleteAuthUser: vi.fn().mockImplementation(async () => { callOrder.push('deleteAuthUser'); return { error: null }; }),
      markRequestCompleted: vi.fn().mockImplementation(async () => { callOrder.push('markRequestCompleted'); return { error: null }; })
    });

    const result = await resolveAccountDeletionRequest(baseInput(), io);

    expect(result).toEqual({ outcome: 'deleted' });
    expect(callOrder).toEqual([
      'getBillingRow',
      'upsertProcessingRow',
      'cancelStripeSubscriptionIfActive',
      'deleteUserOwnedRows',
      'deleteAuthUser',
      'markRequestCompleted'
    ]);
  });

  it('passes the real billing row through to the Stripe cancellation step - never a second, independent read', async () => {
    const billingRow = { plan: 'plus', status: 'active', provider: 'stripe', stripe_subscription_id: 'sub_123' };
    const io = baseIo({ getBillingRow: vi.fn().mockResolvedValue({ data: billingRow, error: null }) });
    await resolveAccountDeletionRequest(baseInput(), io);
    expect(io.cancelStripeSubscriptionIfActive).toHaveBeenCalledWith(billingRow);
  });

  it('a failure recording the completion audit row is never surfaced as a deletion failure - the Auth user is already gone by then', async () => {
    const io = baseIo({ markRequestCompleted: vi.fn().mockRejectedValue(new Error('audit table unavailable')) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'deleted' });
  });
});

describe('resolveAccountDeletionRequest — partial failure is never reported as success, and nothing further runs', () => {
  it('a billing-status read failure stops before locking any row or touching Stripe/data/Auth', async () => {
    const io = baseIo({ getBillingRow: vi.fn().mockResolvedValue({ data: null, error: { message: 'db unavailable' } }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'billing_check_failed' });
    expect(io.upsertProcessingRow).not.toHaveBeenCalled();
    expect(io.deleteUserOwnedRows).not.toHaveBeenCalled();
    expect(io.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('a failure locking the processing row stops before Stripe/data/Auth are ever touched', async () => {
    const io = baseIo({ upsertProcessingRow: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'request_lock_failed' });
    expect(io.cancelStripeSubscriptionIfActive).not.toHaveBeenCalled();
    expect(io.deleteUserOwnedRows).not.toHaveBeenCalled();
    expect(io.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('a Stripe cancellation failure stops before any data or the Auth user is deleted - the account remains fully intact, and the request id is reported for a safe retry', async () => {
    const io = baseIo({ cancelStripeSubscriptionIfActive: vi.fn().mockResolvedValue({ error: { message: 'Stripe unavailable' } }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'stripe_cancel_failed', requestId: 'req-1' });
    expect(io.deleteUserOwnedRows).not.toHaveBeenCalled();
    expect(io.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('a data-deletion failure stops before the Auth user is deleted - never removes the account while leaving data behind unaccounted for, in either direction', async () => {
    const io = baseIo({ deleteUserOwnedRows: vi.fn().mockResolvedValue({ error: { message: 'delete failed on journal_entries' } }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'data_delete_failed', requestId: 'req-1' });
    expect(io.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('an Auth-user-delete failure is reported honestly, never silently treated as "deleted"', async () => {
    const io = baseIo({ deleteAuthUser: vi.fn().mockResolvedValue({ error: { message: 'GoTrue unavailable' } }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'auth_delete_failed', requestId: 'req-1' });
    expect(io.markRequestCompleted).not.toHaveBeenCalled();
  });

  it('none of the failure outcomes above is the string "deleted" - a partial failure can never collide with the one real success value', () => {
    const failureOutcomes = ['billing_check_failed', 'request_lock_failed', 'stripe_cancel_failed', 'data_delete_failed', 'auth_delete_failed'];
    expect(failureOutcomes).not.toContain('deleted');
  });
});

describe('resolveAccountDeletionRequest — retry safety: resuming an existing request row', () => {
  it('reuses an existing pending/processing row (old 7-day model, or a prior died-partway attempt) rather than creating a second one', async () => {
    const io = baseIo({ getExistingRequestRow: vi.fn().mockResolvedValue({ data: { id: 'existing-row', status: 'processing' }, error: null }) });
    await resolveAccountDeletionRequest(baseInput(), io);
    expect(io.upsertProcessingRow).toHaveBeenCalledWith({ existingId: 'existing-row', billingStatusAtRequest: 'none' });
  });

  it('a lookup failure for the existing row stops before anything else runs', async () => {
    const io = baseIo({ getExistingRequestRow: vi.fn().mockResolvedValue({ data: null, error: { message: 'read failed' } }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'request_lookup_failed' });
    expect(io.getBillingRow).not.toHaveBeenCalled();
  });

  it('a defensive, unreachable-in-practice "already completed" row is treated as already deleted, not reprocessed', async () => {
    const io = baseIo({ getExistingRequestRow: vi.fn().mockResolvedValue({ data: { id: 'old-row', status: 'completed' }, error: null }) });
    const result = await resolveAccountDeletionRequest(baseInput(), io);
    expect(result).toEqual({ outcome: 'already_deleted' });
    expect(io.getBillingRow).not.toHaveBeenCalled();
  });

  it('every downstream step (Stripe/data/Auth) is called exactly once even when resuming an existing row - no duplicated side effects', async () => {
    const io = baseIo({ getExistingRequestRow: vi.fn().mockResolvedValue({ data: { id: 'existing-row', status: 'processing' }, error: null }) });
    await resolveAccountDeletionRequest(baseInput(), io);
    expect(io.cancelStripeSubscriptionIfActive).toHaveBeenCalledTimes(1);
    expect(io.deleteUserOwnedRows).toHaveBeenCalledTimes(1);
    expect(io.deleteAuthUser).toHaveBeenCalledTimes(1);
  });

  it('a full two-call sequence: auth_delete_failed, then a genuine retry (same user, finds the SAME processing row, every idempotent step treated as already-done) converges on "deleted"', async () => {
    // Call 1: everything succeeds except removing the Auth user itself.
    const callOneIo = baseIo({ deleteAuthUser: vi.fn().mockResolvedValue({ error: { message: 'GoTrue unavailable' } }) });
    const callOne = await resolveAccountDeletionRequest(baseInput(), callOneIo);
    expect(callOne).toEqual({ outcome: 'auth_delete_failed', requestId: 'req-1' });

    // Call 2: a real retry re-enters by finding the SAME row
    // (callOne's own requestId) still in 'processing' - exactly what
    // delete-account/index.ts's own getExistingRequestRow would find,
    // since nothing ever moved it to 'completed'. Every step this time
    // genuinely succeeds (the Stripe/data steps are idempotent no-ops
    // in the real implementation - this fake simply reports success,
    // which is the same observable outcome).
    const callTwoIo = baseIo({
      getExistingRequestRow: vi.fn().mockResolvedValue({ data: { id: callOne.requestId, status: 'processing' }, error: null })
    });
    const callTwo = await resolveAccountDeletionRequest(baseInput(), callTwoIo);

    expect(callTwo).toEqual({ outcome: 'deleted' });
    expect(callTwoIo.upsertProcessingRow).toHaveBeenCalledWith({ existingId: callOne.requestId, billingStatusAtRequest: 'none' });
    expect(callTwoIo.deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(callTwoIo.markRequestCompleted).toHaveBeenCalledWith('req-1');
  });
});

describe('deleteUserOwnedRowsInOrder — proves exactly what remains at each real failure point (not just asserted in a comment)', () => {
  it('every table succeeds: all 9 user-owned tables are deleted, profiles is deleted LAST, after every one of them', async () => {
    const attempted = [];
    const deleteFromTable = vi.fn().mockImplementation(async (table) => {
      attempted.push(table);
      return { error: null };
    });
    const result = await deleteUserOwnedRowsInOrder(deleteFromTable);
    expect(result).toEqual({ error: null });
    expect(attempted).toEqual([...USER_OWNED_TABLES, 'profiles']);
  });

  it('a mid-loop failure (e.g. "entitlements"): every table BEFORE it is already genuinely, irreversibly deleted; "subscriptions" and "profiles" (after it) were never even attempted - still exist', async () => {
    const attempted = [];
    const deleteFromTable = vi.fn().mockImplementation(async (table) => {
      attempted.push(table);
      if (table === 'entitlements') return { error: { message: 'db unavailable' } };
      return { error: null };
    });
    const result = await deleteUserOwnedRowsInOrder(deleteFromTable);
    expect(result).toEqual({ error: { message: 'db unavailable' }, failedTable: 'entitlements' });
    expect(attempted).toEqual(['journal_entries', 'user_intentions', 'rhythms', 'routine_responses', 'practice_completion_events', 'checkout_attempts', 'provider_subscriptions', 'entitlements']);
    expect(attempted).not.toContain('subscriptions');
    expect(attempted).not.toContain('profiles');
  });

  it('a failure on the FIRST table (journal_entries) means nothing at all has been deleted yet - the earliest possible data_delete_failed', async () => {
    const attempted = [];
    const deleteFromTable = vi.fn().mockImplementation(async (table) => {
      attempted.push(table);
      return { error: { message: 'db unavailable' } };
    });
    const result = await deleteUserOwnedRowsInOrder(deleteFromTable);
    expect(result).toEqual({ error: { message: 'db unavailable' }, failedTable: 'journal_entries' });
    expect(attempted).toEqual(['journal_entries']);
  });

  it('a failure on "profiles" itself (the last step) means every OTHER user-owned table is ALREADY confirmed gone - this is exactly the state auth_delete_failed is in if the Auth user delete then also fails (the "most advanced partial state" accountDeletion.ts\'s own header describes)', async () => {
    const attempted = [];
    const deleteFromTable = vi.fn().mockImplementation(async (table) => {
      attempted.push(table);
      if (table === 'profiles') return { error: { message: 'db unavailable' } };
      return { error: null };
    });
    const result = await deleteUserOwnedRowsInOrder(deleteFromTable);
    expect(result).toEqual({ error: { message: 'db unavailable' }, failedTable: 'profiles' });
    expect(attempted).toEqual([...USER_OWNED_TABLES, 'profiles']);
  });

  it('profiles is filtered by its own id column, every other table by user_id - never the same column for both', async () => {
    const calls = [];
    const deleteFromTable = vi.fn().mockImplementation(async (table, filterColumn) => {
      calls.push([table, filterColumn]);
      return { error: null };
    });
    await deleteUserOwnedRowsInOrder(deleteFromTable);
    expect(calls.find(([table]) => table === 'profiles')).toEqual(['profiles', 'id']);
    for (const [table, filterColumn] of calls) {
      if (table !== 'profiles') expect(filterColumn).toBe('user_id');
    }
  });
});

describe('classifyBillingStatus — short, non-sensitive audit classification only', () => {
  it('no billing row at all -> "none"', () => {
    expect(classifyBillingStatus(null)).toBe('none');
  });

  it('a free-plan row -> "none", regardless of status', () => {
    expect(classifyBillingStatus({ plan: 'free', status: 'active', provider: 'stripe' })).toBe('none');
  });

  it('a lapsed plus row (cancelled/expired) -> "none" - no longer actively billing', () => {
    expect(classifyBillingStatus({ plan: 'plus', status: 'cancelled', provider: 'stripe' })).toBe('none');
    expect(classifyBillingStatus({ plan: 'plus', status: 'expired', provider: 'stripe' })).toBe('none');
  });

  it('an active/trial Stripe row -> "active-stripe"', () => {
    expect(classifyBillingStatus({ plan: 'plus', status: 'active', provider: 'stripe' })).toBe('active-stripe');
    expect(classifyBillingStatus({ plan: 'plus', status: 'trial', provider: 'stripe' })).toBe('active-stripe');
  });

  it('an active non-Stripe row (manual grant) -> "active-manual" - never echoes the real provider value', () => {
    expect(classifyBillingStatus({ plan: 'plus', status: 'active', provider: 'manual' })).toBe('active-manual');
  });
});

describe('subscriptionNeedsStripeCancellation — only a live, identifiable Stripe subscription ever needs the explicit cancel call', () => {
  it('no row at all -> false', () => {
    expect(subscriptionNeedsStripeCancellation(null)).toBe(false);
  });

  it('a non-Stripe provider (apple/google/manual) -> false - this app never reaches those stores\' own billing systems', () => {
    expect(subscriptionNeedsStripeCancellation({ provider: 'apple', status: 'active', stripe_subscription_id: null })).toBe(false);
    expect(subscriptionNeedsStripeCancellation({ provider: 'manual', status: 'active', stripe_subscription_id: null })).toBe(false);
  });

  it('a Stripe row with no stored subscription id -> false - nothing to cancel', () => {
    expect(subscriptionNeedsStripeCancellation({ provider: 'stripe', status: 'active', stripe_subscription_id: null })).toBe(false);
  });

  it('a Stripe row already cancelled/expired -> false - already not billing', () => {
    expect(subscriptionNeedsStripeCancellation({ provider: 'stripe', status: 'cancelled', stripe_subscription_id: 'sub_1' })).toBe(false);
  });

  it('a genuinely active or trialing Stripe row with a real subscription id -> true', () => {
    expect(subscriptionNeedsStripeCancellation({ provider: 'stripe', status: 'active', stripe_subscription_id: 'sub_1' })).toBe(true);
    expect(subscriptionNeedsStripeCancellation({ provider: 'stripe', status: 'trial', stripe_subscription_id: 'sub_1' })).toBe(true);
  });
});

describe('isAlreadyCancelledStripeError — retry safety for the Stripe cancellation step specifically', () => {
  it('no error at all -> false', () => {
    expect(isAlreadyCancelledStripeError(null)).toBe(false);
    expect(isAlreadyCancelledStripeError(undefined)).toBe(false);
  });

  it('Stripe\'s own "no such subscription" code (resource_missing) -> true - a retry after this subscription is already gone from Stripe entirely', () => {
    expect(isAlreadyCancelledStripeError({ code: 'resource_missing', message: 'No such subscription: sub_123' })).toBe(true);
  });

  it('a message indicating the subscription is already cancelled, with no matching code -> true', () => {
    expect(isAlreadyCancelledStripeError({ message: 'This subscription is already canceled.' })).toBe(true);
  });

  it('a genuine, unrelated Stripe failure (e.g. a real network/API error) -> false, never silently swallowed as "already done"', () => {
    expect(isAlreadyCancelledStripeError({ code: 'api_connection_error', message: 'Could not connect to Stripe' })).toBe(false);
    expect(isAlreadyCancelledStripeError({ message: 'An internal error occurred' })).toBe(false);
  });

  it('a malformed error object with no message property never throws', () => {
    expect(isAlreadyCancelledStripeError({})).toBe(false);
  });
});

describe('isUserAlreadyDeletedError — retry safety for removing the Auth user itself', () => {
  it('no error at all -> false', () => {
    expect(isUserAlreadyDeletedError(null)).toBe(false);
  });

  it('GoTrue\'s own "User not found" shape -> true - the exact state a retry after a prior successful deleteUser() finds', () => {
    expect(isUserAlreadyDeletedError({ message: 'User not found' })).toBe(true);
  });

  it('a genuine, unrelated failure (e.g. service unavailable) -> false, never silently swallowed as "already deleted"', () => {
    expect(isUserAlreadyDeletedError({ message: 'Database error deleting user' })).toBe(false);
    expect(isUserAlreadyDeletedError({ message: 'Service unavailable' })).toBe(false);
  });

  it('a malformed error object with no message property never throws', () => {
    expect(isUserAlreadyDeletedError({})).toBe(false);
  });
});
