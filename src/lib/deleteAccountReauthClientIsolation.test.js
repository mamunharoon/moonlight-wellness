// Account-deletion reauthentication — client isolation fix. Found live on
// DEV B61 (owner report, 24-Oct-2026): the exact password that had just
// signed the user into the app moments earlier was rejected during
// delete-account's own reauthentication step. Source-level check -
// supabase/functions/delete-account/index.ts is Deno-only (Deno.serve,
// npm: imports) and is never imported by this repo's Vitest, matching
// this codebase's established convention of never unit-executing a
// Deno.serve wrapper directly (same as stripe-webhook/revenuecat-webhook -
// see those test files' own headers).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('../../supabase/functions/delete-account/index.ts', import.meta.url)),
  'utf-8'
);

const reauthenticateBody = () =>
  source.match(/reauthenticate: async \(email, pwd\) => \{[\s\S]*?\n {6}\},/)?.[0] ?? '';

describe('delete-account/index.ts — reauthenticate uses its own fresh Supabase client, never the outer authClient', () => {
  it('reauthenticate creates a NEW client via createSupabaseAuthClient() inside its own body', () => {
    const body = reauthenticateBody();
    expect(body).not.toBe('');
    expect(body).toMatch(/const reauthClient = createSupabaseAuthClient\(\);/);
    expect(body).toMatch(/reauthClient\.auth\.signInWithPassword\(\{ email, password: pwd \}\);/);
  });

  it('reauthenticate never calls signInWithPassword on the outer authClient (the one already used for .auth.getUser(jwt))', () => {
    const body = reauthenticateBody();
    // Word-boundary lookbehind so this doesn't false-positive on
    // "reauthClient" (the new, correctly-isolated variable) merely
    // because it also ends in "authClient".
    expect(body).not.toMatch(/(?<![a-zA-Z])authClient\.auth\.signInWithPassword/);
  });

  it('the outer authClient is still used for its own original purpose (verifying the caller\'s JWT) - this fix only isolates the password-grant call, it does not remove or duplicate the identity check', () => {
    expect(source).toMatch(/const authClient = createSupabaseAuthClient\(\);/);
    expect(source).toMatch(/authClient\.auth\.getUser\(jwt\);/);
  });

  it('resolveAccountDeletionRequest is still called with the JWT-verified user object (user.email is sourced from there, not from client-supplied body) - ruled out as a separate cause, not touched by this fix', () => {
    expect(source).toMatch(/resolveAccountDeletionRequest\(\s*\n\s*\{ user, password, confirmationPhrase \},/);
    expect(source).toMatch(/const user = userData\.user;/);
  });
});
