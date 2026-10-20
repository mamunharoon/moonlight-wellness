// DEV service-role credential exposure remediation (tracker SEC-07/E-37).
//
// Cross-boundary import of a Deno Edge Function shared module, same
// established pattern as entitlementResolution.serverMirror.test.js's own
// import of '../../supabase/functions/_shared/entitlementResolution.ts' -
// safe because apiKeyResolution.ts itself has no Deno-specific import or
// API (no `npm:` specifier, no Deno.env call), so plain Node/Vite module
// resolution handles it exactly like any other ESM file. Real, executable
// coverage for the fail-closed JSON-key resolution supabaseAdmin.ts's two
// client factories both depend on - not left untested just because the
// surrounding file (supabaseAdmin.ts itself) needs a Deno runtime.
import { describe, it, expect } from 'vitest';
import { resolveNamedKey } from '../../supabase/functions/_shared/apiKeyResolution.ts';

describe('resolveNamedKey — the new Supabase API key JSON-resolution helper', () => {
  it('resolves the default key from a well-formed JSON object', () => {
    expect(resolveNamedKey('{"default":"sb_secret_abc123"}')).toBe('sb_secret_abc123');
  });

  it('resolves a non-default name when explicitly asked', () => {
    expect(resolveNamedKey('{"default":"a","billing":"b"}', 'billing')).toBe('b');
  });

  it('fails closed (empty string) when the raw value is undefined', () => {
    expect(resolveNamedKey(undefined)).toBe('');
  });

  it('fails closed when the raw value is null', () => {
    expect(resolveNamedKey(null)).toBe('');
  });

  it('fails closed when the raw value is an empty string', () => {
    expect(resolveNamedKey('')).toBe('');
  });

  it('fails closed on malformed JSON rather than throwing', () => {
    expect(() => resolveNamedKey('{not valid json')).not.toThrow();
    expect(resolveNamedKey('{not valid json')).toBe('');
  });

  it('fails closed when the parsed JSON is not an object (e.g. a bare string or number)', () => {
    expect(resolveNamedKey('"just a string"')).toBe('');
    expect(resolveNamedKey('42')).toBe('');
  });

  it('fails closed when the parsed JSON is null', () => {
    expect(resolveNamedKey('null')).toBe('');
  });

  it('fails closed when the parsed JSON is an array, not a keyed object', () => {
    expect(resolveNamedKey('["sb_secret_abc123"]')).toBe('');
  });

  it('fails closed when the requested name is absent from an otherwise well-formed object', () => {
    expect(resolveNamedKey('{"other":"value"}')).toBe('');
  });

  it('fails closed when the named value is not itself a string (wrong type)', () => {
    expect(resolveNamedKey('{"default":12345}')).toBe('');
    expect(resolveNamedKey('{"default":null}')).toBe('');
    expect(resolveNamedKey('{"default":{"nested":"object"}}')).toBe('');
    expect(resolveNamedKey('{"default":["array"]}')).toBe('');
  });

  it('never throws for any input across every case above - a caller can always safely pass the result straight into createClient()', () => {
    const inputs = [undefined, null, '', '{not valid json', '"string"', '42', 'null', '[]', '{}', '{"default":12345}'];
    for (const input of inputs) {
      expect(() => resolveNamedKey(input)).not.toThrow();
    }
  });
});
