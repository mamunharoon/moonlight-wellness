// Apple Server Verification task — a minimal App Store Server API
// client: signs the required ES256 JWT bearer token and calls exactly
// the two endpoints this project needs ("Get Transaction Info", "Get
// All Subscription Statuses"). Deliberately NOT Apple's own
// `@apple/app-store-server-library` client — see appleJwsVerification.ts's
// header comment for the concrete, cited Deno-incompatibility evidence
// that also applies to that library's bearer-token signing (its
// `jsonwebtoken`-based `createBearerToken()` hits the same reported
// Deno node:crypto EC-curve-naming bug, deno#22879, filed against
// exactly this "verify iOS purchases from an edge function" use case).
//
// Uses `jose` for the JWT signing — WebCrypto-native, so it does not
// touch the broken `node:crypto` code path at all. Endpoint paths, the
// bearer-token claim shape (`{ bid: bundleId }`, `aud:
// 'appstoreconnect-v1'`, ES256, keyid, issuer), and both base URLs below
// were read directly from Apple's own official library's source
// (downloaded and inspected during this task's Phase 1 research), not
// guessed at or reconstructed from documentation summaries — see
// docs/apple-subscription-implementation.md for the exact citation.
import { SignJWT, importPKCS8 } from 'jose';

export class AppleServerApiError extends Error {
  constructor(status, apiErrorCode, apiErrorMessage) {
    super(apiErrorMessage || `App Store Server API request failed with status ${status}`);
    this.name = 'AppleServerApiError';
    this.status = status;
    this.apiErrorCode = apiErrorCode;
  }
}

const BASE_URL_BY_ENVIRONMENT = {
  production: 'https://api.storekit.apple.com',
  sandbox: 'https://api.storekit-sandbox.apple.com'
};

// Every secret this module needs is read here, by NAME, and only at
// call time (never at module load) — mirrors this project's existing
// `knownPlusPriceIds()`/`priceIdForInterval()` pattern in planMapping.ts
// of reading Deno.env lazily so a missing var in one code path never
// prevents an unrelated path from working. Values are never logged.
export const appleServerCredentialsConfigured = () =>
  Boolean(Deno.env.get('APPLE_ISSUER_ID')) &&
  Boolean(Deno.env.get('APPLE_KEY_ID')) &&
  Boolean(Deno.env.get('APPLE_PRIVATE_KEY')) &&
  Boolean(Deno.env.get('APPLE_BUNDLE_ID'));

const readConfig = () => ({
  issuerId: Deno.env.get('APPLE_ISSUER_ID') ?? '',
  keyId: Deno.env.get('APPLE_KEY_ID') ?? '',
  privateKeyPem: Deno.env.get('APPLE_PRIVATE_KEY') ?? '',
  bundleId: Deno.env.get('APPLE_BUNDLE_ID') ?? '',
  // 'production' | 'sandbox' — deliberately explicit, never inferred,
  // so a misconfigured environment can never silently target the wrong
  // one. See docs/apple-subscription-implementation.md for the intended
  // operational meaning (which environment(s) a deployment checks, and
  // in which order).
  environment: Deno.env.get('APPLE_ENVIRONMENT') ?? ''
});

// Exported so it can be unit-tested with an explicit, synthetic config
// object — never reads Deno.env itself, unlike readConfig() below, so a
// test can exercise the real signing path without any Deno runtime.
export const createBearerToken = async (config) => {
  const privateKey = await importPKCS8(config.privateKeyPem, 'ES256');
  return new SignJWT({ bid: config.bundleId })
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(config.issuerId)
    .setAudience('appstoreconnect-v1')
    .setExpirationTime('5m')
    .sign(privateKey);
};

const request = async (path, environment) => {
  const config = readConfig();
  const baseUrl = BASE_URL_BY_ENVIRONMENT[environment];
  if (!baseUrl) {
    throw new Error(`Unknown or unconfigured Apple environment: ${JSON.stringify(environment)}`);
  }

  const bearerToken = await createBearerToken(config);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
      'User-Agent': 'wakewise-server-verification/1.0'
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppleServerApiError(response.status, body?.errorCode, body?.errorMessage);
  }
  return body;
};

/**
 * "Get Transaction Info" — returns the JWS-signed transaction info for a
 * single transaction id. The caller MUST verify the returned
 * `signedTransactionInfo` via appleJwsVerification.ts before trusting
 * anything in it — this function only performs the authenticated
 * network call, it verifies nothing itself.
 */
export const getTransactionInfo = async (transactionId, environment) =>
  request(`/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, environment);

/**
 * "Get All Subscription Statuses" — returns status + signed
 * transaction/renewal info for every subscription in the same
 * subscription group as the given (any) transaction id. Same
 * verify-before-trust requirement as getTransactionInfo.
 */
export const getAllSubscriptionStatuses = async (transactionId, environment) =>
  request(`/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`, environment);
