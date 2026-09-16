// Apple Server Verification task — genuine JWS signature and X.509
// certificate-chain verification for Apple-signed data (App Store Server
// API `signedTransactionInfo`/`signedRenewalInfo`, and App Store Server
// Notifications V2 `signedPayload`).
//
// *** WHY THIS EXISTS INSTEAD OF APPLE'S OWN OFFICIAL LIBRARY ***
// Apple publishes `@apple/app-store-server-library` (npm, MIT) for
// exactly this. Its `SignedDataVerifier` was evaluated first, per this
// task's own Phase 1 instruction, and found NOT safely usable in
// Supabase's current Edge Runtime:
//   - It imports `X509Certificate` directly from Node's built-in
//     `crypto` module and calls `.publicKey` / `.verify()` on it.
//   - Deno's `node:crypto` compatibility layer had both of those
//     documented as literally unimplemented for long stretches:
//     `X509Certificate.prototype.publicKey` (deno#23307 — its own title
//     names `@apple/app-store-server-library` as the motivating case,
//     fixed by deno#24988) and `X509Certificate.prototype.verify`
//     (deno#28494, still "Not implemented" as reported against Deno
//     2.2.2, fixed by deno#32270).
//   - Separately, the library's JWT bearer-token signing (via the
//     `jsonwebtoken` npm package) hit a real, reported Deno bug where
//     `node:crypto` reports an EC key's curve as `'p256'` instead of the
//     OpenSSL short name `'prime256v1'` `jsonwebtoken` expects — deno#22879,
//     filed by a developer building exactly this (verifying iOS in-app
//     purchases from an edge function backend), fixed by deno#32267
//     (merged 2026-03-02, alongside the curve-naming fix above).
//   - Supabase's own Edge Runtime is confirmed still pinned to Deno 2.1.4
//     as of the most recent evidence available (an open, unresolved
//     supabase/edge-runtime discussion requesting an upgrade to Deno
//     2.5) — i.e. AFTER all three fixes above landed upstream in Deno,
//     but with no confirmed timeline for Supabase's own runtime to pick
//     them up. Using the official library today would mean shipping
//     code whose core cryptographic path is confirmed broken on the
//     exact runtime version this function actually runs on.
//   - The one community attempt at a Deno-native port found during this
//     research, `@xaio/app-store-server-library-deno` on JSR, has
//     published zero versions — not a credible, usable alternative.
//
// *** WHAT THIS FILE DOES INSTEAD ***
// Delegates every actual cryptographic operation to two independently
// maintained, WebCrypto-native libraries that never touch Node's
// `node:crypto` module at all (so the Deno incompatibilities above do
// not apply to them):
//   - `@peculiar/x509` — X.509 parsing and certificate-chain building
//     (`X509ChainBuilder`), which itself cryptographically verifies each
//     certificate's signature against its candidate issuer via
//     WebCrypto's `crypto.subtle.verify` (confirmed by reading its
//     bundled source — `findIssuer()` calls `cert.verify({ publicKey,
//     signatureOnly: true })`, not a mere subject/issuer string match).
//   - `jose` — JWS parsing and signature verification via WebCrypto.
// This file's own code only orchestrates: which candidate certificates
// to hand the chain builder, which root to trust (pinned, see
// appleRootCertificates.ts), and which additional checks (validity
// dates, basicConstraints) to enforce on top of the library's own
// chain-building signature checks. It does not implement ASN.1 parsing,
// signature math, or its own certificate-chain algorithm — see this
// task's own "do not create home-grown certificate-chain validation"
// instruction, which this design is intended to honour.
//
// *** WHAT IS NOT YET PROVEN ***
// This module is unit-tested (appleJwsVerification.test.js) against
// synthetic certificate chains generated in the test file itself
// (self-signed test root -> intermediate -> leaf, matching Apple's real
// chain SHAPE) and against deliberately corrupted/mismatched/expired
// variants — proving the verification LOGIC correctly accepts a valid
// chain and rejects every tested tampering. It has NOT been executed
// inside the actual Supabase Edge Runtime (no Docker/Deno CLI available
// in this task's environment — see docs/apple-subscription-implementation.md),
// and it has NOT been exercised against a real Apple-signed JWS (no
// Apple credentials exist or were created in this task). Both remain
// required — see this task's "Requires Supabase deployment" and
// "Requires Apple sandbox testing" classifications.
import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import { compactVerify } from 'jose';
import { TRUSTED_APPLE_ROOT_CERTIFICATES_PEM } from './appleRootCertificates.ts';

export class AppleSignatureVerificationError extends Error {
  constructor(reason, message) {
    super(message ?? reason);
    this.name = 'AppleSignatureVerificationError';
    this.reason = reason;
  }
}

const fail = (reason, message) => {
  throw new AppleSignatureVerificationError(reason, message);
};

// base64url (JWS-standard) decode, never base64 — a JWS's header/payload
// segments are always base64url, unpadded.
const base64UrlDecode = (segment) => {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + padding);
};

const decodeJwsHeader = (compactJws) => {
  const parts = compactJws.split('.');
  if (parts.length !== 3) fail('malformed', 'Not a compact JWS (expected 3 dot-separated segments)');
  try {
    return JSON.parse(base64UrlDecode(parts[0]));
  } catch {
    return fail('malformed', 'JWS header is not valid JSON');
  }
};

// Builds an X509Certificate from either a base64 DER string (as found in
// a JWS `x5c` header entry) or a PEM string (as used for the pinned
// trusted roots) — @peculiar/x509's constructor accepts both.
const parseCertificate = (base64OrPem) => {
  try {
    return new x509.X509Certificate(base64OrPem);
  } catch (err) {
    return fail('malformed', `Could not parse a certificate: ${err.message}`);
  }
};

const isWithinValidityWindow = (cert, now) => cert.notBefore <= now && now <= cert.notAfter;

// Every non-leaf (issuing) certificate in a valid chain must be a CA
// certificate — a leaf certificate that lacks CA:true must never be
// usable to vouch for another certificate. Checked explicitly here since
// X509ChainBuilder's own signature-based issuer matching does not by
// itself enforce this X.509 path-validation rule.
const hasCaBasicConstraint = (cert) => {
  const ext = cert.getExtension(x509.BasicConstraintsExtension);
  return Boolean(ext?.ca);
};

const certificateMatches = async (a, b) => {
  const [fingerprintA, fingerprintB] = await Promise.all([
    a.getThumbprint('SHA-256'),
    b.getThumbprint('SHA-256')
  ]);
  if (fingerprintA.byteLength !== fingerprintB.byteLength) return false;
  const bytesA = new Uint8Array(fingerprintA);
  const bytesB = new Uint8Array(fingerprintB);
  return bytesA.every((byte, i) => byte === bytesB[i]);
};

/**
 * Verifies a compact JWS (Apple's `signedTransactionInfo`,
 * `signedRenewalInfo`, or App Store Server Notifications V2
 * `signedPayload`) and returns its decoded payload — ONLY on success.
 * Every failure throws AppleSignatureVerificationError; there is no
 * "verified: false, here's the payload anyway" return path, by design.
 *
 * @param compactJws the raw JWS string, exactly as received from Apple
 * @param options.trustedRootsPem defaults to Apple's own published root
 *   (appleRootCertificates.ts) — overridable only for tests, so a test
 *   can pin to a synthetic test root instead of Apple's real one
 * @param options.now defaults to the real current time — overridable
 *   only for tests, so expiry/not-yet-valid tests do not depend on the
 *   test suite's own runtime clock relative to a fixed synthetic
 *   certificate's validity window
 */
export const verifyAndDecodeAppleSignedData = async (compactJws, options = {}) => {
  if (typeof compactJws !== 'string' || compactJws.length === 0) {
    fail('malformed', 'Empty or non-string signed payload');
  }

  const trustedRootsPem = options.trustedRootsPem ?? TRUSTED_APPLE_ROOT_CERTIFICATES_PEM;
  const now = options.now ?? new Date();

  const header = decodeJwsHeader(compactJws);

  // Apple signs every App Store Server API/Notifications JWS with
  // ES256 (ECDSA P-256 / SHA-256) — never accept any other algorithm,
  // which also rules out the classic JWT "alg: none" / algorithm-confusion
  // attack class outright.
  if (header.alg !== 'ES256') {
    fail('unsupported_algorithm', `Expected alg=ES256, got ${JSON.stringify(header.alg)}`);
  }

  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 2) {
    fail('malformed', 'JWS header is missing a usable x5c certificate chain (need leaf + at least one issuer)');
  }

  const presentedCertificates = x5c.map(parseCertificate);
  const leaf = presentedCertificates[0];
  const trustedRoots = trustedRootsPem.map(parseCertificate);

  let chain;
  try {
    const builder = new x509.X509ChainBuilder({
      certificates: [...presentedCertificates, ...trustedRoots]
    });
    chain = await builder.build(leaf);
  } catch (err) {
    return fail('chain_build_failed', `Could not build a certificate chain: ${err.message}`);
  }

  if (chain.length < 2) {
    fail('chain_build_failed', 'Certificate chain did not extend beyond the leaf certificate');
  }

  const terminal = chain[chain.length - 1];
  let matchesAPinnedRoot = false;
  for (const trustedRoot of trustedRoots) {
    if (await certificateMatches(terminal, trustedRoot)) {
      matchesAPinnedRoot = true;
      break;
    }
  }
  if (!matchesAPinnedRoot) {
    fail('untrusted_root', 'Certificate chain does not terminate at a pinned trusted root');
  }

  for (const cert of chain) {
    if (!isWithinValidityWindow(cert, now)) {
      fail('certificate_expired', `Certificate in chain is not valid at ${now.toISOString()} (notBefore=${cert.notBefore.toISOString()}, notAfter=${cert.notAfter.toISOString()})`);
    }
  }

  // Every certificate except the leaf itself must be a CA certificate —
  // i.e. every certificate that VOUCHED FOR another certificate in this
  // chain, not the leaf which is only ever vouched for.
  for (const cert of chain.slice(1)) {
    if (!hasCaBasicConstraint(cert)) {
      fail('invalid_basic_constraints', 'A non-leaf certificate in the chain is not a CA certificate');
    }
  }

  // The chain is now a verified, trust-anchored path from the leaf to a
  // pinned Apple root. Only NOW is it safe to trust the leaf's public
  // key to verify the JWS's own signature.
  const leafPublicKey = await leaf.publicKey.export(
    { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
    ['verify']
  );

  let verifiedPayloadBytes;
  try {
    ({ payload: verifiedPayloadBytes } = await compactVerify(compactJws, leafPublicKey));
  } catch (err) {
    return fail('signature_invalid', `JWS signature did not verify against the trusted leaf certificate: ${err.message}`);
  }

  try {
    return JSON.parse(new TextDecoder().decode(verifiedPayloadBytes));
  } catch {
    return fail('malformed', 'Verified JWS payload is not valid JSON');
  }
};
