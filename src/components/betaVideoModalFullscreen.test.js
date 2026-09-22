// Regression guard for immersive fullscreen playback (Defect 2). No DOM/
// component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase for exactly that reason.
//
// Strategy: HTMLVideoElement.webkitEnterFullscreen() (the supported
// iPhone/WKWebView path) is tried first; the standards-track
// element.requestFullscreen() second, for platforms that support it
// (desktop Chrome/Firefox/Safari); a full-viewport in-app CSS fallback on
// the SAME <video> element (never a duplicate one) if neither exists.
// Sleep Soundscapes are deliberately excluded - their timer/remaining-
// time/Stop controls live below the video frame in this modal's body and
// would be hidden behind a fullscreen presentation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./BetaVideoModal.jsx');

describe('BetaVideoModal.jsx — requestVideoFullscreen tries the supported iPhone path first', () => {
  it('checks webkitEnterFullscreen before the standards-track requestFullscreen, never assumes requestFullscreen() alone works', () => {
    const body = source.match(/const requestVideoFullscreen = \(video\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    const webkitIndex = body.indexOf('webkitEnterFullscreen');
    const standardIndex = body.indexOf('requestFullscreen()');
    expect(webkitIndex).toBeGreaterThanOrEqual(0);
    expect(standardIndex).toBeGreaterThan(webkitIndex);
  });

  it('falls back to the full-viewport in-app CSS state when neither native API is available, or the standard one rejects', () => {
    const body = source.match(/const requestVideoFullscreen = \(video\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/video\.requestFullscreen\(\)\.catch\(\(\) => setFallbackFullscreen\(true\)\);/);
    expect(body).toMatch(/setFallbackFullscreen\(true\);\s*\n\s*\};\s*$/);
  });
});

describe('BetaVideoModal.jsx — exitVideoFullscreen mirrors the same supported-path-first order', () => {
  it('uses webkitExitFullscreen guarded by webkitDisplayingFullscreen, then falls back to the standard exitFullscreen only if this exact video is the standards-track fullscreen element', () => {
    const body = source.match(/const exitVideoFullscreen = \(video\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/typeof video\.webkitExitFullscreen === 'function' && video\.webkitDisplayingFullscreen/);
    expect(body).toMatch(/document\.fullscreenElement === video && typeof document\.exitFullscreen === 'function'/);
  });
});

describe('BetaVideoModal.jsx — event wiring: iOS\'s own proprietary event pair, and the standard one, both handled', () => {
  it('listens for webkitbeginfullscreen/webkitendfullscreen directly on the <video> element (not document)', () => {
    expect(source).toMatch(/video\.addEventListener\('webkitbeginfullscreen', handleBeginFullscreen\);/);
    expect(source).toMatch(/video\.addEventListener\('webkitendfullscreen', handleEndFullscreen\);/);
  });

  it('also listens for the standards-track fullscreenchange on document, checked against this exact video element', () => {
    expect(source).toMatch(/document\.addEventListener\('fullscreenchange', handleStandardFullscreenChange\);/);
    expect(source).toMatch(/const active = document\.fullscreenElement === video;/);
  });

  it('every listener is symmetrically removed in the same effect\'s cleanup', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const video = videoRef\.current;\s*\n\s*if \(!video\) return;\s*\n\s*\n\s*const handleBeginFullscreen[\s\S]*?\n {2}\}, \[videoUrl\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/video\.removeEventListener\('webkitbeginfullscreen', handleBeginFullscreen\);/);
    expect(body).toMatch(/video\.removeEventListener\('webkitendfullscreen', handleEndFullscreen\);/);
    expect(body).toMatch(/document\.removeEventListener\('fullscreenchange', handleStandardFullscreenChange\);/);
    expect(body).toMatch(/video\.removeEventListener\('ended', handleEnded\);/);
  });

  it('exiting fullscreen (either path) never calls onClose - it only ever flips local state, so the preview modal underneath is never unmounted', () => {
    const body = source.match(/const handleEndFullscreen = \(\) => \{[\s\S]*?\};/)?.[0] ?? '';
    expect(body).not.toMatch(/onClose/);
    const changeBody = source.match(/const handleStandardFullscreenChange = \(\) => \{[\s\S]*?\};/)?.[0] ?? '';
    expect(changeBody).not.toMatch(/onClose/);
  });

  it('natural completion (ended) sets hasEnded, distinct from merely exiting fullscreen mid-playback', () => {
    const body = source.match(/const handleEnded = \(\) => \{[\s\S]*?\};/)?.[0] ?? '';
    expect(body).toMatch(/setHasEnded\(true\);/);
  });
});

describe('BetaVideoModal.jsx — Begin requests fullscreen synchronously, within the same user gesture', () => {
  it('handleBegin calls requestVideoFullscreen before .play(), not inside a .then() (never one microtask removed from the gesture that authorized it)', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    const fsIndex = body.indexOf('requestVideoFullscreen(video)');
    const playIndex = body.indexOf('video.play()');
    expect(fsIndex).toBeGreaterThanOrEqual(0);
    expect(playIndex).toBeGreaterThan(fsIndex);
  });

  it('never introduces autoplay - requestVideoFullscreen and play() are only ever called from a real button onClick (handleBegin/handleResumeOrReplay), never on mount or from an effect', () => {
    const fetchEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*let cancelled = false;[\s\S]*?\}, \[playbackId, retryToken\]\);/)?.[0] ?? '';
    expect(fetchEffect).not.toMatch(/\.play\(\)|requestVideoFullscreen/);
  });

  it('Sleep Soundscapes are excluded from fullscreen in both entry points', () => {
    const beginBody = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/if \(!isSleepSound\) requestVideoFullscreen\(video\);/);
    const resumeBody = source.match(/const handleResumeOrReplay = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(resumeBody).toMatch(/if \(!isSleepSound\) requestVideoFullscreen\(video\);/);
  });
});

describe('BetaVideoModal.jsx — Play Again restarts from zero; Resume continues where it was', () => {
  it('handleResumeOrReplay only rewinds currentTime and clears hasEnded when hasEnded is true', () => {
    const body = source.match(/const handleResumeOrReplay = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasEnded\) \{\s*\n\s*video\.currentTime = 0;\s*\n\s*setHasEnded\(false\);\s*\n\s*\}/);
  });
});

describe('BetaVideoModal.jsx — Pause is never equated with Stop/Exit', () => {
  it('onPause only ever updates isVideoPlaying - it never touches isFullscreen, fallbackFullscreen, hasEnded, or onClose', () => {
    expect(source).toMatch(/onPause=\{\(\) => setIsVideoPlaying\(false\)\}/);
  });
});

describe('BetaVideoModal.jsx — only one <video> element ever exists, even for the in-app fallback', () => {
  it('exactly one <video> tag in the whole component (the real JSX element, not the many comment mentions of <video>)', () => {
    const occurrences = source.match(/<video\s*\n\s*ref=\{videoRef\}/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('the fallback repositions that SAME element full-viewport via a conditional className, rather than rendering a second player', () => {
    expect(source).toMatch(/className=\{\s*\n\s*fallbackFullscreen\s*\n\s*\? 'fixed inset-0 z-\[200\] w-screen h-screen object-contain bg-black'\s*\n\s*: 'w-full h-full object-contain bg-black'\s*\n\s*\}/);
  });

  it('preserves object-contain (never crops portrait content) in both the small-modal and fallback-fullscreen states', () => {
    const body = source.match(/className=\{\s*\n\s*fallbackFullscreen[\s\S]*?\}\s*\n\s*>/)?.[0] ?? '';
    expect(body).toMatch(/object-contain/g);
    expect((body.match(/object-contain/g) ?? []).length).toBe(2);
  });

  it('retains native playback controls (the controls attribute) regardless of fullscreen state', () => {
    expect(source).toMatch(/<video\s*\n\s*ref=\{videoRef\}\s*\n\s*key=\{videoUrl\}\s*\n\s*src=\{videoUrl\}\s*\n\s*controls\s*\n/);
  });

  it('the fallback exit control only exits fallback fullscreen, never closes the video', () => {
    const body = source.match(/\{fallbackFullscreen && \(\s*\n\s*<button[\s\S]*?<\/button>\s*\n\s*\)\}/)?.[0] ?? '';
    expect(body).toMatch(/onClick=\{\(\) => setFallbackFullscreen\(false\)\}/);
    expect(body).not.toMatch(/onClose/);
    expect(body).toMatch(/aria-label="Exit fullscreen"/);
  });
});

describe('BetaVideoModal.jsx — the returned-to-preview overlay', () => {
  it('renders only once playback has started AND neither fullscreen mode is active, and only for non-Sleep-Soundscape entries', () => {
    expect(source).toMatch(
      /\{hasStarted && !isFullscreen && !fallbackFullscreen && !isSleepSound && \(/
    );
  });

  it('offers Play Again + Close Video on natural completion, Resume + Close Video otherwise', () => {
    const body = source.match(/\{hasStarted && !isFullscreen && !fallbackFullscreen && !isSleepSound && \([\s\S]*?\n {14}\)\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/\{hasEnded \? 'Play Again' : 'Resume'\}/);
    expect(body).toMatch(/Close Video/);
    expect(body).toMatch(/onClick=\{handleResumeOrReplay\}/);
    expect(body).toMatch(/onClick=\{handleClose\}/);
  });
});

describe('BetaVideoModal.jsx — cleanup releases fullscreen on every exit path', () => {
  it('the unmount/videoUrl-change cleanup effect exits fullscreen before pausing and releasing the source', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const video = videoRef\.current;\s*\n\s*return \(\) => \{[\s\S]*?\n {4}\};\s*\n\s*\}, \[videoUrl\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    const exitIndex = body.indexOf('exitVideoFullscreen(video)');
    const pauseIndex = body.indexOf('video.pause()');
    expect(exitIndex).toBeGreaterThanOrEqual(0);
    expect(pauseIndex).toBeGreaterThan(exitIndex);
    expect(body).toMatch(/video\.removeAttribute\('src'\);/);
    expect(body).toMatch(/video\.load\(\);/);
  });

  it('the sign-out guard also exits fullscreen before pausing, not just pausing alone', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isGuest\) return;\s*\n\s*const video = videoRef\.current;[\s\S]*?\n {2}\}, \[isGuest\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/exitVideoFullscreen\(video\);/);
    expect(body).toMatch(/video\.pause\(\);/);
  });

  it('reset for a genuinely new entry: isFullscreen/fallbackFullscreen/hasEnded are all cleared alongside hasStarted in the fetch effect\'s load()', () => {
    const body = source.match(/const load = async \(\) => \{[\s\S]*?try \{/)?.[0] ?? '';
    expect(body).toMatch(/setIsFullscreen\(false\);/);
    expect(body).toMatch(/setFallbackFullscreen\(false\);/);
    expect(body).toMatch(/setHasEnded\(false\);/);
  });
});

describe('BetaVideoModal.jsx — signed-URL access is untouched by this fix', () => {
  it('requestBetaVideoUrl / the fetch effect are unchanged - fullscreen logic never touches URL fetching, signing, or auth', () => {
    expect(source).toMatch(/const \{ url, expiresAt \} = await requestBetaVideoUrl\(playbackId\);/);
    expect(source).not.toMatch(/webkitEnterFullscreen[\s\S]{0,200}requestBetaVideoUrl/);
  });
});

describe('BetaVideoModal.jsx — Escape never closes the whole modal while a fullscreen state is active', () => {
  const keyDownBody = () =>
    source.match(/useEffect\(\(\) => \{\s*\n\s*const handleKeyDown = \(e\) => \{[\s\S]*?\n {2}\}, \[onClose, isFullscreen, fallbackFullscreen\]\);/)?.[0] ?? '';

  it('guards onClose behind both fullscreen states, and depends on them (not just [onClose])', () => {
    const body = keyDownBody();
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(fallbackFullscreen\) \{\s*\n\s*setFallbackFullscreen\(false\);\s*\n\s*return;\s*\n\s*\}/);
    expect(body).toMatch(/if \(isFullscreen\) return;/);
  });

  it('standards-track fullscreen (isFullscreen): Escape is left to the browser + handleStandardFullscreenChange, never reaches onClose', () => {
    const body = keyDownBody();
    const isFsIndex = body.indexOf('if (isFullscreen) return;');
    const onCloseIndex = body.indexOf('onClose();');
    expect(isFsIndex).toBeGreaterThanOrEqual(0);
    expect(onCloseIndex).toBeGreaterThan(isFsIndex);
  });

  it('the in-app fallback fullscreen (fallbackFullscreen): Escape exits fallback only, checked before onClose is ever reached', () => {
    const body = keyDownBody();
    const fallbackIndex = body.indexOf('setFallbackFullscreen(false);');
    const onCloseIndex = body.indexOf('onClose();');
    expect(fallbackIndex).toBeGreaterThanOrEqual(0);
    expect(onCloseIndex).toBeGreaterThan(fallbackIndex);
  });

  it('neither fullscreen state active (the small preview modal itself): Escape still closes the modal, preserving prior behavior', () => {
    const body = keyDownBody();
    expect(body).toMatch(/if \(e\.key !== 'Escape'\) return;/);
    expect(body).toMatch(/onClose\(\);\s*\n\s*\};/);
  });
});
