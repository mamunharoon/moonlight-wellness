// Regression guard for the 2026-10-05 stretching content refresh's
// Library expansion, UPDATED for the 2026-11-05 "consistently audio-only"
// fix (ported from dev commit d759a2c onto this PROD-bound branch): S06-S09
// (the four Anytime Stretch audio sessions, "ST01-ST04" in product
// language) appear in Library via the mediaType:'audio' mechanism M06
// proved out, but now WITHOUT a cover image or native <audio controls> -
// see betaVideoModalMinimalAudioPlayer.test.js for that player-level
// coverage (M06 itself is completely unaffected and keeps its original
// cover+native-controls presentation - see betaVideoModalAudioOnly.test.js,
// still unmodified except for one count assertion). This file covers only
// what's new: the manifest/catalog wiring itself, and that
// AnytimeStretch.jsx's own separate, pre-existing integration (including
// its Phase 2C paywall gating and real seek control, both untouched) is
// completely unaffected beyond its own matching coverId removal.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getBetaVideoById } from './betaVideoManifest';
import { MEDIA_CATALOG, getCatalogEntryById } from './mediaCatalog';
import { ANYTIME_STRETCH_SESSIONS } from './anytimeStretchCatalog';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('betaVideoManifest.js — S06-S09: mediaType audio, minimalAudioPlayer, no coverId, re-measured durationLabel', () => {
  it.each([
    ['S06', 'faststart-v1/ST01_Chest_Shoulder_Stretch1.mp3.MP3', '2 min'],
    ['S07', 'faststart-v1/ST02_Hands_Wrists_Refresh.mp3.MP3', '2 min'],
    ['S08', 'faststart-v1/ST03_Feet_Ankles_Refresh.mp3.MP3', '2 min'],
    ['S09', 'faststart-v1/ST04_Gentle_Side_Stretch.mp3.MP3', '1 min']
  ])('%s: exact verified storagePath, mediaType audio, minimalAudioPlayer true, no coverId, re-measured durationLabel', (id, storagePath, durationLabel) => {
    const entry = getBetaVideoById(id);
    expect(entry).toBeTruthy();
    expect(entry.storagePath).toBe(storagePath);
    expect(entry.mediaType).toBe('audio');
    expect(entry.minimalAudioPlayer).toBe(true);
    expect(entry.coverId).toBeUndefined();
    expect(entry.durationLabel).toBe(durationLabel);
  });

  it.each([
    ['S06COVER', 'faststart-v1/ST01_Chest_Shoulder_Stretch.png'],
    ['S07COVER', 'faststart-v1/ST02_Hands_Wrists_Refresh.png'],
    ['S08COVER', 'faststart-v1/ST03_Feet_Ankles_Refresh.png'],
    ['S09COVER', 'faststart-v1/ST04_Gentle_Side_Stretch.png']
  ])('%s: the cover-image entry/PNG object still exists untouched (removed from USE, never deleted), still never Library-browsable', (coverId, storagePath) => {
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

describe('anytimeStretchCatalog.js — durations corrected to match the 2026-11-05 Adobe Express voice+music remix', () => {
  it.each([
    ['S06', 103],
    ['S07', 97],
    ['S08', 90],
    ['S09', 56]
  ])('%s duration updated', (exerciseId, expected) => {
    const session = ANYTIME_STRETCH_SESSIONS.find((s) => s.exerciseId === exerciseId);
    expect(session).toBeTruthy();
    expect(session.durationSeconds).toBe(expected);
  });

  it('no session carries a coverId any more - the circular cover photo is removed entirely (2026-11-05 "consistently audio-only" fix)', () => {
    for (const session of ANYTIME_STRETCH_SESSIONS) {
      expect(session.coverId).toBeUndefined();
    }
  });
});

describe('AnytimeStretch.jsx — its own separate integration, still never BetaVideoModal or mediaType, now with no cover-image usage at all - Phase 2C paywall gating and the real seek control both completely unaffected', () => {
  const source = read('../pages/AnytimeStretch.jsx');
  it('still uses requestBetaVideoUrl(exerciseId) directly and its own plain <audio> element - never BetaVideoModal, never reads mediaType', () => {
    expect(source).toMatch(/requestBetaVideoUrl\(/);
    expect(source).not.toMatch(/mediaType|BetaVideoModal/);
  });

  it('2026-11-05 fix: no coverId/coverUrl/resolveCover machinery remains in actual code (this file\'s own top-of-file doc comment explaining the removal is the only place those words still appear) - the circular exercise photograph is gone', () => {
    expect(source).not.toMatch(/const \[coverUrl, setCoverUrl\]/);
    expect(source).not.toMatch(/const resolveCover = /);
    expect(source).not.toMatch(/const preloadedCoverRef = /);
    expect(source).not.toMatch(/const currentCoverIdRef = /);
    expect(source).not.toMatch(/\.coverId/);
    expect(source).not.toMatch(/<img\b/);
  });

  it('shows an explicit "Audio" label alongside the session title', () => {
    expect(source).toMatch(/>\s*Audio\s*</);
  });

  it('Phase 2C paywall gating (isGuest, resolvePremiumGate, PlusPaywallDialog, paywallState/paywallTargetId) is completely unaffected - checked before any network call, exactly as before this fix', () => {
    expect(source).toMatch(/import \{ PlusPaywallDialog \} from '\.\.\/components\/PlusPaywallDialog';/);
    expect(source).toMatch(/import \{ useUnifiedEntitlement \} from '\.\.\/context\/SubscriptionContext';/);
    expect(source).toMatch(/import \{ PREMIUM_GATE, resolvePremiumGate \} from '\.\.\/lib\/premiumAccess';/);
    const handleSelectBody = source.match(/const handleSelect = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleSelectBody).not.toBe('');
    expect(handleSelectBody).toMatch(/if \(isGuest\) \{/);
    expect(handleSelectBody).toMatch(/const gate = resolvePremiumGate\(getCatalogEntryById\(target\.exerciseId\), entitlement\);/);
    expect(handleSelectBody).toMatch(/audio\.play\(\)\.catch/);
  });

  it('the real seek control (trackRef/seekFromClientX/pointer+keyboard handlers) and useWakeLock are completely unaffected', () => {
    expect(source).toMatch(/const trackRef = useRef\(null\);/);
    expect(source).toMatch(/const seekFromClientX = /);
    expect(source).toMatch(/useWakeLock\(isPlaying\);/);
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
