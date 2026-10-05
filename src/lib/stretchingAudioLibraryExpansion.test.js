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

describe('AnytimeStretch.jsx — its own separate integration, still never BetaVideoModal or mediaType', () => {
  const source = read('../pages/AnytimeStretch.jsx');
  it('still uses requestBetaVideoUrl(exerciseId) directly and its own plain <audio> element - never BetaVideoModal, never reads mediaType', () => {
    expect(source).toMatch(/requestBetaVideoUrl\(/);
    expect(source).not.toMatch(/mediaType|BetaVideoModal/);
  });

  it('cover-image fix (generic icon -> real session cover): resolves session.coverId via the same requestBetaVideoUrl mechanism, its own coverUrl state - a parallel usage, not a dependency on BetaVideoModal\'s coverId', () => {
    expect(source).toMatch(/requestBetaVideoUrl\(s\.coverId\)/);
    expect(source).toMatch(/requestBetaVideoUrl\(coverId\)/);
    expect(source).toMatch(/const \[coverUrl, setCoverUrl\] = useState\(null\);/);
  });

  it('cover resolution never blocks or gates the audio play() call - handleSelect\'s synchronous play() path stays untouched', () => {
    const handleSelectBody = source.match(/const handleSelect = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleSelectBody).not.toBe('');
    expect(handleSelectBody).toMatch(/resolveCover\(target\.coverId\);/);
    // resolveCover is called, but play() itself still only ever depends
    // on `cached`/the fetch-on-tap fallback - same as before this fix.
    expect(handleSelectBody).toMatch(/audio\.play\(\)\.catch/);
  });

  it('guards against a fast session-switch race: a cover fetch that resolves after a different session is already selected never overwrites the wrong cover', () => {
    const resolveCoverBody = source.match(/const resolveCover = \(coverId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(resolveCoverBody).not.toBe('');
    expect(resolveCoverBody).toMatch(/currentCoverIdRef\.current = coverId;/);
    expect(resolveCoverBody).toMatch(/if \(currentCoverIdRef\.current === coverId\) setCoverUrl\(url\);/);
  });

  it('falls back to the original plain icon badge whenever coverUrl is not yet available - never a broken-image state', () => {
    expect(source).toMatch(/\{coverUrl \? \(/);
    expect(source).toMatch(/material-symbols-outlined text-4xl" aria-hidden="true">accessibility_new<\/span>/);
  });
});

describe('anytimeStretchCatalog.js — coverId wired to the exact same S06COVER-S09COVER entries Library uses', () => {
  it.each([
    ['chest-shoulder', 'S06COVER'],
    ['hands-wrists', 'S07COVER'],
    ['feet-ankles', 'S08COVER'],
    ['gentle-side', 'S09COVER']
  ])('%s has coverId %s', (id, expectedCoverId) => {
    const session = ANYTIME_STRETCH_SESSIONS.find((s) => s.id === id);
    expect(session.coverId).toBe(expectedCoverId);
    // The cover must actually resolve through betaVideoManifest.js too -
    // one shared mapping, not a second, divergent one.
    expect(getBetaVideoById(expectedCoverId)).toBeTruthy();
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
