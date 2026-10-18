// Schedules a callback to fire at a specific future instant, safely.
//
// Plain `setTimeout(fn, ms)` cannot be handed an arbitrary expiry-minus-now
// delay directly: browser/Node timers take a 32-bit signed int, so any
// delay over ~24.8 days (2147483647ms) overflows and most engines fire it
// almost immediately instead of waiting — exactly the failure mode an
// annual (or even monthly) subscription's real expiry would hit if this
// were naively `setTimeout(callback, expiresAtMs - Date.now())`. This
// schedules the real delay in a chain of safe-sized hops instead, so a
// far-future expiry waits the real amount of time, not ~0ms.
//
// Pure/framework-free (no React import) so it is directly testable with
// Vitest's fake timers, matching this codebase's established style for
// time-sensitive logic (see entitlementResolution.js's own `now`
// parameter).
const MAX_SAFE_DELAY_MS = 2 ** 31 - 1;

/**
 * @param {number} targetMs epoch-ms instant to fire at.
 * @param {() => void} callback
 * @param {() => number} [nowMs] injectable clock, defaults to Date.now.
 * @returns {() => void} cancel function — safe to call multiple times.
 */
export const scheduleAtTime = (targetMs, callback, nowMs = Date.now) => {
  let cancelled = false;
  let timeoutId = null;

  const tick = () => {
    if (cancelled) return;
    const remaining = targetMs - nowMs();
    if (remaining <= 0) {
      callback();
      return;
    }
    timeoutId = setTimeout(tick, Math.min(remaining, MAX_SAFE_DELAY_MS));
  };

  tick();

  return () => {
    cancelled = true;
    if (timeoutId !== null) clearTimeout(timeoutId);
  };
};
