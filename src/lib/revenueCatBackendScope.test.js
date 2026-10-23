// Real execution against the ACTUAL production module — same
// cross-boundary pattern revenueCatWebhookHandler.test.js already
// established (the real module lives under supabase/functions/_shared/
// and is not itself Deno-specific).
import { describe, it, expect } from 'vitest';
import {
  extractProjectRef,
  buildScopedAppUserId,
  resolveEventBackendScope,
  PRODUCTION_PROJECT_REF
} from '../../supabase/functions/_shared/revenueCatBackendScope.js';

const DEV_REF = 'kvdxuhyndevrfvsalgnx';
const OTHER_REF = 'zudpthlngpiisjkuofcx';
const VALID_UUID = '12345678-1234-1234-1234-123456789abc';
const OTHER_VALID_UUID = 'abcdef12-abcd-abcd-abcd-abcdef123456';

describe('extractProjectRef', () => {
  it('extracts the ref from a real production URL', () => {
    expect(extractProjectRef(`https://${PRODUCTION_PROJECT_REF}.supabase.co`)).toBe(PRODUCTION_PROJECT_REF);
  });

  it('extracts the ref from a real DEV URL', () => {
    expect(extractProjectRef(`https://${DEV_REF}.supabase.co`)).toBe(DEV_REF);
  });

  it('is case-insensitive on the host but always returns lowercase', () => {
    expect(extractProjectRef(`https://${PRODUCTION_PROJECT_REF.toUpperCase()}.SUPABASE.CO`)).toBe(PRODUCTION_PROJECT_REF);
  });

  it('returns null for a missing, empty, or non-Supabase URL - never guesses', () => {
    expect(extractProjectRef(undefined)).toBeNull();
    expect(extractProjectRef(null)).toBeNull();
    expect(extractProjectRef('')).toBeNull();
    expect(extractProjectRef('not a url')).toBeNull();
    expect(extractProjectRef('https://example.com')).toBeNull();
    expect(extractProjectRef('http://wqpszprbuqdjcfmdqdlv.supabase.co')).toBeNull(); // http, not https
  });
});

describe('buildScopedAppUserId', () => {
  it('scopes only when the own ref is the production ref', () => {
    expect(buildScopedAppUserId(PRODUCTION_PROJECT_REF, VALID_UUID)).toBe(`${PRODUCTION_PROJECT_REF}:${VALID_UUID}`);
  });

  it('passes the bare id through unchanged on DEV - preserves existing DEV identities', () => {
    expect(buildScopedAppUserId(DEV_REF, VALID_UUID)).toBe(VALID_UUID);
  });

  it('passes the bare id through unchanged for any other/unrecognised ref, including null', () => {
    expect(buildScopedAppUserId(OTHER_REF, VALID_UUID)).toBe(VALID_UUID);
    expect(buildScopedAppUserId(null, VALID_UUID)).toBe(VALID_UUID);
    expect(buildScopedAppUserId(undefined, VALID_UUID)).toBe(VALID_UUID);
  });
});

describe('resolveEventBackendScope — fails closed on an unresolved own ref', () => {
  it('rejects every event, regardless of content, when ownProjectRef is null/empty', () => {
    expect(resolveEventBackendScope(`${PRODUCTION_PROJECT_REF}:${VALID_UUID}`, null)).toEqual({ userId: null, rejectReason: 'backend_ref_unresolved' });
    expect(resolveEventBackendScope(VALID_UUID, null)).toEqual({ userId: null, rejectReason: 'backend_ref_unresolved' });
    expect(resolveEventBackendScope(undefined, '')).toEqual({ userId: null, rejectReason: 'backend_ref_unresolved' });
  });
});

describe('resolveEventBackendScope — on the production backend', () => {
  it('accepts only an id scoped to exactly the production ref', () => {
    expect(resolveEventBackendScope(`${PRODUCTION_PROJECT_REF}:${VALID_UUID}`, PRODUCTION_PROJECT_REF)).toEqual({
      userId: VALID_UUID,
      rejectReason: null
    });
  });

  it('rejects a bare/unscoped id - production never falls back to legacy trust', () => {
    expect(resolveEventBackendScope(VALID_UUID, PRODUCTION_PROJECT_REF)).toEqual({ userId: null, rejectReason: 'unscoped_on_production' });
  });

  it('rejects an id scoped to a different backend (DEV-origin, or any other ref)', () => {
    expect(resolveEventBackendScope(`${DEV_REF}:${VALID_UUID}`, PRODUCTION_PROJECT_REF)).toEqual({ userId: null, rejectReason: 'wrong_backend' });
    expect(resolveEventBackendScope(`${OTHER_REF}:${VALID_UUID}`, PRODUCTION_PROJECT_REF)).toEqual({ userId: null, rejectReason: 'wrong_backend' });
  });

  it('rejects a correctly-scoped prefix wrapping a malformed uuid', () => {
    expect(resolveEventBackendScope(`${PRODUCTION_PROJECT_REF}:not-a-uuid`, PRODUCTION_PROJECT_REF)).toEqual({
      userId: null,
      rejectReason: 'invalid_app_user_id'
    });
  });

  it('rejects malformed/empty app_user_id values outright', () => {
    expect(resolveEventBackendScope(undefined, PRODUCTION_PROJECT_REF)).toEqual({ userId: null, rejectReason: 'unscoped_on_production' });
    expect(resolveEventBackendScope('', PRODUCTION_PROJECT_REF)).toEqual({ userId: null, rejectReason: 'unscoped_on_production' });
    expect(resolveEventBackendScope(42, PRODUCTION_PROJECT_REF)).toEqual({ userId: null, rejectReason: 'unscoped_on_production' });
  });

  // The exact scenario a cloned/coincidentally-shared UUID across
  // projects would produce: the SAME uuid, once correctly scoped to
  // production and once left bare (as DEV would send it) - only the
  // correctly-scoped one is ever accepted on production, regardless of
  // whether that uuid also happens to exist in DEV's own auth.users.
  it('a UUID that exists in both projects still cannot pass as DEV-scoped (bare) on production', () => {
    expect(resolveEventBackendScope(VALID_UUID, PRODUCTION_PROJECT_REF).userId).toBeNull();
    expect(resolveEventBackendScope(`${PRODUCTION_PROJECT_REF}:${VALID_UUID}`, PRODUCTION_PROJECT_REF).userId).toBe(VALID_UUID);
  });
});

describe('resolveEventBackendScope — on a non-production (DEV) backend', () => {
  it('accepts a bare/unscoped id - the exact legacy DEV shape, unchanged', () => {
    expect(resolveEventBackendScope(VALID_UUID, DEV_REF)).toEqual({ userId: VALID_UUID, rejectReason: null });
  });

  it('accepts an id correctly self-scoped to this same (non-production) ref - forward-compatible, unused today', () => {
    expect(resolveEventBackendScope(`${DEV_REF}:${OTHER_VALID_UUID}`, DEV_REF)).toEqual({ userId: OTHER_VALID_UUID, rejectReason: null });
  });

  it('rejects an id scoped to a DIFFERENT backend, including production', () => {
    expect(resolveEventBackendScope(`${PRODUCTION_PROJECT_REF}:${VALID_UUID}`, DEV_REF)).toEqual({ userId: null, rejectReason: 'wrong_backend' });
    expect(resolveEventBackendScope(`${OTHER_REF}:${VALID_UUID}`, DEV_REF)).toEqual({ userId: null, rejectReason: 'wrong_backend' });
  });

  it('still rejects a malformed uuid even when otherwise correctly scoped (or bare)', () => {
    expect(resolveEventBackendScope('not-a-uuid', DEV_REF)).toEqual({ userId: null, rejectReason: 'invalid_app_user_id' });
    expect(resolveEventBackendScope(`${DEV_REF}:not-a-uuid`, DEV_REF)).toEqual({ userId: null, rejectReason: 'invalid_app_user_id' });
  });
});
