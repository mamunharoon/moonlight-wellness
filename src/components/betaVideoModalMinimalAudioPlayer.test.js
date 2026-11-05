// Regression guard for the 2026-11-05 "consistently audio-only" fix
// (ported from dev commit d759a2c onto this PROD-bound branch):
// S06-S09 ("ST01-ST04" in product language) now render through a clean
// custom audio player inside BetaVideoModal.jsx - no cover image, no
// native <audio controls>, no "Begin Exercise" video-style overlay -
// instead of M06's original still-cover-image + native-controls
// presentation, which this fix deliberately leaves completely untouched
// (see betaVideoModalAudioOnly.test.js, unmodified except for one count
// assertion). This port carries no change to this branch's own Phase 2C
// entitlement gating, Android back-handler, wake-lock, or
// download-icon-suppression (controlsList="nodownload") additions - none
// of which exist on dev, and none of which are touched here.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getBetaVideoById } from '../lib/betaVideoManifest';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const modalSource = read('./BetaVideoModal.jsx');

// The whole isAudioOnly ternary (both the M06 branch and the minimal-
// player branch), up to the sibling <video> branch that follows it -
// scoping assertions to this block rather than the whole file keeps them
// honest about which branch they're really checking.
const audioOnlyBlock = modalSource.match(/\{isAudioOnly \? \([\s\S]*?\) : \(\s*\n\s*<video\n/)?.[0] ?? '';

describe('BetaVideoModal.jsx — useMinimalAudioPlayer derivation', () => {
  it('is derived from isAudioOnly AND entry.minimalAudioPlayer, defined before any handler/render that reads it', () => {
    expect(modalSource).toMatch(/const useMinimalAudioPlayer = isAudioOnly && entry\.minimalAudioPlayer === true;/);
  });

  it.each(['S06', 'S07', 'S08', 'S09'])('%s opts into useMinimalAudioPlayer (mediaType audio + minimalAudioPlayer true)', (id) => {
    const entry = getBetaVideoById(id);
    expect(entry.mediaType).toBe('audio');
    expect(entry.minimalAudioPlayer).toBe(true);
  });

  it('M06 does NOT opt in - its own original cover+native-controls branch stays exactly as before', () => {
    const m06 = getBetaVideoById('M06');
    expect(m06.mediaType).toBe('audio');
    expect(m06.minimalAudioPlayer).toBeUndefined();
  });
});

describe('BetaVideoModal.jsx — isAudioOnly ternary structure', () => {
  it('branches on !useMinimalAudioPlayer first (M06\'s original branch), useMinimalAudioPlayer second - found and non-empty', () => {
    expect(audioOnlyBlock).not.toBe('');
    expect(audioOnlyBlock).toMatch(/isAudioOnly \? \(\s*\n\s*!useMinimalAudioPlayer \? \(/);
  });

  it('contains exactly one native-controls <audio> (M06\'s) and exactly one hidden custom-controls <audio> (the minimal player\'s)', () => {
    expect((audioOnlyBlock.match(/controls=\{!hasEnded\}/g) ?? []).length).toBe(1);
    expect((audioOnlyBlock.match(/className="hidden"/g) ?? []).length).toBe(1);
  });

  it('contains exactly one <img> cover (M06\'s only - the minimal player renders no cover at all)', () => {
    expect((audioOnlyBlock.match(/<img/g) ?? []).length).toBe(1);
  });

  it('M06\'s branch keeps its own controlsList="nodownload" download-icon suppression (a PROD-only tester fix, unrelated to this port) untouched', () => {
    expect(audioOnlyBlock).toMatch(/controlsList="nodownload"/);
  });
});

describe('BetaVideoModal.jsx — minimal audio player render branch', () => {
  it('wires onTimeUpdate to audioCurrentTime and onLoadedMetadata to also set audioDuration, alongside the shared handleMediaLoadedMetadata/handleMediaPlay/handleMediaPause/handleVideoError', () => {
    expect(audioOnlyBlock).toMatch(/onTimeUpdate=\{\(e\) => setAudioCurrentTime\(e\.currentTarget\.currentTime\)\}/);
    expect(audioOnlyBlock).toMatch(/setAudioDuration\(e\.currentTarget\.duration\);/);
    expect(audioOnlyBlock).toMatch(/handleMediaLoadedMetadata\(e\);/);
  });

  it('shows an explicit "Audio" label', () => {
    expect(audioOnlyBlock).toMatch(/>\s*Audio\s*</);
  });

  it('has its own custom play/pause button calling handleToggleMinimalAudio, reflecting isVideoPlaying (the real native play/pause events, never a separate guessed state)', () => {
    expect(audioOnlyBlock).toMatch(/onClick=\{handleToggleMinimalAudio\}/);
    expect(audioOnlyBlock).toMatch(/\{isVideoPlaying \? 'pause' : 'play_arrow'\}/);
  });

  it('shows a progress bar and elapsed/total time via the shared formatElapsedTime helper', () => {
    expect(audioOnlyBlock).toMatch(/formatElapsedTime\(audioCurrentTime\)/);
    expect(audioOnlyBlock).toMatch(/formatElapsedTime\(audioDuration\)/);
  });
});

describe('BetaVideoModal.jsx — handleToggleMinimalAudio', () => {
  it('toggles play/pause on the current audio element - the one place playback starts for these entries (satisfies "deliberate user action")', () => {
    const body = modalSource.match(/const handleToggleMinimalAudio = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(audio\.paused\) \{/);
    expect(body).toMatch(/audio\.play\(\)\.catch/);
    expect(body).toMatch(/\} else \{\s*\n\s*audio\.pause\(\);/);
  });
});

describe('BetaVideoModal.jsx — "Begin Exercise" overlay excludes useMinimalAudioPlayer', () => {
  it('the generic video-style Begin Exercise overlay never renders for these entries - the custom player\'s own play button replaces it', () => {
    expect(modalSource).toMatch(/\{!hasStarted && !timerEnded && !useMinimalAudioPlayer && \(/);
  });
});

describe('BetaVideoModal.jsx — reset block clears the new audio progress state on every fresh fetch', () => {
  it('setAudioCurrentTime(0)/setAudioDuration(0) are reset alongside the other per-entry state', () => {
    const resetBlock = modalSource.match(/setFallbackFullscreen\(false\);[\s\S]*?hasEndedProcessedRef\.current = false;/)?.[0] ?? '';
    expect(resetBlock).toMatch(/setAudioCurrentTime\(0\);/);
    expect(resetBlock).toMatch(/setAudioDuration\(0\);/);
  });
});
