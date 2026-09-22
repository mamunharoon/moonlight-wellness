// Introduction guide videos (I01/I02) - manifest wiring and Library/
// catalog exclusion. Verified end-to-end at the data level: exact
// storage paths (confirmed live against storage.objects before this
// change), presence in the raw manifest, and absence from the general
// MEDIA_CATALOG Library browses - the same "reachable via
// getBetaVideoById() only" guarantee IB01/IS01 already established.
import { describe, it, expect } from 'vitest';
import { BETA_VIDEO_MANIFEST, getBetaVideoById } from './betaVideoManifest';
import { MEDIA_CATALOG, getCatalogEntryById } from './mediaCatalog';

describe('betaVideoManifest.js — I01/I02 (Introduction guide videos)', () => {
  it('I01 maps to the exact verified Fast Start Welcome video path', () => {
    const entry = BETA_VIDEO_MANIFEST.find((e) => e.id === 'I01');
    expect(entry).toBeTruthy();
    expect(entry.storagePath).toBe('faststart-v1/WW_I01_WelcomeToWakeWise_v1_faststart.mp4');
    expect(entry.title).toBe('Why WakeWise');
  });

  it('I02 maps to the exact verified Fast Start How-to video path', () => {
    const entry = BETA_VIDEO_MANIFEST.find((e) => e.id === 'I02');
    expect(entry).toBeTruthy();
    expect(entry.storagePath).toBe('faststart-v1/WW_I02_HowToUseWakeWise_v1_faststart.mp4');
    expect(entry.title).toBe('How to Use WakeWise');
  });

  it('both remain reachable via getBetaVideoById (the mechanism Introduction.jsx actually uses)', () => {
    expect(getBetaVideoById('I01')?.storagePath).toBe('faststart-v1/WW_I01_WelcomeToWakeWise_v1_faststart.mp4');
    expect(getBetaVideoById('I02')?.storagePath).toBe('faststart-v1/WW_I02_HowToUseWakeWise_v1_faststart.mp4');
  });
});

describe('mediaCatalog.js — I01/I02 excluded from the general Library/catalog', () => {
  it('MEDIA_CATALOG (what Library.jsx iterates) does not contain I01 or I02', () => {
    expect(MEDIA_CATALOG.find((e) => e.id === 'I01')).toBeUndefined();
    expect(MEDIA_CATALOG.find((e) => e.id === 'I02')).toBeUndefined();
  });

  it('getCatalogEntryById (Library\'s own resolver) cannot resolve I01/I02 - this is exactly why Introduction.jsx must pass getBetaVideoById to useProtectedVideo instead', () => {
    expect(getCatalogEntryById('I01')).toBeUndefined();
    expect(getCatalogEntryById('I02')).toBeUndefined();
  });
});
