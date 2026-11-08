// Immediate Account Deletion — review finding: delete-account/index.ts's
// own OUTCOME_RESPONSES must never claim an account is "fully intact"
// for an outcome where that isn't true. Source-level check (reading the
// raw file text, never importing it - index.ts calls Deno.serve() at
// module scope, which would throw under this repo's Node-based Vitest;
// see betaVideoUrlAccess.test.js's own convention of only ever importing
// a function's _shared pure module, never its index.ts, for exactly
// this reason).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('../../supabase/functions/delete-account/index.ts', import.meta.url)),
  'utf-8'
);

const outcomeResponsesBody = () => source.match(/const OUTCOME_RESPONSES = \{[\s\S]*?\n\};/)?.[0] ?? '';

describe('delete-account/index.ts — OUTCOME_RESPONSES never overstates intactness once data could already be gone', () => {
  it('found the outcome map', () => {
    expect(outcomeResponsesBody()).not.toBe('');
  });

  it('data_delete_failed and auth_delete_failed never claim the account/data is intact, safe, or unaffected', () => {
    const body = outcomeResponsesBody();
    const dataDeleteLine = body.match(/data_delete_failed: \[503, \{ error: "[^"]*" \}\],/)?.[0] ?? '';
    const authDeleteLine = body.match(/auth_delete_failed: \[503, \{ error: "[^"]*" \}\],/)?.[0] ?? '';
    expect(dataDeleteLine).not.toBe('');
    expect(authDeleteLine).not.toBe('');
    for (const line of [dataDeleteLine, authDeleteLine]) {
      expect(line).not.toMatch(/intact|has not been deleted|safe to/i);
    }
  });

  it('auth_delete_failed explicitly discloses that data was already deleted, not left as a surprise', () => {
    const body = outcomeResponsesBody();
    expect(body).toMatch(/auth_delete_failed: \[503, \{ error: "Your data was deleted but removing your account itself did not finish/);
  });

  it('data_delete_failed explicitly discloses that data may be partially deleted, never implying nothing happened', () => {
    const body = outcomeResponsesBody();
    expect(body).toMatch(/data_delete_failed: \[503, \{ error: "Deleting your account did not finish and your data may be partially deleted/);
  });

  it('"has not been deleted" appears in an actual message value only for stripe_cancel_failed - any other occurrence is comment-only explanation, never a second outcome\'s real message', () => {
    const body = outcomeResponsesBody();
    const messageValues = Array.from(body.matchAll(/error: (?:'([^']*)'|"([^"]*)")/g)).map((m) => m[1] ?? m[2]);
    const claimingIntact = messageValues.filter((msg) => /has not been deleted/i.test(msg));
    expect(claimingIntact).toEqual(["We couldn't finish cancelling your subscription. Your account has not been deleted. Please try again."]);
  });
});
