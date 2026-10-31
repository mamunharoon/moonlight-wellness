// E08/B01 retitling (2026-10-30, owner-approved) — regression guard.
//
// Covers Change 1 of the E08-vs-B01 duplication review (see
// reports/e08-b01-deep-breathing-duplication-review-2026-10-30.md and its
// saved transcripts): both ids keep their exact id/storagePath/category —
// only title/description changed, in both the manifest (the authoritative
// source, consumed by Library/Support/search via mediaCatalog.js) and
// Breathe.jsx's own `blurb` (the separate, contextual description
// actually rendered on this page — see BetaVideoRow.jsx's own doc
// comment on why that field exists apart from the manifest's
// `description`).
//
// PROD note: on this branch, BREATHE_VIDEOS/BREATHING_SESSION_VIDEOS
// still live inline in src/pages/Breathe.jsx (dev's later extraction into
// a standalone src/lib/guidedBreathingVideos.js module is an unrelated
// structural refactor, not part of this approved retitling, and is not
// promoted here) — read as source text rather than imported, matching
// this codebase's own established precedent for page-level checks
// (Vitest here has no DOM/component-rendering setup).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BETA_VIDEO_MANIFEST, getBetaVideoById } from './betaVideoManifest';
import { MEDIA_CATALOG, getCatalogEntryById } from './mediaCatalog';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const breatheSource = read('../pages/Breathe.jsx');

const extractArray = (source, arrayName) => {
  const re = new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\n\\];`);
  const match = source.match(re);
  if (!match) throw new Error(`Could not locate ${arrayName} in Breathe.jsx`);
  return [...match[1].matchAll(/\{\s*id:\s*'([A-Z0-9]+)',\s*blurb:\s*'((?:[^'\\]|\\.)*)'\s*\}/g)].map((m) => ({ id: m[1], blurb: m[2] }));
};

describe('betaVideoManifest.js — E08/B01 new titles and descriptions', () => {
  it('E08 is retitled "Calming Breath Meditation" with the counting/hold-accurate description', () => {
    const e08 = getBetaVideoById('E08');
    expect(e08.title).toBe('Calming Breath Meditation');
    expect(e08.description).toBe('A short, guided breathing meditation with gentle counting and brief breath holds.');
  });

  it('B01 is retitled "Gentle Breathing Basics" with the no-holding/own-pace-accurate description', () => {
    const b01 = getBetaVideoById('B01');
    expect(b01.title).toBe('Gentle Breathing Basics');
    expect(b01.description).toBe('Learn comfortable belly breathing at your own pace, without holding your breath.');
  });

  it('neither the old title nor the old description string survives anywhere in the manifest', () => {
    const serialized = JSON.stringify(BETA_VIDEO_MANIFEST);
    expect(serialized).not.toContain('Deep Breathing Practice');
    expect(serialized).not.toContain('"Deep Breathing"');
    expect(serialized).not.toContain('A guided deep-breathing video to center yourself.');
    expect(serialized).not.toContain('A guided video for a deep breathing practice.');
  });

  it('id, storagePath, and category are unchanged by the retitling — only the two text fields moved', () => {
    const e08 = getBetaVideoById('E08');
    const b01 = getBetaVideoById('B01');
    expect(e08.id).toBe('E08');
    expect(e08.storagePath).toBe('faststart-v1/WW_E08_DeepBreathing_v2.mp4_faststart.mp4');
    expect(b01.id).toBe('B01');
    expect(b01.storagePath).toBe('faststart-v1/WW_B01_DeepBreathing_Mobile_Background_v1.png_faststart.mp4');

    const e08Catalog = getCatalogEntryById('E08');
    const b01Catalog = getCatalogEntryById('B01');
    expect(e08Catalog.category).toBe('Breathing');
    expect(b01Catalog.category).toBe('Breathing');
  });
});

describe('mediaCatalog.js (Library/Explore/search) — derives the new titles/descriptions live, nothing cached stale', () => {
  it('MEDIA_CATALOG entries for E08/B01 carry the new title/description (what Library renders and search matches against)', () => {
    const e08 = MEDIA_CATALOG.find((entry) => entry.id === 'E08');
    const b01 = MEDIA_CATALOG.find((entry) => entry.id === 'B01');
    expect(e08.title).toBe('Calming Breath Meditation');
    expect(b01.title).toBe('Gentle Breathing Basics');
    // Library.jsx's own search filter is `${entry.title} ${entry.description}`.toLowerCase().includes(query) —
    // reproduced here so a regression in that derivation (not just the manifest) would fail this test too.
    const matchesQuery = (entry, query) => `${entry.title} ${entry.description}`.toLowerCase().includes(query.toLowerCase());
    expect(matchesQuery(e08, 'calming breath')).toBe(true);
    expect(matchesQuery(b01, 'gentle breathing basics')).toBe(true);
    expect(matchesQuery(e08, 'deep breathing')).toBe(false);
    expect(matchesQuery(b01, 'deep breathing practice')).toBe(false);
  });
});

describe('Breathe.jsx — Morning breathing-page blurbs kept in sync with the retitling', () => {
  const breatheVideos = extractArray(breatheSource, 'BREATHE_VIDEOS');
  const breathingSessionVideos = extractArray(breatheSource, 'BREATHING_SESSION_VIDEOS');

  it('E08 blurb (BREATHE_VIDEOS) matches the new manifest description', () => {
    const e08 = breatheVideos.find((v) => v.id === 'E08');
    expect(e08.blurb).toBe('A short, guided breathing meditation with gentle counting and brief breath holds.');
  });

  it('B01 blurb (BREATHING_SESSION_VIDEOS) matches the new manifest description', () => {
    const b01 = breathingSessionVideos.find((v) => v.id === 'B01');
    expect(b01.blurb).toBe('Learn comfortable belly breathing at your own pace, without holding your breath.');
  });

  it('collection membership/order is unchanged — this was a text-only change', () => {
    expect(breatheVideos.map((v) => v.id)).toEqual(['E08', 'E28']);
    expect(breathingSessionVideos.map((v) => v.id)).toEqual(['B01', 'B02', 'B03', 'B04', 'B05']);
  });

  it('neither old blurb string survives in Breathe.jsx', () => {
    expect(breatheSource).not.toContain('A guided video for this breathing exercise.');
    expect(breatheSource).not.toContain('A guided video for a deep breathing practice.');
  });
});
