// DEV service-role credential exposure remediation (tracker SEC-07/E-37)
// — source-level check, same convention as this repo's other simple
// config files: supabaseClient.js only reads import.meta.env at module
// load time, which Vitest's node environment can't exercise directly, so
// this asserts on the source text itself rather than importing the module.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./supabaseClient.js', import.meta.url)), 'utf-8');

describe('supabaseClient.js — migrated to the new publishable key', () => {
  it('reads VITE_SUPABASE_PUBLISHABLE_KEY', () => {
    expect(source).toMatch(/import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it('never reads the legacy VITE_SUPABASE_ANON_KEY', () => {
    expect(source).not.toMatch(/VITE_SUPABASE_ANON_KEY/);
  });

  it('still reads VITE_SUPABASE_URL unchanged', () => {
    expect(source).toMatch(/import\.meta\.env\.VITE_SUPABASE_URL/);
  });
});
