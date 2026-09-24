// Regression guard for IM02's registration across the three places it must
// stay in sync - same pattern as im01Registration.test.js (see that file's
// own header comment for why the manifest and the Edge Function's
// EXERCISE_PATHS Map are two separate, hand-kept-in-sync sources of truth).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getBetaVideoById, BETA_VIDEO_MANIFEST } from './betaVideoManifest';
import { MEDIA_CATALOG, getCatalogEntryById } from './mediaCatalog';

const IM02_STORAGE_PATH = 'faststart-v1/WW_IM02_InteractiveMeditation_SoftPiano_v1.m4a';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('betaVideoManifest.js — IM02 is registered exactly once, with the verified Storage path', () => {
  it('getBetaVideoById resolves IM02 to the real, unmodified object path', () => {
    const entry = getBetaVideoById('IM02');
    expect(entry).toBeDefined();
    expect(entry.storagePath).toBe(IM02_STORAGE_PATH);
  });

  it('IM02 appears exactly once in the manifest', () => {
    const matches = BETA_VIDEO_MANIFEST.filter((entry) => entry.id === 'IM02');
    expect(matches).toHaveLength(1);
  });

  it('IM02\'s title/description never claim it is narrated or a guided (instructional) session - "self-guided" (the feature\'s own name) is fine', () => {
    const entry = getBetaVideoById('IM02');
    // Excludes "self-guided" specifically (the feature name itself, expected
    // to appear) while still catching a real "guided video"/"guided
    // meditation" claim, which this track must never make.
    const claimsNarratedOrGuided = /narrat|(?<!self-)guided/;
    expect(entry.title.toLowerCase()).not.toMatch(claimsNarratedOrGuided);
    expect(entry.description.toLowerCase()).not.toMatch(claimsNarratedOrGuided);
  });
});

describe('mediaCatalog.js — IM02 is excluded from the browsable Library catalogue, same as IM01/IB01/IS01', () => {
  it('INTERACTIVE_ONLY_IDS includes IM02 alongside IM01/IB01/IS01', () => {
    const mediaCatalogSource = read('./mediaCatalog.js');
    expect(mediaCatalogSource).toMatch(/INTERACTIVE_ONLY_IDS = new Set\(\['IB01', 'IS01', 'IM01', 'IM02', 'I01', 'I02'\]\);/);
  });

  it('IM02 never appears in the real, browsable MEDIA_CATALOG', () => {
    expect(MEDIA_CATALOG.find((entry) => entry.id === 'IM02')).toBeUndefined();
    expect(getCatalogEntryById('IM02')).toBeUndefined();
  });

  it('yet IM02 is still present in the raw manifest that getBetaVideoById reads (eligibility checks keep working)', () => {
    expect(BETA_VIDEO_MANIFEST.some((entry) => entry.id === 'IM02')).toBe(true);
  });
});

describe('get-beta-video-url/index.ts — IM02 maps to the same verified Storage path server-side', () => {
  const edgeFunctionSource = read('../../supabase/functions/get-beta-video-url/index.ts');

  it("EXERCISE_PATHS carries IM02's exact path, matching betaVideoManifest.js", () => {
    expect(edgeFunctionSource).toMatch(/\['IM02', 'faststart-v1\/WW_IM02_InteractiveMeditation_SoftPiano_v1\.m4a'\],/);
  });

  it('IM02 appears exactly once in EXERCISE_PATHS', () => {
    const matches = edgeFunctionSource.match(/\['IM02',/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe('betaVideoUrlAccess.ts — IM02 is guest-allowlisted alongside IM01/IB01/IS01', () => {
  it('GUEST_ALLOWED_IDS includes IM02', () => {
    const guestAccessSource = read('../../supabase/functions/_shared/betaVideoUrlAccess.ts');
    expect(guestAccessSource).toMatch(/GUEST_ALLOWED_IDS: ReadonlySet<string> = new Set\(\['IB01', 'IS01', 'IM01', 'IM02'\]\);/);
  });
});
