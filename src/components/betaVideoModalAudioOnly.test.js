// Regression guard for the 2026-10-05 meditation content refresh's
// audio-only player support (mediaType: 'audio', today only M06
// "Mindful Listening"): a still cover image + native <audio controls>
// instead of <video>, no fullscreen, sharing every other behaviour
// (loading/error/retry, completion overlay, caching) with the existing
// <video> path.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BETA_VIDEO_MANIFEST, getBetaVideoById } from '../lib/betaVideoManifest';
import { MEDIA_CATALOG, getCatalogEntryById } from '../lib/mediaCatalog';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const modalSource = read('./BetaVideoModal.jsx');

describe('betaVideoManifest.js — M06 "Mindful Listening" entry', () => {
  it('is a real audio entry with the exact verified Storage path, mediaType, coverId and measured durationLabel', () => {
    const m06 = getBetaVideoById('M06');
    expect(m06).toBeTruthy();
    expect(m06.title).toBe('Mindful Listening');
    expect(m06.storagePath).toBe('faststart-v1/WW_M06_Mindful_Listening_v01.MP3');
    expect(m06.mediaType).toBe('audio');
    expect(m06.coverId).toBe('M06COVER');
    expect(m06.durationLabel).toBe('2 min');
    // Narration-only, no background music mixed in (unlike M01-M05) -
    // never gets a musicVariantId.
    expect(m06.musicVariantId).toBeUndefined();
  });

  it('M06COVER is a real cover-image entry, resolvable by id but never Library-browsable', () => {
    const cover = getBetaVideoById('M06COVER');
    expect(cover).toBeTruthy();
    expect(cover.storagePath).toBe('faststart-v1/WW_M06_Mindful_Listening_Cover_v1.png');
    expect(MEDIA_CATALOG.find((e) => e.id === 'M06COVER')).toBeUndefined();
    expect(getCatalogEntryById('M06COVER')).toBeUndefined();
  });

  it('M06 itself IS Library-browsable, under Evening Wind-Down alongside M01-M05', () => {
    const catalogEntry = getCatalogEntryById('M06');
    expect(catalogEntry).toBeTruthy();
    expect(catalogEntry.category).toBe('Evening Wind-Down');
    expect(catalogEntry.active).toBe(true);
  });

  it('every id in BETA_VIDEO_MANIFEST is unique, M06/M06COVER included', () => {
    const ids = BETA_VIDEO_MANIFEST.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('BetaVideoModal.jsx — isAudioOnly derivation and fullscreen exclusion', () => {
  it('isAudioOnly is derived from entry.mediaType, defined before any handler that reads it', () => {
    expect(modalSource).toMatch(/const isAudioOnly = entry\.mediaType === 'audio';/);
  });

  it('both fullscreen entry points (handleBegin, handleResumeOrReplay) exclude isAudioOnly, alongside the pre-existing isSleepSound exclusion', () => {
    const beginBody = modalSource.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const resumeBody = modalSource.match(/const handleResumeOrReplay = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/if \(!isSleepSound && !isAudioOnly\) requestVideoFullscreen\(video\);/);
    expect(resumeBody).toMatch(/if \(!isSleepSound && !isAudioOnly\) requestVideoFullscreen\(video\);/);
  });

  it('the generic Paused/Done overlay excludes isAudioOnly too - otherwise it would wrongly cover the native audio controls the instant playback starts (isFullscreen can never become true for audio-only, so the pre-existing !isFullscreen guard alone cannot exclude it)', () => {
    expect(modalSource).toMatch(
      /\{hasStarted && !isFullscreen && !fallbackFullscreen && !isSleepSound && !isAudioOnly && !\(hasEnded && completionContext\) && \(/
    );
  });
});

describe('BetaVideoModal.jsx — cover image signed URL', () => {
  it('coverUrl state exists, reset to null on every fresh fetch', () => {
    expect(modalSource).toMatch(/const \[coverUrl, setCoverUrl\] = useState\(null\);/);
    expect(modalSource).toMatch(/setCoverUrl\(null\);\s*\n\s*hasEndedProcessedRef\.current = false;/);
  });

  it('the fetch effect requests entry.coverId as a second, parallel signed URL only when present, and depends on entry.coverId', () => {
    const fetchBlock = modalSource.match(/const \[\{ url, expiresAt \}, coverResult\] = await Promise\.all\(\[[\s\S]*?\]\);/)?.[0] ?? '';
    expect(fetchBlock).toMatch(/requestBetaVideoUrl\(playbackId\),/);
    expect(fetchBlock).toMatch(/entry\.coverId \? requestBetaVideoUrl\(entry\.coverId\) : Promise\.resolve\(null\)/);
    expect(modalSource).toMatch(/\}, \[playbackId, retryToken, entry\.coverId\]\);/);
  });

  it('coverUrl is only ever set from a real cover fetch result, never guessed from videoUrl', () => {
    expect(modalSource).toMatch(/if \(coverResult\) setCoverUrl\(coverResult\.url\);/);
  });
});

describe('BetaVideoModal.jsx — audio-only render branch', () => {
  it('renders a still <img> cover (object-cover, fills the same frame as <video>) and a native <audio controls> bound to videoRef, never both <video> and <audio> for the same entry', () => {
    expect(modalSource).toMatch(/isAudioOnly \? \(/);
    expect(modalSource).toMatch(/<img\s*\n\s*src=\{coverUrl\}/);
    expect(modalSource).toMatch(/<audio\s*\n\s*ref=\{videoRef\}/);
  });

  it('the <audio> element shares handleMediaPlay/handleMediaPause/handleMediaLoadedMetadata/handleVideoError with the <video> branch - no duplicated, divergent logic', () => {
    const audioTag = modalSource.match(/<audio\s*\n\s*ref=\{videoRef\}[\s\S]*?\n\s*>/)?.[0] ?? '';
    expect(audioTag).not.toBe('');
    expect(audioTag).toMatch(/onError=\{handleVideoError\}/);
    expect(audioTag).toMatch(/onPlay=\{handleMediaPlay\}/);
    expect(audioTag).toMatch(/onPause=\{handleMediaPause\}/);
    expect(audioTag).toMatch(/onLoadedMetadata=\{handleMediaLoadedMetadata\}/);
    expect(audioTag).toMatch(/controls=\{!hasEnded\}/);
  });

  it('the <audio> element never sets playsInline or loop (video-only concepts) and is never the fallback-fullscreen element', () => {
    const audioTag = modalSource.match(/<audio\s*\n\s*ref=\{videoRef\}[\s\S]*?\n\s*>/)?.[0] ?? '';
    expect(audioTag).not.toMatch(/playsInline/);
    expect(audioTag).not.toMatch(/loop=/);
    expect(audioTag).not.toMatch(/fallbackFullscreen/);
  });

  it('handleMediaPlay/handleMediaPause/handleMediaLoadedMetadata are defined exactly once each, shared (not duplicated) by both branches', () => {
    expect((modalSource.match(/const handleMediaPlay = \(\) => \{/g) ?? []).length).toBe(1);
    expect((modalSource.match(/const handleMediaPause = \(\) => setIsVideoPlaying\(false\);/g) ?? []).length).toBe(1);
    expect((modalSource.match(/const handleMediaLoadedMetadata = \(e\) => \{/g) ?? []).length).toBe(1);
    expect((modalSource.match(/onPlay=\{handleMediaPlay\}/g) ?? []).length).toBe(2);
    expect((modalSource.match(/onPause=\{handleMediaPause\}/g) ?? []).length).toBe(2);
    expect((modalSource.match(/onLoadedMetadata=\{handleMediaLoadedMetadata\}/g) ?? []).length).toBe(2);
  });
});

describe('get-beta-video-url/index.ts — M06/M06COVER map to the same verified Storage paths as betaVideoManifest.js', () => {
  const edgeFunctionSource = read('../../supabase/functions/get-beta-video-url/index.ts');

  it("EXERCISE_PATHS carries M06's and M06COVER's exact paths", () => {
    expect(edgeFunctionSource).toMatch(/\['M06', 'faststart-v1\/WW_M06_Mindful_Listening_v01\.MP3'\],/);
    expect(edgeFunctionSource).toMatch(/\['M06COVER', 'faststart-v1\/WW_M06_Mindful_Listening_Cover_v1\.png'\],/);
  });

  it('M06/M06COVER are not in GUEST_ALLOWED_IDS - M06 is real narrated content, not an ambient loop, so it keeps the normal JWT requirement', () => {
    const sharedSource = read('../../supabase/functions/_shared/betaVideoUrlAccess.ts');
    const guestIds = sharedSource.match(/GUEST_ALLOWED_IDS: ReadonlySet<string> = new Set\(\[([^\]]+)\]\)/)?.[1] ?? '';
    expect(guestIds).not.toMatch(/'M06'/);
    expect(guestIds).not.toMatch(/'M06COVER'/);
  });
});
