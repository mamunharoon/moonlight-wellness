// Regression guard for the SL01-SL10 Build 15 true-fast-start migration:
// registration/security checks across every place these ids must stay in
// sync (see betaVideoManifest.js's own top-of-file doc comment on why the
// manifest and the Edge Function's EXERCISE_PATHS Map are two separate,
// hand-kept-in-sync sources of truth). Source-level checks for the Deno
// Edge Function this repo's Vitest cannot otherwise import - matches
// im01Registration.test.js/im02Registration.test.js's own established
// pattern.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getBetaVideoById, BETA_VIDEO_MANIFEST } from './betaVideoManifest';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const SL_ENTRIES = {
  SL01: { storagePath: 'faststart-v2/WW_SL01_Rain_v2_faststart.mp4', durationLabel: '2 min' },
  SL02: { storagePath: 'faststart-v2/WW_SL02_OceanWaves_Preview_v2_faststart.mp4', durationLabel: '3 min' },
  SL03: { storagePath: 'faststart-v2/WW_SL03_ForestAmbience_v2_faststart.mp4', durationLabel: '3 min' },
  SL04: { storagePath: 'faststart-v2/WW_SL04_Fireplace_v2_faststart.mp4', durationLabel: '3 min' },
  SL05: { storagePath: 'faststart-v2/WW_SL05_Wind_v2_faststart.mp4', durationLabel: '2 min' },
  SL06: { storagePath: 'faststart-v2/WW_SL06_WhiteNoise_v2_faststart.mp4', durationLabel: '3 min' },
  SL07: { storagePath: 'faststart-v2/WW_SL07_PinkNoise_v2_faststart.mp4', durationLabel: '3 min' },
  SL08: { storagePath: 'faststart-v2/WW_SL08_BrownNoise_v2_faststart.mp4', durationLabel: '3 min' },
  SL09: { storagePath: 'faststart-v2/WW_SL09_SoothingBirds_v1_faststart.mp4', durationLabel: '3 min' },
  SL10: { storagePath: 'faststart-v2/WW_SL10_RustlingLeaves_v1_faststart.mp4', durationLabel: '3 min' }
};

describe('betaVideoManifest.js — every SL01-SL10 id is registered exactly once, with the verified faststart-v2/ path', () => {
  for (const [id, { storagePath, durationLabel }] of Object.entries(SL_ENTRIES)) {
    it(`${id} resolves to its real, corrected faststart-v2/ object path and rounded duration`, () => {
      const entry = getBetaVideoById(id);
      expect(entry).toBeDefined();
      expect(entry.storagePath).toBe(storagePath);
      expect(entry.durationLabel).toBe(durationLabel);
      // None of the ten may still point at the original faststart-v1/
      // objects - those are left in Storage untouched for rollback, but
      // must no longer be referenced by the live manifest.
      expect(entry.storagePath.startsWith('faststart-v2/')).toBe(true);
      // None of the ten may still claim the old, unverified "5 min" label.
      expect(entry.durationLabel).not.toBe('5 min');
    });
  }

  it('every SL id appears exactly once in the manifest', () => {
    for (const id of Object.keys(SL_ENTRIES)) {
      const matches = BETA_VIDEO_MANIFEST.filter((entry) => entry.id === id);
      expect(matches, `${id} should appear exactly once`).toHaveLength(1);
    }
  });
});

describe('get-beta-video-url/index.ts — every SL01-SL10 id maps to the same verified faststart-v2/ path server-side', () => {
  const edgeFunctionSource = read('../../supabase/functions/get-beta-video-url/index.ts');

  for (const [id, { storagePath }] of Object.entries(SL_ENTRIES)) {
    it(`EXERCISE_PATHS carries ${id}'s exact path, matching betaVideoManifest.js`, () => {
      const escaped = storagePath.replace(/\./g, '\\.').replace(/\//g, '\\/');
      expect(edgeFunctionSource).toMatch(new RegExp(`\\['${id}', '${escaped}'\\],`));
    });

    it(`${id} appears exactly once in EXERCISE_PATHS`, () => {
      const matches = edgeFunctionSource.match(new RegExp(`\\['${id}',`, 'g')) ?? [];
      expect(matches).toHaveLength(1);
    });
  }
});

describe('_shared/betaVideoUrlAccess.ts — no SL id is ever guest-allowed (Sleep Sounds requires sign-in, unlike IB01/IS01/IM01/IM02)', () => {
  const accessSource = read('../../supabase/functions/_shared/betaVideoUrlAccess.ts');

  it('GUEST_ALLOWED_IDS contains none of SL01-SL10', () => {
    const match = accessSource.match(/GUEST_ALLOWED_IDS[\s\S]*?=\s*new Set\(\[([^\]]*)\]\);/);
    expect(match).not.toBeNull();
    const allowedIds = match[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
    for (const id of Object.keys(SL_ENTRIES)) {
      expect(allowedIds).not.toContain(id);
    }
  });
});

describe('mediaCatalog.js — SL01-SL10 are Sleep Soundscapes, browsable in Library (never INTERACTIVE_ONLY_IDS)', () => {
  const mediaCatalogSource = read('./mediaCatalog.js');

  it('INTERACTIVE_ONLY_IDS never contains any SL id', () => {
    const match = mediaCatalogSource.match(/INTERACTIVE_ONLY_IDS = new Set\(\[([^\]]*)\]\);/);
    expect(match).not.toBeNull();
    const interactiveOnlyIds = match[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
    for (const id of Object.keys(SL_ENTRIES)) {
      expect(interactiveOnlyIds).not.toContain(id);
    }
  });

  it('every SL01-SL10 id has a Sleep Soundscapes METADATA entry on /prepare-for-rest', () => {
    for (const id of Object.keys(SL_ENTRIES)) {
      expect(mediaCatalogSource).toMatch(
        new RegExp(`${id}: \\{ category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' \\}`)
      );
    }
  });
});
