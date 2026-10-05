// Regression guard for the 2026-10-05 stretching content refresh's
// Library expansion: S06-S09 (the four Anytime Stretch audio sessions,
// "ST01-ST04" in product language) now also appear in Library with a
// still cover image, via the same mediaType:'audio'/coverId mechanism
// M06 already proved out (see betaVideoModalAudioOnly.test.js for that
// player-level coverage - not re-tested here). This file covers only
// what's new: the manifest/catalog wiring itself, and that
// AnytimeStretch.jsx's own separate, pre-existing integration is
// completely unaffected by the extra fields.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getBetaVideoById } from './betaVideoManifest';
import { MEDIA_CATALOG, getCatalogEntryById } from './mediaCatalog';
import { ANYTIME_STRETCH_SESSIONS } from './anytimeStretchCatalog';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('betaVideoManifest.js — S06-S09 gained mediaType/coverId, S06 gained its new filename', () => {
  it.each([
    ['S06', 'faststart-v1/ST01_Chest_Shoulder_Stretch1.mp3.MP3', 'S06COVER'],
    ['S07', 'faststart-v1/ST02_Hands_Wrists_Refresh.mp3.MP3', 'S07COVER'],
    ['S08', 'faststart-v1/ST03_Feet_Ankles_Refresh.mp3.MP3', 'S08COVER'],
    ['S09', 'faststart-v1/ST04_Gentle_Side_Stretch.mp3.MP3', 'S09COVER']
  ])('%s: exact verified storagePath, mediaType audio, coverId, durationLabel', (id, storagePath, coverId) => {
    const entry = getBetaVideoById(id);
    expect(entry).toBeTruthy();
    expect(entry.storagePath).toBe(storagePath);
    expect(entry.mediaType).toBe('audio');
    expect(entry.coverId).toBe(coverId);
    expect(entry.durationLabel).toBe('1 min');
  });

  it.each([
    ['S06COVER', 'faststart-v1/ST01_Chest_Shoulder_Stretch.png'],
    ['S07COVER', 'faststart-v1/ST02_Hands_Wrists_Refresh.png'],
    ['S08COVER', 'faststart-v1/ST03_Feet_Ankles_Refresh.png'],
    ['S09COVER', 'faststart-v1/ST04_Gentle_Side_Stretch.png']
  ])('%s: real cover-image entry, resolvable by id but never Library-browsable', (coverId, storagePath) => {
    const cover = getBetaVideoById(coverId);
    expect(cover).toBeTruthy();
    expect(cover.storagePath).toBe(storagePath);
    expect(MEDIA_CATALOG.find((e) => e.id === coverId)).toBeUndefined();
    expect(getCatalogEntryById(coverId)).toBeUndefined();
  });
});

describe('mediaCatalog.js — S06-S09 are now Library-visible under Stretching (the 2026-10-05 policy reversal)', () => {
  it.each(['S06', 'S07', 'S08', 'S09'])('%s IS Library-browsable, category Stretching', (id) => {
    const entry = getCatalogEntryById(id);
    expect(entry).toBeTruthy();
    expect(entry.category).toBe('Stretching');
    expect(entry.active).toBe(true);
  });

  it('no duplicate S06-S09 rows - each appears exactly once in MEDIA_CATALOG', () => {
    for (const id of ['S06', 'S07', 'S08', 'S09']) {
      expect(MEDIA_CATALOG.filter((e) => e.id === id).length).toBe(1);
    }
  });
});

describe('anytimeStretchCatalog.js — durations corrected to match the re-recorded MP3s', () => {
  it.each([
    ['S06', 52],
    ['S07', 44],
    ['S08', 41],
    ['S09', 49]
  ])('%s duration updated', (exerciseId, expected) => {
    const session = ANYTIME_STRETCH_SESSIONS.find((s) => s.exerciseId === exerciseId);
    expect(session).toBeTruthy();
    expect(session.durationSeconds).toBe(expected);
  });
});

describe('AnytimeStretch.jsx — its own separate integration is unaffected by the new fields', () => {
  const source = read('../pages/AnytimeStretch.jsx');
  it('still uses requestBetaVideoUrl(exerciseId) directly and its own plain <audio> element - never BetaVideoModal, never reads mediaType/coverId', () => {
    expect(source).toMatch(/requestBetaVideoUrl\(/);
    expect(source).not.toMatch(/mediaType|coverId|BetaVideoModal/);
  });
});

describe('get-beta-video-url/index.ts — S06-S09/S06COVER-S09COVER map to the same verified Storage paths as betaVideoManifest.js', () => {
  const edgeFunctionSource = read('../../supabase/functions/get-beta-video-url/index.ts');

  it('EXERCISE_PATHS carries the exact renamed S06 path and all four cover paths', () => {
    expect(edgeFunctionSource).toMatch(/\['S06', 'faststart-v1\/ST01_Chest_Shoulder_Stretch1\.mp3\.MP3'\],/);
    expect(edgeFunctionSource).toMatch(/\['S06COVER', 'faststart-v1\/ST01_Chest_Shoulder_Stretch\.png'\],/);
    expect(edgeFunctionSource).toMatch(/\['S07COVER', 'faststart-v1\/ST02_Hands_Wrists_Refresh\.png'\],/);
    expect(edgeFunctionSource).toMatch(/\['S08COVER', 'faststart-v1\/ST03_Feet_Ankles_Refresh\.png'\],/);
    expect(edgeFunctionSource).toMatch(/\['S09COVER', 'faststart-v1\/ST04_Gentle_Side_Stretch\.png'\],/);
  });

  it('none of S06-S09/S06COVER-S09COVER are in GUEST_ALLOWED_IDS - real narrated/cover content, not ambient loops', () => {
    const sharedSource = read('../../supabase/functions/_shared/betaVideoUrlAccess.ts');
    const guestIds = sharedSource.match(/GUEST_ALLOWED_IDS: ReadonlySet<string> = new Set\(\[([^\]]+)\]\)/)?.[1] ?? '';
    for (const id of ['S06', 'S07', 'S08', 'S09', 'S06COVER', 'S07COVER', 'S08COVER', 'S09COVER']) {
      expect(guestIds).not.toMatch(new RegExp(`'${id}'`));
    }
  });
});
