// Regression guard for the Fast Start catalogue conversion (moov-before-
// mdat remux of every video/audio object referenced by EXERCISE_PATHS /
// BETA_VIDEO_MANIFEST). get-beta-video-url/index.ts is a Deno file and
// can't be imported here - read as source text and parsed, same
// convention as interactiveMusicAssets.test.js's edgeFunctionSource.
//
// This file is deliberately data-driven from a fixed list of the five
// IDs whose source object was replaced after the first catalogue-wide
// remux pass (and therefore needed a second remux into faststart-v2/)
// rather than importing anything from the one-off scratch scripts used
// to produce the conversion - those never shipped in the repo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BETA_VIDEO_MANIFEST } from './betaVideoManifest';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const edgeFnSource = read('../../supabase/functions/get-beta-video-url/index.ts');

const FASTSTART_V2_IDS = ['E04', 'E05', 'E06', 'E11', 'E13'];

const edgeFnPaths = Object.fromEntries(
  [...edgeFnSource.matchAll(/\['([A-Z0-9]+)',\s*'([^']+)'\]/g)].map((m) => [m[1], m[2]])
);
const manifestPaths = Object.fromEntries(BETA_VIDEO_MANIFEST.map((e) => [e.id, e.storagePath]));

describe('Fast Start conversion — get-beta-video-url and betaVideoManifest agree', () => {
  it('both carry exactly the same set of IDs', () => {
    const edgeIds = Object.keys(edgeFnPaths).sort();
    const manifestIds = Object.keys(manifestPaths).sort();
    expect(edgeIds).toEqual(manifestIds);
  });

  it('every ID maps to the exact same path in both places', () => {
    for (const id of Object.keys(edgeFnPaths)) {
      expect(manifestPaths[id], `path mismatch for ${id}`).toBe(edgeFnPaths[id]);
    }
  });

  it('no duplicate IDs, no duplicate paths, in either source', () => {
    const edgeIdList = [...edgeFnSource.matchAll(/\['([A-Z0-9]+)',/g)].map((m) => m[1]);
    expect(new Set(edgeIdList).size).toBe(edgeIdList.length);
    const edgePathList = Object.values(edgeFnPaths);
    expect(new Set(edgePathList).size).toBe(edgePathList.length);

    const manifestIdList = BETA_VIDEO_MANIFEST.map((e) => e.id);
    expect(new Set(manifestIdList).size).toBe(manifestIdList.length);
    const manifestPathList = BETA_VIDEO_MANIFEST.map((e) => e.storagePath);
    expect(new Set(manifestPathList).size).toBe(manifestPathList.length);
  });
});

describe('Fast Start conversion — every live ID maps to a Fast Start object, never an original', () => {
  it('every path lives under faststart-v1/ or faststart-v2/, never exercises/ (the pre-conversion original)', () => {
    for (const [id, path] of Object.entries(edgeFnPaths)) {
      expect(path.startsWith('faststart-v1/') || path.startsWith('faststart-v2/'), `${id} -> ${path} is not a Fast Start path`).toBe(true);
    }
  });

  it('every path carries the _faststart marker before its extension (the remux naming convention)', () => {
    for (const [id, path] of Object.entries(edgeFnPaths)) {
      expect(path, `${id} -> ${path} missing _faststart marker`).toMatch(/_faststart\.(mp4|m4a)$/);
    }
  });
});

describe('Fast Start conversion — v1/v2 split matches which IDs had their source replaced', () => {
  it('the five IDs whose source object was replaced after the first remux pass use faststart-v2/', () => {
    for (const id of FASTSTART_V2_IDS) {
      expect(edgeFnPaths[id], `${id} should be faststart-v2/`).toMatch(/^faststart-v2\//);
    }
  });

  it('every other live ID uses faststart-v1/', () => {
    for (const [id, path] of Object.entries(edgeFnPaths)) {
      if (FASTSTART_V2_IDS.includes(id)) continue;
      expect(path, `${id} should be faststart-v1/`).toMatch(/^faststart-v1\//);
    }
  });

  it('E09 (the previously mismapped/dangling ID) resolves under faststart-v1/, built from its corrected canonical source', () => {
    expect(edgeFnPaths.E09).toBe('faststart-v1/WW_E09_MindfulPause_Music_v1.mp3_faststart.mp4');
  });
});

describe('Fast Start conversion — no live mapping references pilot, orphaned, or superseded objects', () => {
  it('no path references the temporary pilot-faststart/ prefix', () => {
    for (const [id, path] of Object.entries(edgeFnPaths)) {
      expect(path.startsWith('pilot-faststart/'), `${id} -> ${path} references the temporary pilot prefix`).toBe(false);
    }
  });

  it('no path references the known superseded/orphaned objects (old _v1 interactive loops, the removed S01-MUSIC bed)', () => {
    const orphanedNames = [
      'WW_IB01_InteractiveBreathingLoop_MusicBed_v1.m4a',
      'WW_IS01_InteractiveStretchingLoop_MusicBed_v1.m4a',
      'WW_S01_NeckRelease_MusicBed_v2.mp4'
    ];
    for (const [id, path] of Object.entries(edgeFnPaths)) {
      for (const orphan of orphanedNames) {
        expect(path.includes(orphan), `${id} -> ${path} references an orphaned object`).toBe(false);
      }
    }
  });
});
