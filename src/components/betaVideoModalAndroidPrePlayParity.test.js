// Android/iPhone pre-play presentation parity fix.
//
// Reported defect: on Android, the "Begin Exercise" overlay (Gentle
// Awakening and every other guided-exercise video) showed a visibly
// blurred poster frame plus a faint native video control bar bleeding
// through underneath it; iPhone showed a clean black frame with the
// same centred play button and instructions. Root cause: the overlay
// was `bg-black/60 backdrop-blur-sm` - a translucent, blurred layer -
// which lets whatever the underlying <video> element has already
// decoded and painted show through. iOS's WKWebView paints nothing for
// an unplayed <video>, so there was nothing to see through the blur;
// Android's WebView decodes and paints the first frame once
// `preload="metadata"` resolves (plus its native `controls` bar, which
// stays on throughout per `controls={!hasEnded}`), so the same
// translucent/blurred overlay there visibly let both bleed through.
//
// Fix: the overlay is now a fully opaque `bg-black`, with no
// `backdrop-blur-*` and no `bg-black/NN` alpha - opaque paint hides
// whatever is underneath regardless of engine, matching the clean
// black iPhone presentation on both platforms. No DOM/component
// rendering is available in this repo's Vitest (see
// betaVideoModalFullscreen.test.js's own note for why) - source-level
// checks, matching every other regression guard in this file's
// neighbourhood for exactly that reason.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./BetaVideoModal.jsx', import.meta.url)), 'utf-8');

const beginOverlayBody = () =>
  source.match(/\{!hasStarted && !timerEnded && \(\s*\n\s*<button[\s\S]*?<\/button>\s*\n\s*\)\}/)?.[0] ?? '';

describe('BetaVideoModal.jsx — Begin Exercise overlay is fully opaque, matching the iPhone clean-black presentation', () => {
  it('found the overlay button block', () => {
    expect(beginOverlayBody()).not.toBe('');
  });

  it('uses a plain opaque bg-black - never a translucent bg-black/NN alpha value', () => {
    const body = beginOverlayBody();
    expect(body).toMatch(/\bbg-black\b/);
    expect(body).not.toMatch(/bg-black\/\d+/);
  });

  it('never applies backdrop-blur - that is what let Android\'s decoded poster frame and native controls show through', () => {
    const body = beginOverlayBody();
    expect(body).not.toMatch(/backdrop-blur/);
  });

  it('still covers the entire frame (absolute inset-0) above the video (z-10), and is unique to this one overlay - the Begin button itself is unaffected (centred play icon + label + hint)', () => {
    const body = beginOverlayBody();
    expect(body).toMatch(/absolute inset-0 z-10/);
    expect(body).toMatch(/aria-label=\{`Begin \$\{entry\.title\}`\}/);
    expect(body).toMatch(/play_arrow/);
    expect(body).toMatch(/Tap to begin with sound/);
  });

  it('applies to every video entry alike (exercise videos and Sleep Soundscapes share this one button, branching only on its label) - not a special case for one entry', () => {
    const body = beginOverlayBody();
    expect(body).toMatch(/\{isSleepSound \? 'Play' : 'Begin Exercise'\}/);
  });

  it('other, later overlays (Paused/Done, timer-ended, the shared completion reveal) are untouched - this fix is scoped to the pre-play state only', () => {
    expect(source).toMatch(/bg-black\/70 backdrop-blur-sm/);
    expect(source).toMatch(/bg-black\/80 backdrop-blur-sm/);
  });
});
