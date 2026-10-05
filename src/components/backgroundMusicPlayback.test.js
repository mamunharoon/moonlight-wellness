// Regression guard for Background Music, Phase B's wiring into
// BetaVideoModal.jsx. No DOM/component rendering is available in this
// repo's Vitest (see Home.routineState.test.js's own note) - these are
// source-level checks, matching every other regression guard in this
// codebase for exactly that reason. Pure selection/fallback logic itself
// is unit-tested directly in backgroundMusicSelection.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const modalSource = read('./BetaVideoModal.jsx');
const useProtectedVideoSource = read('../hooks/useProtectedVideo.js');

describe('Resolve before playback, never swap during playback', () => {
  it('playbackId is computed from resolvePlaybackId before the fetch effect runs, not from entry.id directly', () => {
    expect(modalSource).toMatch(/const playbackId = resolvePlaybackId\(\{ entry, musicEnabled, featureEnabled: musicFeatureOn, getEntryById: getBetaVideoById \}\);/);
  });

  it('the signed-URL fetch effect requests playbackId, and depends on it (so a pre-playback toggle re-fetches, a mid-playback one cannot)', () => {
    // 2026-10-05 meditation refresh: the primary fetch is now one leg of
    // a Promise.all (alongside an optional cover-image fetch for
    // mediaType:'audio' entries like M06 - see betaVideoManifest.test.js
    // sibling coverage) - still requestBetaVideoUrl(playbackId), just no
    // longer directly preceded by its own `await`.
    expect(modalSource).toMatch(/requestBetaVideoUrl\(playbackId\),/);
    expect(modalSource).toMatch(/\}, \[playbackId, retryToken, entry\.coverId\]\);/);
  });

  it('musicEnabled is seeded once from getMusicPreference as this instance\'s own initial state, not re-read from storage every render', () => {
    expect(modalSource).toMatch(/useState\(getMusicPreference\)/);
  });

  it('the Music toggle is only ever shown before playback starts (!hasStarted), and its handler is a no-op once playback has begun', () => {
    expect(modalSource).toMatch(/\{showMusicToggle && status === 'ready' && !hasStarted && \(/);
    expect(modalSource).toMatch(/const handleToggleMusic = \(\) => \{\s*\n\s*if \(hasStarted\) return;/);
  });

  it('toggling persists the choice immediately via setMusicPreference, same as every other WakeWise preference toggle', () => {
    expect(modalSource).toMatch(/setMusicPreference\(next\);/);
  });
});

describe('Never add music over Sleep Soundscapes / music-only content', () => {
  it('the toggle visibility and the actual id resolution both route through the shared eligibility guard (backgroundMusicSelection.js), never a local re-implementation', () => {
    expect(modalSource).toMatch(/import \{ resolvePlaybackId, shouldShowMusicToggle \} from '\.\.\/lib\/backgroundMusicSelection';/);
    expect(modalSource).toMatch(/shouldShowMusicToggle\(\{ entry, featureEnabled: musicFeatureOn \}\)/);
  });
});

describe('Missing music variants fall back safely to narration-only', () => {
  it('playbackId resolution is the ONLY thing requestBetaVideoUrl is ever called with for the PRIMARY media fetch - no separate direct entry.id call path exists that could bypass the fallback', () => {
    // 2026-10-05 meditation refresh: a second call now exists -
    // requestBetaVideoUrl(entry.coverId), for mediaType:'audio' entries'
    // still cover image (M06). That's a deliberately separate, narrower
    // lookup (a static image id, never subject to music-variant
    // resolution) - the guarantee this test actually protects is that
    // the PRIMARY media fetch is never called with a raw entry.id that
    // could bypass resolvePlaybackId's fallback logic, which still holds.
    const requestCalls = modalSource.match(/requestBetaVideoUrl\([^)]*\)/g) ?? [];
    expect(requestCalls).toEqual(['requestBetaVideoUrl(playbackId)', 'requestBetaVideoUrl(entry.coverId)']);
  });
});

describe('Playback cleanup — stop on close/back/route-change/unmount (already structural, unchanged by this phase)', () => {
  it('the existing single-<video>-element unmount cleanup (pause + remove src + load) is untouched', () => {
    expect(modalSource).toMatch(/video\.pause\(\);\s*\n\s*video\.removeAttribute\('src'\);\s*\n\s*video\.load\(\);/);
  });

  it('handleClose still pauses the video before calling onClose (route-change/back/close all funnel through unmount or this handler)', () => {
    expect(modalSource).toMatch(/const handleClose = \(\) => \{\s*\n\s*videoRef\.current\?\.pause\(\);/);
  });

  it('exactly one video and one audio element author site, both bound to videoRef as the ONE mutually-exclusive playback element (isAudioOnly ternary) - no second, dual-track media element was introduced for music', () => {
    // Matches only the actual JSX tag openings (ref={videoRef} immediately
    // follows each one in this file), not the many prose mentions of
    // "<video>"/"<audio>" in this file's own doc comments. 2026-10-05
    // meditation refresh: a genuine <audio ref={videoRef}> now exists
    // for mediaType:'audio' entries (M06) - an intentional, unrelated
    // addition (a still-cover-image audio player). It and the original
    // <video> are the two arms of one ternary (isAudioOnly ? <audio> :
    // <video>), never both mounted at once - this test can't verify
    // runtime exclusivity via source text, but confirms exactly this
    // pair exists and nothing more, which is what would catch a THIRD,
    // genuinely-simultaneous media element for background music.
    const videoTags = modalSource.match(/<video\s*\n\s*ref=\{videoRef\}/g) ?? [];
    const audioTags = modalSource.match(/<audio\s*\n\s*ref=\{videoRef\}/g) ?? [];
    expect(videoTags.length).toBe(1);
    expect(audioTags.length).toBe(1);
    expect(modalSource).toMatch(/isAudioOnly \? \(/);
  });
});

describe('Guest authentication gating is identical for both variants (entirely upstream of this component)', () => {
  it('BetaVideoModal\'s only isGuest/auth logic is a defensive sign-out guard (pause immediately if a session expires mid-playback) - the actual entry gate already happened in useProtectedVideo before this component ever mounts', () => {
    const guardBody = modalSource.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isGuest\) return;[\s\S]*?\n {2}\}, \[isGuest\]\);/)?.[0] ?? '';
    expect(guardBody).not.toBe('');
    // Defect 2 fix (immersive fullscreen) also exits fullscreen here, on
    // the same guard, before pausing - still just the one guest-gating
    // effect, still unconditionally pauses.
    expect(guardBody).toMatch(/video\.pause\(\);/);
    // that one defensive effect is the ONLY isGuest/useAuth reference -
    // no gating logic of its own beyond it.
    const isGuestOccurrences = modalSource.match(/isGuest/g) ?? [];
    expect(isGuestOccurrences.length).toBe(3); // the destructure + the guard's own check (twice: condition and dependency array)
  });

  it('useProtectedVideo\'s guest check happens on selection (handleSelect), before BetaVideoModal is ever rendered - so which variant would have been requested is irrelevant to whether a guest can open it at all', () => {
    expect(useProtectedVideoSource).toMatch(/const handleSelect = \(id\) => \{\s*\n\s*if \(isGuest && !guestAllowedIds\.has\(id\)\) \{/);
  });
});
