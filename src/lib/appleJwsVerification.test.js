import 'reflect-metadata';
import { describe, it, expect, beforeAll } from 'vitest';
import * as x509 from '@peculiar/x509';
import { CompactSign } from 'jose';
// Cross-boundary import of the actual Deno Edge Function shared module —
// same established pattern as src/lib/planMapping.test.js. This file has
// no Deno-specific reference at module-evaluation scope (only
// `Deno.env` calls elsewhere in this project's other _shared files would
// be a problem; this module makes none), so Vitest can load and
// exercise it exactly as Supabase's Edge Runtime will.
import {
  verifyAndDecodeAppleSignedData,
  AppleSignatureVerificationError
} from '../../supabase/functions/_shared/appleJwsVerification.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const base64UrlEncode = (input) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Builds a synthetic 3-tier certificate chain matching Apple's real
// shape (root CA -> intermediate CA -> leaf), all ECDSA P-256/SHA-256 —
// the exact algorithm Apple signs with — so this test exercises the real
// verification code path end-to-end, not a mocked stand-in for it.
const buildChain = async ({
  rootNotBefore = new Date(Date.now() - ONE_DAY_MS),
  rootNotAfter = new Date(Date.now() + 365 * ONE_DAY_MS),
  leafNotBefore = new Date(Date.now() - ONE_DAY_MS),
  leafNotAfter = new Date(Date.now() + 365 * ONE_DAY_MS),
  leafIsCa = false
} = {}) => {
  const alg = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };

  const rootKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const rootCert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: '01',
    name: 'CN=Test Apple Root CA (synthetic)',
    notBefore: rootNotBefore,
    notAfter: rootNotAfter,
    signingAlgorithm: alg,
    keys: rootKeys,
    extensions: [new x509.BasicConstraintsExtension(true, 2, true)]
  });

  const intermediateKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const intermediateCert = await x509.X509CertificateGenerator.create({
    serialNumber: '02',
    subject: 'CN=Test Apple WWDR (synthetic)',
    issuer: rootCert.subject,
    notBefore: rootNotBefore,
    notAfter: rootNotAfter,
    signingAlgorithm: alg,
    publicKey: intermediateKeys.publicKey,
    signingKey: rootKeys.privateKey,
    extensions: [new x509.BasicConstraintsExtension(true, 1, true)]
  });

  const leafKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const leafExtensions = leafIsCa ? [new x509.BasicConstraintsExtension(true, 0, true)] : [];
  const leafCert = await x509.X509CertificateGenerator.create({
    serialNumber: '03',
    subject: 'CN=Test App Store Server (synthetic)',
    issuer: intermediateCert.subject,
    notBefore: leafNotBefore,
    notAfter: leafNotAfter,
    signingAlgorithm: alg,
    publicKey: leafKeys.publicKey,
    signingKey: intermediateKeys.privateKey,
    extensions: leafExtensions
  });

  return { rootCert, intermediateCert, leafCert, leafKeys };
};

const signJws = async (payload, { leafCert, intermediateCert, leafKeys, algOverride }) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return new CompactSign(bytes)
    .setProtectedHeader({
      alg: algOverride ?? 'ES256',
      x5c: [leafCert.toString('base64'), intermediateCert.toString('base64')]
    })
    .sign(leafKeys.privateKey);
};

describe('verifyAndDecodeAppleSignedData', () => {
  let chain;
  let validJws;
  const payload = { notificationType: 'DID_RENEW', notificationUUID: 'test-uuid-1' };

  beforeAll(async () => {
    chain = await buildChain();
    validJws = await signJws(payload, chain);
  });

  it('accepts a validly signed JWS chaining to the pinned trusted root and returns its exact payload', async () => {
    const decoded = await verifyAndDecodeAppleSignedData(validJws, {
      trustedRootsPem: [chain.rootCert.toString('pem')]
    });
    expect(decoded).toEqual(payload);
  });

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const [header, , signature] = validJws.split('.');
    const tamperedPayload = base64UrlEncode(JSON.stringify({ ...payload, notificationType: 'REVOKE' }));
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    await expect(
      verifyAndDecodeAppleSignedData(tampered, { trustedRootsPem: [chain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'signature_invalid' });
  });

  it('rejects a JWS signed by a key not matching the presented leaf certificate', async () => {
    const otherKeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }, true, ['sign', 'verify']);
    const forged = await signJws(payload, { ...chain, leafKeys: otherKeys });
    await expect(
      verifyAndDecodeAppleSignedData(forged, { trustedRootsPem: [chain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'signature_invalid' });
  });

  it('rejects when the chain does not terminate at a pinned trusted root (unrelated root)', async () => {
    const unrelatedChain = await buildChain();
    await expect(
      verifyAndDecodeAppleSignedData(validJws, { trustedRootsPem: [unrelatedChain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'untrusted_root' });
  });

  it('rejects a self-signed leaf presented with no intermediate at all (cannot reach a trusted root)', async () => {
    const alg = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };
    const selfKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
    const selfCert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: '99',
      name: 'CN=Attacker self-signed (synthetic)',
      notBefore: new Date(Date.now() - ONE_DAY_MS),
      notAfter: new Date(Date.now() + ONE_DAY_MS),
      signingAlgorithm: alg,
      keys: selfKeys
    });
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const forged = await new CompactSign(bytes)
      .setProtectedHeader({ alg: 'ES256', x5c: [selfCert.toString('base64'), selfCert.toString('base64')] })
      .sign(selfKeys.privateKey);
    await expect(
      verifyAndDecodeAppleSignedData(forged, { trustedRootsPem: [chain.rootCert.toString('pem')] })
    ).rejects.toThrow(AppleSignatureVerificationError);
  });

  it('rejects an expired leaf certificate', async () => {
    const expiredChain = await buildChain({
      leafNotBefore: new Date(Date.now() - 30 * ONE_DAY_MS),
      leafNotAfter: new Date(Date.now() - 1 * ONE_DAY_MS)
    });
    const jws = await signJws(payload, expiredChain);
    await expect(
      verifyAndDecodeAppleSignedData(jws, { trustedRootsPem: [expiredChain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'certificate_expired' });
  });

  it('rejects a not-yet-valid leaf certificate', async () => {
    const futureChain = await buildChain({
      leafNotBefore: new Date(Date.now() + 30 * ONE_DAY_MS),
      leafNotAfter: new Date(Date.now() + 60 * ONE_DAY_MS)
    });
    const jws = await signJws(payload, futureChain);
    await expect(
      verifyAndDecodeAppleSignedData(jws, { trustedRootsPem: [futureChain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'certificate_expired' });
  });

  it('accepts an otherwise-expired chain when a synthetic "now" within its validity window is supplied (proves the check is real, not vacuous)', async () => {
    const pastChain = await buildChain({
      rootNotBefore: new Date('2020-01-01'),
      rootNotAfter: new Date('2020-06-01'),
      leafNotBefore: new Date('2020-01-01'),
      leafNotAfter: new Date('2020-06-01')
    });
    const jws = await signJws(payload, pastChain);
    const decoded = await verifyAndDecodeAppleSignedData(jws, {
      trustedRootsPem: [pastChain.rootCert.toString('pem')],
      now: new Date('2020-03-01')
    });
    expect(decoded).toEqual(payload);
  });

  it('rejects an unsupported signing algorithm', async () => {
    // jose itself refuses to sign with alg 'none' on an asymmetric key,
    // so construct the malformed header directly instead — this test
    // only needs to prove the verifier itself rejects header.alg !==
    // 'ES256' before ever attempting a signature check.
    const header = base64UrlEncode(JSON.stringify({ alg: 'none', x5c: [chain.leafCert.toString('base64'), chain.intermediateCert.toString('base64')] }));
    const body = base64UrlEncode(JSON.stringify(payload));
    const forged = `${header}.${body}.`;
    await expect(
      verifyAndDecodeAppleSignedData(forged, { trustedRootsPem: [chain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'unsupported_algorithm' });
  });

  it('rejects a JWS with no x5c header at all', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const jws = await new CompactSign(bytes).setProtectedHeader({ alg: 'ES256' }).sign(chain.leafKeys.privateKey);
    await expect(
      verifyAndDecodeAppleSignedData(jws, { trustedRootsPem: [chain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'malformed' });
  });

  it('rejects a malformed (non-3-segment) input outright', async () => {
    await expect(
      verifyAndDecodeAppleSignedData('not-a-jws', { trustedRootsPem: [chain.rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'malformed' });
  });

  it('rejects an empty or non-string input', async () => {
    await expect(verifyAndDecodeAppleSignedData('', {})).rejects.toMatchObject({ reason: 'malformed' });
    await expect(verifyAndDecodeAppleSignedData(undefined, {})).rejects.toMatchObject({ reason: 'malformed' });
  });

  it('rejects a chain whose intermediate is not itself a CA certificate', async () => {
    const alg = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };
    const rootKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
    const rootCert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: '01',
      name: 'CN=Test Root (synthetic)',
      notBefore: new Date(Date.now() - ONE_DAY_MS),
      notAfter: new Date(Date.now() + ONE_DAY_MS),
      signingAlgorithm: alg,
      keys: rootKeys,
      extensions: [new x509.BasicConstraintsExtension(true, 2, true)]
    });
    const nonCaIntermediateKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
    // Deliberately NO BasicConstraintsExtension(ca: true) on this cert —
    // it must not be usable to vouch for a further leaf certificate.
    const nonCaIntermediate = await x509.X509CertificateGenerator.create({
      serialNumber: '02',
      subject: 'CN=Test Non-CA Intermediate (synthetic)',
      issuer: rootCert.subject,
      notBefore: new Date(Date.now() - ONE_DAY_MS),
      notAfter: new Date(Date.now() + ONE_DAY_MS),
      signingAlgorithm: alg,
      publicKey: nonCaIntermediateKeys.publicKey,
      signingKey: rootKeys.privateKey
    });
    const leafKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
    const leafCert = await x509.X509CertificateGenerator.create({
      serialNumber: '03',
      subject: 'CN=Test Leaf (synthetic)',
      issuer: nonCaIntermediate.subject,
      notBefore: new Date(Date.now() - ONE_DAY_MS),
      notAfter: new Date(Date.now() + ONE_DAY_MS),
      signingAlgorithm: alg,
      publicKey: leafKeys.publicKey,
      signingKey: nonCaIntermediateKeys.privateKey
    });
    const jws = await signJws(payload, { leafCert, intermediateCert: nonCaIntermediate, leafKeys });
    await expect(
      verifyAndDecodeAppleSignedData(jws, { trustedRootsPem: [rootCert.toString('pem')] })
    ).rejects.toMatchObject({ reason: 'invalid_basic_constraints' });
  });
});
