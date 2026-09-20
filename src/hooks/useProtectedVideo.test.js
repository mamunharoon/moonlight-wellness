// useProtectedVideo — resolveEntry parameter (added for Introduction.jsx's
// I01/I02, which are excluded from the general Library catalog this
// hook's own default resolver reads). Source-level check (this hook
// requires React Router + AuthContext providers to render, unrenderable
// in this repo's Node-environment Vitest - see Home.routineState.test.js's
// own note); the change is purely additive with a default that preserves
// every pre-existing caller's exact behaviour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useProtectedVideo.js', import.meta.url)), 'utf-8');

describe('useProtectedVideo — resolveEntry is optional and additive', () => {
  it('defaults to getCatalogEntryById, so every existing zero-arg caller (Breathe/Grounding/Library/MorningFlow/PrepareForRest/Reflection) is unaffected', () => {
    expect(source).toMatch(/export const useProtectedVideo = \(returnPathOverride, resolveEntry = getCatalogEntryById\) => \{/);
  });

  it('both the initial openId restore and the returned openVideo use the same resolveEntry, never a hardcoded getCatalogEntryById call once a custom resolver is passed', () => {
    expect(source).toMatch(/openId && !isGuest && resolveEntry\(openId\)/);
    expect(source).toMatch(/openVideo: openVideoId \? resolveEntry\(openVideoId\) : null/);
    expect(source).not.toMatch(/getCatalogEntryById\(openId\)/);
    expect(source).not.toMatch(/getCatalogEntryById\(openVideoId\)/);
  });
});
