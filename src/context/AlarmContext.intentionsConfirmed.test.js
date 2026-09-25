// F1 (pre-Build-15 usability pass) — suggested-vs-selected intention
// distinction. Found live: a fresh guest's `intentions` settles to
// DEFAULT_INTENTIONS on first render and is immediately persisted to
// guest localStorage, making a never-touched default byte-identical to a
// genuine guest selection - Home's "Active Intention"/"Change intention"
// styling then misrepresented a helpful default as real personalisation.
// No DOM rendering is available in this repo's Vitest (environment:
// 'node') - source-level checks, matching every other regression guard
// in this codebase (AlarmContext.jsx itself has no prior test file - this
// is its first).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./AlarmContext.jsx', import.meta.url)), 'utf-8');

describe('AlarmContext — intentionsConfirmed: the reliable "genuine save happened" signal', () => {
  it('never infers "confirmed" from the intentions VALUE matching DEFAULT_INTENTIONS - the brief explicitly rules this out, since a guest could deliberately pick exactly those two', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/intentions\s*===\s*DEFAULT_INTENTIONS/);
    expect(codeOnly).not.toMatch(/JSON\.stringify\(intentions\)\s*===\s*JSON\.stringify\(DEFAULT_INTENTIONS\)/);
  });

  it('is a new, guest-only localStorage key, separate from INTENTIONS_KEY, defaulting to false', () => {
    expect(source).toMatch(/const INTENTIONS_CONFIRMED_KEY = 'moonlight_intentions_confirmed';/);
    expect(source).toMatch(/const getInitialIntentionsConfirmed = \(\) => \{\s*\n\s*try \{\s*\n\s*return localStorage\.getItem\(INTENTIONS_CONFIRMED_KEY\) === 'true';\s*\n\s*\} catch \{\s*\n\s*return false;\s*\n\s*\}\s*\n\};/);
  });

  it('the guest-persist effect mirrors the existing intentions-persist effect exactly - same identity guard (settledIntentionsUserIdRef), so a stale outgoing identity can never write into the next guest\'s storage', () => {
    const block = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(authLoading \|\| !isGuest\) return;\s*\n\s*if \(settledIntentionsUserIdRef\.current !== userId\) return;\s*\n\s*localStorage\.setItem\(INTENTIONS_CONFIRMED_KEY,[\s\S]*?\}, \[intentionsConfirmed, authLoading, isGuest, userId\]\);/);
    expect(block).not.toBeNull();
  });

  it('authenticated: a fetched user_intentions row is already proof of a genuine past save - set true only when a real row is found, never inferred from the fetched value', () => {
    const fetchBody = source.match(/const fetchIntention = async \(uid\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fetchBody).toMatch(/setIntentions\(fetched\);\s*\n[\s\S]*?setIntentionsConfirmed\(true\);/);
    expect(fetchBody).toMatch(/setIntentions\(\[data\.intention\]\);\s*\n\s*setIntentionsConfirmed\(true\);/);
  });

  it('identity-sync (syncIntentions): guest re-reads the flag fresh on every transition (e.g. right after sign-out, never inherited); a freshly authenticated identity resets to false BEFORE the fetch, so it can never briefly show a previous identity\'s confirmed state', () => {
    const syncBody = source.match(/const syncIntentions = async \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(syncBody).toMatch(/setIntentions\(getInitialIntentions\(\)\);\s*\n[\s\S]*?setIntentionsConfirmed\(getInitialIntentionsConfirmed\(\)\);\s*\n\s*return;/);
    expect(syncBody).toMatch(/setIntentions\(DEFAULT_INTENTIONS\);\s*\n[\s\S]*?setIntentionsConfirmed\(false\);\s*\n\s*await fetchIntention\(userId\);/);
  });

  it('is exposed via context value, alongside its setter, for pages to read/confirm', () => {
    const providerBlock = source.match(/<AlarmContext\.Provider value=\{\{[\s\S]*?\}\}>/)?.[0] ?? '';
    expect(providerBlock).toMatch(/intentionsConfirmed,/);
    expect(providerBlock).toMatch(/setIntentionsConfirmed,/);
  });
});
