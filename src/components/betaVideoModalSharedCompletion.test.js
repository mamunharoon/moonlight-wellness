// Shared guided-media completion correction — one reusable completion
// experience for genuine end-user guided audio/video sessions, added
// additively to BetaVideoModal.jsx via the new, optional
// `completionContext` prop. Every existing caller that omits this prop
// keeps the exact original generic "Done"/"Play Again"/"Close Video"
// overlay - see betaVideoModalFullscreen.test.js's own dedicated coverage
// of that unchanged path. This file covers only what's new: the shared
// overlay itself, message rotation wiring, idempotency, context-aware
// presentation, early-close honesty, and looping-media exclusion.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./BetaVideoModal.jsx');

describe('BetaVideoModal.jsx — completionContext is additive and optional', () => {
  it('defaults to null - every existing caller that omits it is unaffected', () => {
    expect(source).toMatch(/export const BetaVideoModal = \(\{ entry, onClose, showBetaBadge = false, onEnded, completionContext = null, onDurationKnown \}\) => \{/);
  });

  it('this component still never imports react-router or the Session Engine - it can never navigate or record a host exercise\'s completion on its own, regardless of completionContext', () => {
    expect(source).not.toMatch(/react-router-dom|useSession|advanceStep|routineProgress/);
  });
});

describe('BetaVideoModal.jsx — natural `ended` event is the ONLY gate for the new overlay', () => {
  it('handleEnded is idempotent via a ref (hasEndedProcessedRef), not the hasEnded state itself - immune to stale-closure timing', () => {
    const body = source.match(/const handleEnded = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(hasEndedProcessedRef\.current\) return;/);
    expect(body).toMatch(/hasEndedProcessedRef\.current = true;/);
  });

  it('picks the completion message exactly once, inside the same handleEnded callback, and only when completionContext is present - never for a caller that omitted it', () => {
    const body = source.match(/const handleEnded = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(completionContext\) setCompletionMessage\(getMediaCompletionMessage\(\)\);/);
  });

  it('the idempotency ref and the completion message are both reset on every fresh fetch (a genuinely different entry, or Retry) - a second natural completion in the same mounted instance always gets its own fresh pick', () => {
    const fetchEffectResetBlock = source.match(/setHasEnded\(false\);\s*\n\s*setCompletionMessage\(null\);\s*\n\s*hasEndedProcessedRef\.current = false;\s*\n\s*try \{/)?.[0] ?? '';
    expect(fetchEffectResetBlock).not.toBe('');
  });

  it('onClose/handleClose (backdrop, X button, Escape) never touches hasEnded/completionMessage/hasEndedProcessedRef - an early close can never be mistaken for a natural completion', () => {
    const handleCloseBody = source.match(/const handleClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleCloseBody).not.toMatch(/hasEnded|completionMessage|hasEndedProcessedRef|getMediaCompletionMessage/);
  });
});

describe('BetaVideoModal.jsx — the shared completion overlay renders only for a genuine natural end with an opted-in caller', () => {
  it('gated on hasEnded && completionContext && !isFullscreen && !fallbackFullscreen', () => {
    expect(source).toMatch(/\{hasEnded && completionContext && !isFullscreen && !fallbackFullscreen && \(\(\) => \{/);
  });

  it('resolves presentation via getMediaCompletionPresentation(completionContext.journey) - the one shared, allowlisted lookup, never a hand-rolled per-caller colour/label', () => {
    expect(source).toMatch(/const presentation = getMediaCompletionPresentation\(completionContext\.journey\);/);
  });

  it('shows the required "Session Complete" label, the held completionMessage, and "What would you like to do next?" - never a hardcoded generic string instead of the real rotating message', () => {
    const overlayBlock = source.match(/\{hasEnded && completionContext && !isFullscreen && !fallbackFullscreen && \(\(\) => \{([\s\S]*?)\n {14}\}\)\(\)\}/)?.[1] ?? '';
    expect(overlayBlock).not.toBe('');
    expect(overlayBlock).toMatch(/Session Complete/);
    expect(overlayBlock).toMatch(/\{completionMessage\}/);
    expect(overlayBlock).toMatch(/What would you like to do next\?/);
    expect(overlayBlock).not.toMatch(/getMediaCompletionMessage\(\)/);
  });

  it('never renders both the new overlay and the old generic Done/Paused overlay at once - the old one\'s own guard explicitly excludes hasEnded && completionContext', () => {
    expect(source).toMatch(/\{hasStarted && !isFullscreen && !fallbackFullscreen && !isSleepSound && !\(hasEnded && completionContext\) && \(/);
  });

  it('does not autoplay another item and does not automatically advance a guided journey - the overlay renders only the two caller-supplied action buttons, no third "play next" control of any kind', () => {
    const overlayBlock = source.match(/\{hasEnded && completionContext && !isFullscreen && !fallbackFullscreen && \(\(\) => \{([\s\S]*?)\n {14}\}\)\(\)\}/)?.[1] ?? '';
    expect(overlayBlock).not.toMatch(/autoplay|\.play\(\)|handleBegin|handleResumeOrReplay/);
  });
});

describe('BetaVideoModal.jsx — context-aware actions', () => {
  const overlayBlock = source.match(/\{hasEnded && completionContext && !isFullscreen && !fallbackFullscreen && \(\(\) => \{([\s\S]*?)\n {14}\}\)\(\)\}/)?.[1] ?? '';

  it('the primary button always renders, calling completionContext.onPrimaryAction with presentation.primaryLabel', () => {
    expect(overlayBlock).toMatch(/onClick=\{completionContext\.onPrimaryAction\}/);
    expect(overlayBlock).toMatch(/\{presentation\.primaryLabel\}/);
  });

  it('the secondary button is gated on completionContext.onSecondaryAction being truthy - "only when a valid destination exists" - a caller that omits it gets no secondary button at all, for any journey', () => {
    expect(overlayBlock).toMatch(/\{completionContext\.onSecondaryAction && \(/);
    expect(overlayBlock).toMatch(/onClick=\{completionContext\.onSecondaryAction\}/);
    expect(overlayBlock).toMatch(/\{presentation\.secondaryLabel\}/);
  });

  it('the primary button uses presentation.badgeClasses/iconClasses/labelClasses/primaryButtonClasses - fully driven by the shared presentation lookup, never inline per-journey conditionals duplicated here', () => {
    expect(overlayBlock).toMatch(/presentation\.badgeClasses/);
    expect(overlayBlock).toMatch(/presentation\.iconClasses/);
    expect(overlayBlock).toMatch(/presentation\.labelClasses/);
    expect(overlayBlock).toMatch(/presentation\.primaryButtonClasses/);
  });
});

describe('BetaVideoModal.jsx — safe focus handling and restoration', () => {
  it('captures the previously-focused element on mount and restores it on unmount - mirrors ConfirmDialog.jsx\'s own established pattern', () => {
    expect(source).toMatch(/previouslyFocusedRef\.current = document\.activeElement;/);
    expect(source).toMatch(/previouslyFocusedRef\.current\?\.focus\?\.\(\);/);
  });

  // Physical-iPhone completion-overlay defect fix — focus now only moves
  // once the overlay has actually become visible (isFullscreen/
  // fallbackFullscreen both clear too), not merely once hasEnded/
  // completionContext are true - a real native fullscreen exit is
  // asynchronous, so this effect must re-run again once that real exit
  // event lands, matching the overlay's own render guard exactly.
  it('moves focus to the completion overlay\'s own primary action button only once it is actually visible (hasEnded && completionContext && !isFullscreen && !fallbackFullscreen)', () => {
    expect(source).toMatch(/if \(hasEnded && completionContext && !isFullscreen && !fallbackFullscreen\) completionPrimaryButtonRef\.current\?\.focus\(\);/);
    expect(source).toMatch(/\}, \[hasEnded, completionContext, isFullscreen, fallbackFullscreen\]\);/);
  });

  it('the primary button carries the completionPrimaryButtonRef', () => {
    const overlayBlock = source.match(/\{hasEnded && completionContext && !isFullscreen && !fallbackFullscreen && \(\(\) => \{([\s\S]*?)\n {14}\}\)\(\)\}/)?.[1] ?? '';
    expect(overlayBlock).toMatch(/ref=\{completionPrimaryButtonRef\}/);
  });

  it('the overlay\'s live-region root uses role="status" for a single, non-repeated announcement - never aria-live layered redundantly on top of it', () => {
    const overlayBlock = source.match(/\{hasEnded && completionContext && !isFullscreen && !fallbackFullscreen && \(\(\) => \{([\s\S]*?)\n {14}\}\)\(\)\}/)?.[1] ?? '';
    expect(overlayBlock).toMatch(/role="status"/);
    expect(overlayBlock).not.toMatch(/aria-live/);
  });
});

describe('BetaVideoModal.jsx — mobile layout: 44x44 targets, safe scrolling, reduced motion', () => {
  const overlayBlock = source.match(/\{hasEnded && completionContext && !isFullscreen && !fallbackFullscreen && \(\(\) => \{([\s\S]*?)\n {14}\}\)\(\)\}/)?.[1] ?? '';

  it('both action buttons carry min-h-[44px] - meets the 44x44 minimum tap target on every real viewport', () => {
    const buttonBlocks = overlayBlock.match(/<button[\s\S]*?<\/button>/g) ?? [];
    expect(buttonBlocks.length).toBeGreaterThanOrEqual(1);
    for (const button of buttonBlocks) {
      expect(button).toMatch(/min-h-\[44px\]/);
    }
  });

  it('the overlay content wrapper is scrollable (overflow-y-auto, max-h-full) so a short viewport (320x568) can scroll to reach the actions rather than clipping them', () => {
    expect(overlayBlock).toMatch(/overflow-y-auto/);
    expect(overlayBlock).toMatch(/max-h-full/);
  });

  it('has no entrance/continuous animation (no animate-*, no CSS `transition:` style, no keyframe/spin/pulse class) - respects reduced motion the same way MeditationProgressRing.jsx\'s own reducedMotion prop does (gating a genuinely continuous transition), not by removing the baseline active:scale-95/transition-all hover-feedback every button in this app already carries unconditionally (ConfirmDialog.jsx included)', () => {
    expect(overlayBlock).not.toMatch(/\banimate-|\bspin\b|\bpulse\b|style=\{\{[^}]*transition/);
  });

  it('does still carry this app\'s own baseline interactive-feedback classes on both buttons (active:scale-95, transition-all) - the same convention ConfirmDialog.jsx/every other button in this codebase already uses unconditionally, never gated on reducedMotion', () => {
    const buttonBlocks = overlayBlock.match(/<button[\s\S]*?<\/button>/g) ?? [];
    for (const button of buttonBlocks) {
      expect(button).toMatch(/active:scale-95/);
    }
  });
});

describe('BetaVideoModal.jsx — looping Sleep Soundscapes preserve their existing timer/stop contract, never reinterpreted as naturally completed', () => {
  it('the `ended` event is only ever wired via the <video> element\'s own listener, and `loop={isSleepSound}` on that same element - a native browser guarantee that `ended` structurally cannot fire while looping, so the new overlay is unreachable for Sleep Soundscapes regardless of completionContext', () => {
    expect(source).toMatch(/loop=\{isSleepSound\}/);
    expect(source).toMatch(/video\.addEventListener\('ended', handleEnded\);/);
  });

  it('the Sleep Soundscapes timerEnded/"Play again" overlay is completely separate from, and unaffected by, the new shared completion overlay - neither reads completionContext', () => {
    const timerEndedBlock = source.match(/\{timerEnded && \(([\s\S]*?)\n {14}\)\}/)?.[1] ?? '';
    expect(timerEndedBlock).not.toBe('');
    expect(timerEndedBlock).not.toMatch(/completionContext|completionMessage|Session Complete/);
  });
});

describe('BetaVideoModal.jsx — no dormant/unused Part B leftovers, no new content exposure', () => {
  it('imports getMediaCompletionMessage from outcomeMessages.js (extending the existing shared model, not a competing utility) and getMediaCompletionPresentation from its own dedicated lib file', () => {
    expect(source).toMatch(/import \{ getMediaCompletionMessage \} from '\.\.\/lib\/outcomeMessages';/);
    expect(source).toMatch(/import \{ getMediaCompletionPresentation \} from '\.\.\/lib\/mediaCompletionPresentation';/);
  });

  it('never imports or references INTERACTIVE_ONLY_IDS, betaVideoManifest\'s own raw array, or any mechanism that could expose a currently-excluded id - this component only ever renders whatever single `entry` its caller already resolved and passed in', () => {
    expect(source).not.toMatch(/INTERACTIVE_ONLY_IDS|BETA_VIDEO_MANIFEST/);
  });
});
