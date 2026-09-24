// Regression guard for the S01-MUSIC removal / IB01+IS01 registration.
// Source-level checks for the Edge Function (a Deno file, not renderable
// in this repo's Node-environment Vitest — same convention as every other
// regression guard here), plus direct assertions against the real
// manifest/catalog data structures.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BETA_VIDEO_MANIFEST, getBetaVideoById } from './betaVideoManifest';
import { MEDIA_CATALOG, getCatalogEntryById } from './mediaCatalog';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const edgeFunctionSource = read('../../supabase/functions/get-beta-video-url/index.ts');
const guestAccessSource = read('../../supabase/functions/_shared/betaVideoUrlAccess.ts');

describe('S01-MUSIC is fully removed, S01 itself is untouched', () => {
  it('getBetaVideoById("S01-MUSIC") no longer resolves to anything', () => {
    expect(getBetaVideoById('S01-MUSIC')).toBeUndefined();
  });

  it('no manifest entry anywhere still carries id S01-MUSIC or a musicVariantId pointing at it', () => {
    expect(BETA_VIDEO_MANIFEST.find((e) => e.id === 'S01-MUSIC')).toBeUndefined();
    expect(BETA_VIDEO_MANIFEST.find((e) => e.musicVariantId === 'S01-MUSIC')).toBeUndefined();
  });

  it('the original narration-only S01 entry is exactly as it was before S01-MUSIC ever existed (now Fast Start)', () => {
    const s01 = getBetaVideoById('S01');
    expect(s01).toBeDefined();
    expect(s01.storagePath).toBe('faststart-v1/WW_S01_NeckRelease_v1.mp4_faststart.mp4');
    expect(s01.musicVariantId).toBeUndefined();
  });

  it('the Edge Function\'s EXERCISE_PATHS map no longer has an S01-MUSIC key', () => {
    expect(edgeFunctionSource).not.toMatch(/\['S01-MUSIC',/);
  });

  it('the Edge Function\'s S01 mapping is unchanged apart from the Fast Start conversion', () => {
    expect(edgeFunctionSource).toMatch(/\['S01', 'faststart-v1\/WW_S01_NeckRelease_v1\.mp4_faststart\.mp4'\],/);
  });
});

describe('IB01 / IS01 are registered end-to-end for the two real approved v2 assets', () => {
  it('IB01 resolves via getBetaVideoById to the approved breathing-loop v2 object\'s Fast Start path', () => {
    const ib01 = getBetaVideoById('IB01');
    expect(ib01).toBeDefined();
    expect(ib01.storagePath).toBe('faststart-v1/WW_IB01_InteractiveBreathingLoop_MusicBed_v2_faststart.m4a');
  });

  it('IS01 resolves via getBetaVideoById to the approved stretching-loop v2 object\'s Fast Start path', () => {
    const is01 = getBetaVideoById('IS01');
    expect(is01).toBeDefined();
    expect(is01.storagePath).toBe('faststart-v1/WW_IS01_InteractiveStretchingLoop_MusicBed_v2_faststart.m4a');
  });

  it('the Edge Function maps IB01 and IS01 to the exact same two v2 objects\' Fast Start paths', () => {
    expect(edgeFunctionSource).toMatch(/\['IB01', 'faststart-v1\/WW_IB01_InteractiveBreathingLoop_MusicBed_v2_faststart\.m4a'\],/);
    expect(edgeFunctionSource).toMatch(/\['IS01', 'faststart-v1\/WW_IS01_InteractiveStretchingLoop_MusicBed_v2_faststart\.m4a'\],/);
  });

  it('the obsolete IB01/IS01 v1 object paths specifically are no longer registered anywhere (scoped to those two ids\' own old filenames - IM01\'s own, unrelated "_v1.m4a" first-version asset, registered separately below, is not an obsolete predecessor of anything and must not trip this check)', () => {
    expect(edgeFunctionSource).not.toMatch(/WW_IB01_InteractiveBreathingLoop_MusicBed_v1\.m4a/);
    expect(edgeFunctionSource).not.toMatch(/WW_IS01_InteractiveStretchingLoop_MusicBed_v1\.m4a/);
    expect(getBetaVideoById('IB01').storagePath).not.toMatch(/_v1\.m4a/);
    expect(getBetaVideoById('IS01').storagePath).not.toMatch(/_v1\.m4a/);
  });

  it('verify_jwt enforcement (JWT check before any Storage access) is still present for every non-allowlisted id, in the shared decision module the Edge Function actually calls', () => {
    expect(guestAccessSource).toMatch(/if \(!jwt\) \{\s*\n\s*return \{ status: 401, body: \{ error: 'Sign in required' \} \};/);
  });

  it('IB01 and IS01 are explicitly, deliberately exempted from that requirement (guest-allowlisted), never by accident', () => {
    expect(guestAccessSource).toMatch(/GUEST_ALLOWED_IDS: ReadonlySet<string> = new Set\(\['IB01', 'IS01', 'IM01', 'IM02'\]\);/);
    expect(edgeFunctionSource).toMatch(/import \{ resolveBetaVideoUrlRequest \} from '\.\.\/_shared\/betaVideoUrlAccess\.ts';/);
  });
});

describe('IB01 / IS01 are excluded from the browsable Library catalogue', () => {
  it('neither id appears in MEDIA_CATALOG', () => {
    expect(MEDIA_CATALOG.find((e) => e.id === 'IB01')).toBeUndefined();
    expect(MEDIA_CATALOG.find((e) => e.id === 'IS01')).toBeUndefined();
    expect(getCatalogEntryById('IB01')).toBeUndefined();
    expect(getCatalogEntryById('IS01')).toBeUndefined();
  });

  it('yet both are still present in the raw manifest that getBetaVideoById reads (eligibility checks keep working)', () => {
    expect(BETA_VIDEO_MANIFEST.some((e) => e.id === 'IB01')).toBe(true);
    expect(BETA_VIDEO_MANIFEST.some((e) => e.id === 'IS01')).toBe(true);
  });

  it('no Sleep Soundscape id ever carries a musicVariantId pointing at IB01/IS01 (never mixed into Sleep Soundscapes)', () => {
    const sleepEntries = MEDIA_CATALOG.filter((e) => e.category === 'Sleep Soundscapes');
    expect(sleepEntries.length).toBeGreaterThan(0);
    for (const entry of sleepEntries) {
      expect(entry.musicVariantId).not.toBe('IB01');
      expect(entry.musicVariantId).not.toBe('IS01');
    }
  });
});
