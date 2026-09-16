import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// This module reads Deno.env.get('APPLE_BUNDLE_ID') at call time — the
// only Deno-specific touchpoint in the whole orchestration module.
// Shimming a minimal global here lets the actual, real branching logic
// (bundle id / product id / environment / ownership / transaction-id
// checks, and RPC error mapping) run and be tested exactly as written,
// rather than leaving this file as an untested gap — the network/DB
// dependencies it calls (appleServerApi, appleJwsVerification's own
// crypto, and the RPC call) are mocked below, but the orchestration
// logic between them is not.
beforeEach(() => {
  globalThis.Deno = { env: { get: (key) => (key === 'APPLE_BUNDLE_ID' ? 'com.zavaraai.wakewise' : undefined) } };
});
afterEach(() => {
  delete globalThis.Deno;
  vi.restoreAllMocks();
  vi.resetModules();
});

const APPLE_SERVER_API_PATH = '../../supabase/functions/_shared/appleServerApi.ts';
const APPLE_JWS_VERIFICATION_PATH = '../../supabase/functions/_shared/appleJwsVerification.ts';

const baseTransaction = {
  bundleId: 'com.zavaraai.wakewise',
  productId: 'com.zavaraai.wakewise.plus.annual',
  environment: 'Sandbox',
  transactionId: 'txn_1',
  originalTransactionId: 'txn_1',
  expiresDate: Date.now() + 1000 * 60 * 60 * 24 * 30,
  signedDate: Date.now()
};

const setup = async ({ transaction = baseTransaction, rpcResult = { data: [{ applied: true }], error: null }, apiErrorStatus = null } = {}) => {
  vi.doMock(APPLE_SERVER_API_PATH, () => {
    class AppleServerApiError extends Error {
      constructor(status) { super('api error'); this.status = status; }
    }
    return {
      getTransactionInfo: apiErrorStatus
        ? vi.fn().mockRejectedValue(new AppleServerApiError(apiErrorStatus))
        : vi.fn().mockResolvedValue({ signedTransactionInfo: 'fake.jws.token' }),
      getAllSubscriptionStatuses: vi.fn().mockResolvedValue({ data: [] }),
      AppleServerApiError
    };
  });
  vi.doMock(APPLE_JWS_VERIFICATION_PATH, () => ({
    verifyAndDecodeAppleSignedData: vi.fn().mockResolvedValue(transaction),
    AppleSignatureVerificationError: class AppleSignatureVerificationError extends Error {}
  }));

  const { verifyAndApplyAppleTransaction } = await import('../../supabase/functions/_shared/applyVerifiedAppleTransaction.ts');
  const supabaseAdmin = { rpc: vi.fn().mockResolvedValue(rpcResult) };
  return { verifyAndApplyAppleTransaction, supabaseAdmin };
};

describe('verifyAndApplyAppleTransaction', () => {
  it('verifies and applies a valid transaction for the expected user', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup();
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result.verified).toBe(true);
    expect(result.status).toBe('active');
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'apply_verified_apple_subscription_event',
      expect.objectContaining({ p_user_id: 'user-1', p_apple_original_transaction_id: 'txn_1' })
    );
  });

  it('rejects a bundle id mismatch without ever calling the RPC', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({
      transaction: { ...baseTransaction, bundleId: 'com.attacker.fake' }
    });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'bundle_id_mismatch' });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('rejects an unknown product id', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({
      transaction: { ...baseTransaction, productId: 'com.zavaraai.wakewise.plus.lifetime' }
    });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'unknown_product' });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('rejects an environment mismatch (sandbox transaction data returned for a production request)', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({
      transaction: { ...baseTransaction, environment: 'Sandbox' }
    });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'production', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'environment_mismatch' });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('rejects a transaction id that does not match the one requested', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({
      transaction: { ...baseTransaction, transactionId: 'txn_other', originalTransactionId: 'txn_other' }
    });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'transaction_id_mismatch' });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('rejects when a present appAccountToken belongs to a different user', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({
      transaction: { ...baseTransaction, appAccountToken: 'user-2' }
    });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'appAccountToken_mismatch' });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('reports a 404 from the App Store Server API as transaction_not_found, not an internal error', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({ apiErrorStatus: 404 });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'transaction_not_found' });
  });

  it('surfaces an ownership conflict raised by the RPC as already_linked_to_another_account, never retried as an internal error', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({
      rpcResult: { data: null, error: { code: '23505', message: 'already linked to a different WakeWise account' } }
    });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'already_linked_to_another_account' });
  });

  it('maps a generic/transient database failure to internal_error, distinct from an ownership conflict', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup({
      rpcResult: { data: null, error: { code: '55000', message: 'connection reset' } }
    });
    const result = await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    expect(result).toEqual({ verified: false, reason: 'internal_error', message: 'connection reset' });
  });

  it('never trusts client-controlled entitlement fields — the RPC call never includes anything beyond what the verified transaction itself carries', async () => {
    const { verifyAndApplyAppleTransaction, supabaseAdmin } = await setup();
    await verifyAndApplyAppleTransaction(
      { transactionId: 'txn_1', environment: 'sandbox', expectedUserId: 'user-1' },
      { supabaseAdmin }
    );
    const [, rpcArgs] = supabaseAdmin.rpc.mock.calls[0];
    expect(Object.keys(rpcArgs).sort()).toEqual(
      [
        'p_apple_app_account_token',
        'p_apple_original_transaction_id',
        'p_cancel_at_period_end',
        'p_current_period_expires_at',
        'p_environment',
        'p_event_type',
        'p_last_verified_at',
        'p_product_id',
        'p_provider_event_id',
        'p_raw_event_summary',
        'p_status',
        'p_user_id'
      ].sort()
    );
  });
});
