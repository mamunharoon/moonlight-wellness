import { describe, it, expect } from 'vitest';
import { generateKeyPair, exportPKCS8, jwtVerify } from 'jose';
// Cross-boundary import, same pattern as appleJwsVerification.test.js —
// createBearerToken never reads Deno.env, so it is directly testable.
import { createBearerToken } from '../../supabase/functions/_shared/appleServerApi.ts';

describe('createBearerToken (App Store Server API bearer JWT)', () => {
  it('signs a real ES256 JWT with the exact claim shape Apple requires, verifiable with the matching public key', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);

    const config = {
      issuerId: 'test-issuer-id',
      keyId: 'TESTKEYID123',
      privateKeyPem,
      bundleId: 'com.zavaraai.wakewise'
    };

    const token = await createBearerToken(config);

    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      issuer: 'test-issuer-id',
      audience: 'appstoreconnect-v1'
    });

    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.kid).toBe('TESTKEYID123');
    expect(protectedHeader.typ).toBe('JWT');
    expect(payload.bid).toBe('com.zavaraai.wakewise');
    expect(payload.iss).toBe('test-issuer-id');
    expect(payload.aud).toBe('appstoreconnect-v1');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    // Apple's own documented maximum bearer-token lifetime is 60 minutes;
    // this project deliberately uses a much shorter 5-minute expiry —
    // confirm it is short, not merely present.
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(5 * 60 + 5);
  });

  it('produces a token that a wrong public key correctly fails to verify', async () => {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const { publicKey: unrelatedPublicKey } = await generateKeyPair('ES256', { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);

    const token = await createBearerToken({
      issuerId: 'test-issuer-id',
      keyId: 'TESTKEYID123',
      privateKeyPem,
      bundleId: 'com.zavaraai.wakewise'
    });

    await expect(jwtVerify(token, unrelatedPublicKey)).rejects.toThrow();
  });
});
