// Regression guard for IM01's registration across the three places it must
// stay in sync (see betaVideoManifest.js's own top-of-file doc comment on
// why the manifest and the Edge Function's EXERCISE_PATHS Map are two
// separate, hand-kept-in-sync sources of truth). Source-level checks for
// the two files this repo's Vitest cannot otherwise reach (a Deno Edge
// Function) or that are plain data modules already covered structurally by
// import - matches interactiveMusicAssets.test.js's own established
// pattern for IB01/IS01.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getBetaVideoById, BETA_VIDEO_MANIFEST } from './betaVideoManifest';

const IM01_STORAGE_PATH = 'faststart-v1/WW_IM01_InteractiveMeditation_MusicBed_v1.m4a';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('betaVideoManifest.js — IM01 is registered exactly once, with the verified Storage path', () => {
  it('getBetaVideoById resolves IM01 to the real, unmodified object path', () => {
    const entry = getBetaVideoById('IM01');
    expect(entry).toBeDefined();
    expect(entry.storagePath).toBe(IM01_STORAGE_PATH);
  });

  it('IM01 appears exactly once in the manifest', () => {
    const matches = BETA_VIDEO_MANIFEST.filter((entry) => entry.id === 'IM01');
    expect(matches).toHaveLength(1);
  });
});

describe('mediaCatalog.js — IM01 is excluded from the browsable Library catalogue, same as IB01/IS01', () => {
  const mediaCatalogSource = read('./mediaCatalog.js');

  it('INTERACTIVE_ONLY_IDS includes IM01 alongside IB01/IS01/IM02', () => {
    expect(mediaCatalogSource).toMatch(/INTERACTIVE_ONLY_IDS = new Set\(\['IB01', 'IS01', 'IM01', 'IM02', 'I01', 'I02'\]\);/);
  });
});

describe('get-beta-video-url/index.ts — IM01 maps to the same verified Storage path server-side', () => {
  const edgeFunctionSource = read('../../supabase/functions/get-beta-video-url/index.ts');

  it("EXERCISE_PATHS carries IM01's exact path, matching betaVideoManifest.js", () => {
    expect(edgeFunctionSource).toMatch(/\['IM01', 'faststart-v1\/WW_IM01_InteractiveMeditation_MusicBed_v1\.m4a'\],/);
  });

  it('IM01 appears exactly once in EXERCISE_PATHS', () => {
    const matches = edgeFunctionSource.match(/\['IM01',/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});
