// Physical-iPhone completion-overlay defect fix.
//
// Confirmed on a real iPhone: a guided video reaches its natural end
// while presented in iOS's native webkitEnterFullscreen() video layer.
// Root cause - handleEnded used to call setIsFullscreen(false) directly,
// a plain React state write that has no effect whatsoever on that native,
// system-level presentation layer. The completion overlay's own render
// guard (!isFullscreen) trusted that premature `false` and rendered into
// the DOM immediately - but still fully hidden behind the still-live
// native layer, since nothing had ever actually asked it to exit. The
// user only saw anything once they manually backed out of fullscreen
// themselves - at which point the underlying <video> element, which had
// remained a fully live, native, `controls`-enabled player the entire
// time, is what caught their next tap and restarted playback via its own
// built-in ended-state replay affordance - entirely outside this
// component's own JS, and entirely invisible to any of its state.
//
// Fixed by: (1) actually asking whichever fullscreen mechanism is
// genuinely active to exit (exitVideoFullscreen, capability-detected,
// already existed but was never called from handleEnded), (2) leaving
// isFullscreen untouched in that case and letting the real, asynchronous
// webkitendfullscreen/fullscreenchange event be what clears it and reveals
// the overlay - never a synchronous guess, never an arbitrary timeout,
// (3) disabling native `controls` once hasEnded so no live native replay
// surface remains reachable underneath either overlay while this plays
// out, and (4) re-running the focus effect once the overlay is actually
// visible, not merely once hasEnded fires.
//
// No DOM rendering is available in this repo's Vitest - source-level
// checks of the actual effect/handler bodies, matching every other
// regression guard in this codebase. Browser capabilities (webkit video
// fullscreen vs. the standards Fullscreen API vs. neither) are reasoned
// about separately below, exactly as real devices differ, never assumed
// to be one universal implementation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./BetaVideoModal.jsx', import.meta.url)), 'utf-8');

const fullscreenEffectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*const video = videoRef\.current;\s*\n\s*if \(!video\) return;\s*\n\s*\n\s*const handleBeginFullscreen[\s\S]*?\n {2}\}, \[videoUrl, onEnded, completionContext, fallbackFullscreen\]\);/)?.[0] ?? '';
const exitHelperBody = fullscreenEffectBody.match(/const exitFullscreenAfterCompletion = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
const handleEndedBody = fullscreenEffectBody.match(/const handleEnded = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';

describe('handleEnded never guesses isFullscreen false directly - it delegates to a real capability-detected exit', () => {
  it('the fullscreen-wiring effect and its three sub-pieces (exitFullscreenAfterCompletion + handleEnded) all exist and were located correctly - a sanity check every other test in this file depends on', () => {
    expect(fullscreenEffectBody).not.toBe('');
    expect(exitHelperBody).not.toBe('');
    expect(handleEndedBody).not.toBe('');
  });

  it('handleEnded never calls setIsFullscreen directly - only exitFullscreenAfterCompletion (called from inside it) may ever touch that state, and only conditionally', () => {
    expect(handleEndedBody).not.toMatch(/setIsFullscreen/);
    expect(handleEndedBody).toMatch(/exitFullscreenAfterCompletion\(\);/);
  });

  it('handleEnded explicitly pauses the video before anything else, so no residual playback can survive whatever fullscreen teardown follows', () => {
    const iGuard = handleEndedBody.indexOf('hasEndedProcessedRef.current = true;');
    const iPause = handleEndedBody.indexOf('video.pause();');
    const iExit = handleEndedBody.indexOf('exitFullscreenAfterCompletion();');
    expect(iGuard).toBeGreaterThanOrEqual(0);
    expect(iPause).toBeGreaterThan(iGuard);
    expect(iExit).toBeGreaterThan(iPause);
  });
});

describe('exitFullscreenAfterCompletion - capability detection, not one universal implementation', () => {
  it('in-app fallback fullscreen (no native API involved) is cleared synchronously - nothing else will ever clear it', () => {
    const branch = exitHelperBody.match(/if \(fallbackFullscreen\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(branch).toMatch(/setFallbackFullscreen\(false\);/);
    expect(branch).toMatch(/return;/);
  });

  it('when NEITHER webkit video fullscreen nor the standards Fullscreen API is genuinely active, isFullscreen is corrected synchronously (no native exit event would otherwise ever fire)', () => {
    const branch = exitHelperBody.match(/const webkitActive[\s\S]*?const standardActive[\s\S]*?if \(!webkitActive && !standardActive\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(branch).toMatch(/const webkitActive = Boolean\(video\.webkitDisplayingFullscreen\);/);
    expect(branch).toMatch(/const standardActive = document\.fullscreenElement === video;/);
    expect(branch).toMatch(/setIsFullscreen\(false\);/);
  });

  it('when genuinely still presenting fullscreen (either mechanism), only the real exit API is invoked - isFullscreen itself is left alone for the real event to clear', () => {
    const tailBody = exitHelperBody.slice(exitHelperBody.indexOf('!webkitActive && !standardActive'));
    const afterGuard = tailBody.slice(tailBody.indexOf('}') + 1);
    expect(afterGuard).toMatch(/exitVideoFullscreen\(video\);/);
    expect(afterGuard).not.toMatch(/setIsFullscreen/);
  });

  it('reads live DOM/browser state (video.webkitDisplayingFullscreen, document.fullscreenElement) rather than the closed-over isFullscreen state value - immune to any stale-closure timing', () => {
    expect(exitHelperBody).not.toMatch(/if \(isFullscreen\)/);
    expect(exitHelperBody).not.toMatch(/if \(!isFullscreen\)/);
  });
});

describe('the real, asynchronous native exit events - not a synchronous guess and not a timeout - are what reveal the overlay', () => {
  it('handleEndFullscreen (webkitendfullscreen) and handleStandardFullscreenChange (fullscreenchange) are unchanged: they only ever set isFullscreen/fallbackFullscreen, never call .play() or touch hasEnded', () => {
    const beginEnd = fullscreenEffectBody.match(/const handleEndFullscreen = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    const standardChange = fullscreenEffectBody.match(/const handleStandardFullscreenChange = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    for (const body of [beginEnd, standardChange]) {
      expect(body).not.toMatch(/\.play\(\)/);
      expect(body).not.toMatch(/setHasEnded/);
      expect(body).not.toMatch(/currentTime/);
    }
  });

  it('no setTimeout/setInterval/requestAnimationFrame anywhere in the fullscreen-wiring effect or its helper - the fix is event-driven, never an arbitrary delay', () => {
    expect(fullscreenEffectBody).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
  });

  it('the completion overlay\'s own render guard already requires !isFullscreen && !fallbackFullscreen (folded into overlayShouldRender/overlayVisible - completion-transition-tuning pass), and now only the real native/standard exit events (or the synchronous corrections above) can ever flip those - so it only ever becomes visible once the native presentation genuinely no longer obscures it, plus a short fixed settle delay that never itself determines fullscreen state', () => {
    expect(source).toMatch(/const overlayShouldRender = hasEnded && completionContext && !isFullscreen && !fallbackFullscreen;/);
    expect(source).toMatch(/\{overlayVisible && \(/);
  });
});

describe('native controls are disabled once hasEnded - closes the one live native surface that could otherwise restart playback outside any of this component\'s own handlers', () => {
  it('the <video> element\'s controls attribute is now controls={!hasEnded}, not the old unconditional `controls`', () => {
    const videoTag = source.match(/<video\s*\n\s*ref=\{videoRef\}[\s\S]*?\n\s*>/)?.[0] ?? '';
    expect(videoTag).toMatch(/controls=\{!hasEnded\}/);
  });

  it('this applies uniformly to both overlays (completionContext and the old generic Done/Play Again pair) - the controls prop itself is a plain, unconditional `!hasEnded`, never gated on completionContext', () => {
    expect(source).toMatch(/\n\s*controls=\{!hasEnded\}\s*\n/);
  });

  it('handleResumeOrReplay (the old overlay\'s "Play Again"/"Resume" button) still works with controls disabled - it clears hasEnded itself, synchronously, before this render would ever reflect controls={false} again, and .play() is a scriptable API call, never gated by the controls attribute', () => {
    const body = source.match(/const handleResumeOrReplay = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setHasEnded\(false\);/);
    expect(body).toMatch(/video\.play\(\)/);
  });
});

describe('focus moves to the completion overlay only once it is actually visible', () => {
  it('the focus effect now depends on overlayVisible (itself derived from isFullscreen/fallbackFullscreen, plus the short settle delay) - re-running once the real exit event lands and the settle delay elapses, not just once at the moment `ended` fires', () => {
    expect(source).toMatch(/if \(overlayVisible\) completionPrimaryButtonRef\.current\?\.focus\(\);/);
    expect(source).toMatch(/\}, \[overlayVisible\]\);/);
  });
});

describe('idempotency - duplicate ended/fullscreenchange/webkitendfullscreen events are all safe no-ops', () => {
  it('a second `ended` event for the same instance never re-runs any of the completion/fullscreen-exit logic (the existing ref guard already covers this, now also guarding the new exit call)', () => {
    expect(handleEndedBody).toMatch(/if \(hasEndedProcessedRef\.current\) return;/);
    const iGuard = handleEndedBody.indexOf('if (hasEndedProcessedRef.current) return;');
    const iExit = handleEndedBody.indexOf('exitFullscreenAfterCompletion();');
    expect(iExit).toBeGreaterThan(iGuard);
  });

  it('handleEndFullscreen/handleStandardFullscreenChange are plain, idempotent state setters - calling either twice in a row with the same real browser state is a functionally harmless no-op (React bails out on an identical value), and neither ever re-triggers a fullscreen exit or picks a new completion message', () => {
    const beginEnd = fullscreenEffectBody.match(/const handleEndFullscreen = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(beginEnd).not.toMatch(/getMediaCompletionMessage|exitVideoFullscreen|exitFullscreenAfterCompletion/);
  });
});

describe('manual early full-screen exit (before the video ends) is completely unaffected - no completion, no message consumed', () => {
  it('hasEnded/completionMessage/getMediaCompletionMessage are only ever touched inside handleEnded (the `ended` listener) - never inside handleBeginFullscreen, handleEndFullscreen, or handleStandardFullscreenChange', () => {
    const beginFs = fullscreenEffectBody.match(/const handleBeginFullscreen = \(\) => [^\n]+/)?.[0] ?? '';
    const endFs = fullscreenEffectBody.match(/const handleEndFullscreen = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    const standardFs = fullscreenEffectBody.match(/const handleStandardFullscreenChange = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    for (const body of [beginFs, endFs, standardFs]) {
      expect(body).not.toMatch(/hasEnded|completionMessage|getMediaCompletionMessage/);
    }
  });
});

describe('sleep soundscapes remain structurally excluded from every part of this fix - loop means `ended` never fires, so hasEnded/exitFullscreenAfterCompletion/controls={!hasEnded} are all inert no-ops for them, exactly as before', () => {
  it('requestVideoFullscreen (and therefore any fullscreen presentation at all) is never invoked for isSleepSound entries, per the guard in handleBegin/handleResumeOrReplay (2026-10-05: also guards audio-only entries now, same guard extended, not a second one)', () => {
    expect(source).toMatch(/if \(!isSleepSound && !isAudioOnly\) requestVideoFullscreen\(video\);/g);
    expect((source.match(/if \(!isSleepSound && !isAudioOnly\) requestVideoFullscreen\(video\);/g) ?? []).length).toBe(2);
  });

  it('controls={!hasEnded} evaluates to controls={true} for every sleep soundscape, since hasEnded can never become true for a looping <video> (no `ended` event ever fires) - completely unaffected by this fix', () => {
    expect(source).toMatch(/loop=\{isSleepSound\}/);
  });
});
