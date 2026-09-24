// useProtectedVideo — resolveEntry parameter (added for Introduction.jsx's
// I01/I02, which are excluded from the general Library catalog this
// hook's own default resolver reads) and guestAllowedIds (Build 16,
// added so Introduction.jsx's I01 pill can open directly for a guest).
// Source-level check (this hook requires React Router + AuthContext
// providers to render, unrenderable in this repo's Node-environment
// Vitest - see Home.routineState.test.js's own note); both changes are
// purely additive with defaults that preserve every pre-existing
// caller's exact behaviour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useProtectedVideo.js', import.meta.url)), 'utf-8');

describe('useProtectedVideo — resolveEntry is optional and additive', () => {
  it('defaults to getCatalogEntryById, so every existing zero-arg caller (Breathe/Grounding/Library/MorningFlow/PrepareForRest/Reflection) is unaffected', () => {
    expect(source).toMatch(
      /export const useProtectedVideo = \(returnPathOverride, resolveEntry = getCatalogEntryById, guestAllowedIds = EMPTY_GUEST_ALLOWED_IDS\) => \{/
    );
  });

  it('both the initial openId restore and the returned openVideo use the same resolveEntry, never a hardcoded getCatalogEntryById call once a custom resolver is passed', () => {
    expect(source).toMatch(/resolveEntry\(openId\)/);
    expect(source).toMatch(/openVideo: openVideoId \? resolveEntry\(openVideoId\) : null/);
    expect(source).not.toMatch(/getCatalogEntryById\(openId\)/);
    expect(source).not.toMatch(/getCatalogEntryById\(openVideoId\)/);
  });
});

describe('useProtectedVideo — guestAllowedIds is optional and additive (Build 16)', () => {
  it('defaults to a stable, module-level empty Set - every existing caller that omits it keeps the exact original "always prompt a guest" behaviour', () => {
    expect(source).toMatch(/const EMPTY_GUEST_ALLOWED_IDS = new Set\(\);/);
  });

  it('handleSelect only skips the sign-in prompt for a guest when the id is in guestAllowedIds - every other guest tap still prompts, exactly as before', () => {
    const handler = source.match(/const handleSelect = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handler).toMatch(/if \(isGuest && !guestAllowedIds\.has\(id\)\) \{/);
    expect(handler).toMatch(/setPromptId\(id\);/);
    expect(handler).toMatch(/setOpenVideoId\(id\);/);
  });

  it('the initial openId restore respects the same exception, so a guest-allowed id can also be restored after a redirect', () => {
    expect(source).toMatch(/openId && \(!isGuest \|\| guestAllowedIds\.has\(openId\)\) && resolveEntry\(openId\)/);
  });
});
