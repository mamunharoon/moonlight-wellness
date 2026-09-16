// Apple Server Verification task — the shared "verify one Apple
// transaction id against Apple's own API and apply its state" flow used
// by BOTH verify-apple-transaction (client-triggered) and
// reconcile-apple-subscriptions (server-triggered) — extracted once
// rather than duplicated, since a security fix made in only one copy is
// exactly the kind of drift this project's own conventions elsewhere
// (see planMapping.ts's product-id allow-list comment) are careful to
// avoid where duplication is NOT intentional.
//
// Ownership/appAccountToken enforcement, product/bundle/environment
// allow-listing, and the actual write are identical for both callers —
// only the caller's own trust boundary (a Supabase user JWT vs. a
// trigger secret) differs, and that is deliberately handled OUTSIDE
// this module, by each function's own index.ts.
import { isKnownApplePlusProductId } from './planMapping.ts';
import { getTransactionInfo, getAllSubscriptionStatuses, AppleServerApiError } from './appleServerApi.ts';
import { verifyAndDecodeAppleSignedData, AppleSignatureVerificationError } from './appleJwsVerification.ts';
import { resolveProviderStatus } from './appleSubscriptionStateMapping.ts';

export const verifyAndApplyAppleTransaction = async (
  { transactionId, environment, expectedUserId },
  { supabaseAdmin }
) => {
  const expectedBundleId = Deno.env.get('APPLE_BUNDLE_ID') ?? '';
  const expectedAppleEnvironmentLabel = environment === 'production' ? 'Production' : 'Sandbox';

  let signedTransactionInfo;
  try {
    ({ signedTransactionInfo } = await getTransactionInfo(transactionId, environment));
  } catch (err) {
    if (err instanceof AppleServerApiError && err.status === 404) {
      return { verified: false, reason: 'transaction_not_found' };
    }
    return { verified: false, reason: 'apple_api_unavailable', message: err.message };
  }

  if (typeof signedTransactionInfo !== 'string') {
    return { verified: false, reason: 'apple_api_unavailable' };
  }

  let transaction;
  try {
    transaction = await verifyAndDecodeAppleSignedData(signedTransactionInfo);
  } catch (err) {
    const reason = err instanceof AppleSignatureVerificationError ? err.reason : 'signature_invalid';
    return { verified: false, reason: 'signature_invalid', detail: reason };
  }

  if (transaction.bundleId !== expectedBundleId) return { verified: false, reason: 'bundle_id_mismatch' };
  if (!isKnownApplePlusProductId(transaction.productId)) return { verified: false, reason: 'unknown_product' };
  if (transaction.environment !== expectedAppleEnvironmentLabel) return { verified: false, reason: 'environment_mismatch' };
  if (
    transaction.transactionId !== transactionId &&
    transaction.originalTransactionId !== transactionId
  ) {
    return { verified: false, reason: 'transaction_id_mismatch' };
  }
  if (expectedUserId && transaction.appAccountToken && transaction.appAccountToken !== expectedUserId) {
    return { verified: false, reason: 'appAccountToken_mismatch' };
  }

  let appleStatus = null;
  let cancelAtPeriodEnd = null;
  try {
    const statusResponse = await getAllSubscriptionStatuses(transactionId, environment);
    const match = (statusResponse?.data ?? [])
      .flatMap((group) => group.lastTransactions ?? [])
      .find((item) => item.originalTransactionId === transaction.originalTransactionId);
    if (match?.signedRenewalInfo) {
      const renewalInfo = await verifyAndDecodeAppleSignedData(match.signedRenewalInfo);
      if (renewalInfo.originalTransactionId === transaction.originalTransactionId && typeof renewalInfo.autoRenewStatus === 'number') {
        cancelAtPeriodEnd = renewalInfo.autoRenewStatus === 0;
      }
    }
    if (typeof match?.status === 'number') {
      appleStatus = match.status;
    }
  } catch {
    // Non-fatal — proceed with transaction-only data, cancelAtPeriodEnd
    // left null so the RPC preserves whatever it already had on record.
  }

  const userId = expectedUserId ?? transaction.appAccountToken ?? null;
  if (!userId) {
    return { verified: false, reason: 'user_not_resolved' };
  }

  const status = resolveProviderStatus(transaction, appleStatus);
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('apply_verified_apple_subscription_event', {
    p_user_id: userId,
    p_apple_original_transaction_id: transaction.originalTransactionId,
    p_product_id: transaction.productId,
    p_status: status,
    p_current_period_expires_at: transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
    p_cancel_at_period_end: cancelAtPeriodEnd,
    p_environment: environment,
    p_apple_app_account_token: transaction.appAccountToken ?? null,
    p_last_verified_at: transaction.signedDate ? new Date(transaction.signedDate).toISOString() : new Date().toISOString(),
    p_raw_event_summary: { productId: transaction.productId, status, transactionReason: transaction.transactionReason ?? null },
    p_provider_event_id: null,
    p_event_type: 'server_verify_transaction'
  });

  if (rpcError) {
    if (rpcError.code === '23505' || /already linked to a different/i.test(rpcError.message ?? '')) {
      return { verified: false, reason: 'already_linked_to_another_account' };
    }
    return { verified: false, reason: 'internal_error', message: rpcError.message };
  }

  const applied = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  return {
    verified: true,
    status,
    expiresAt: transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
    originalTransactionId: transaction.originalTransactionId,
    recorded: Boolean(applied?.applied ?? true)
  };
};
