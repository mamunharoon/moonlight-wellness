// Immediate Account Deletion — review finding: auth_delete_failed leaves
// every user-owned row (including profiles) genuinely deleted while the
// Auth user itself survives (only its own removal failed). Without this
// guard, AuthContext.jsx's own loadProfile (its missing-profile
// auto-create branch exists for a genuinely brand-new signup) would
// silently hand that stuck account a fresh, blank profile the next time
// it loads — "healing" an incomplete deletion into a different,
// confusing state instead of ever prompting the user to finish it.
// Source-level checks, same convention as this repo's other context
// tests (no DOM/component rendering available).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./AuthContext.jsx', import.meta.url)), 'utf-8');

const loadProfileBody = () => source.match(/const loadProfile = async \(currentUser\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('AuthContext.jsx — loadProfile checks for a stuck deletion before auto-creating a missing profile', () => {
  it('imports getMyDeletionRequest from the real, shared deletion API module', () => {
    expect(source).toMatch(/import \{ getMyDeletionRequest \} from '\.\.\/lib\/accountDeletionApi';/);
  });

  it('checks getMyDeletionRequest BEFORE the upsert that would create a fresh profile', () => {
    const body = loadProfileBody();
    expect(body).not.toBe('');
    const checkIndex = body.indexOf('getMyDeletionRequest(currentUser.id)');
    const upsertIndex = body.indexOf(".from('profiles')\n      .upsert(");
    expect(checkIndex).toBeGreaterThan(-1);
    expect(upsertIndex).toBeGreaterThan(checkIndex);
  });

  it('a "processing" request (a prior attempt that died partway, per accountDeletion.ts) short-circuits with profile left null and a profileError set - never falls through to auto-create', () => {
    const body = loadProfileBody();
    const guardBlock = body.match(/if \(deletionRequest\?\.status === 'processing'\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(guardBlock).not.toBe('');
    expect(guardBlock).toMatch(/setProfile\(null\);/);
    expect(guardBlock).toMatch(/setProfileError\(/);
    expect(guardBlock).toMatch(/return;/);
  });

  it('every other status (no request, cancelled, completed - a genuinely new signup) falls through to the existing auto-create behaviour, unchanged', () => {
    const body = loadProfileBody();
    expect(body).toMatch(/\.upsert\(\s*\n\s*\{\s*\n\s*id: currentUser\.id,/);
  });
});
