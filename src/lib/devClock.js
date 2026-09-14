/*
 * Close Remaining Daily-Journey Limitations — deterministic Today-state
 * test seam.
 *
 * Requirement 2 needs a way to exercise all 8 Today states without
 * permanently changing the machine clock, but explicitly must not add a
 * "publicly exposed production debug control." import.meta.env.DEV is
 * statically inlined by Vite and dead-code-eliminated in a production
 * build (`npm run build`), so the override branch below — and the
 * sessionStorage key it reads — do not exist in the shipped bundle at
 * all, not merely hidden behind a UI toggle. There is no in-app control
 * that sets this key; it is only ever set from a DEV-server browser
 * console for manual/automated testing, and only ever affects that one
 * tab's sessionStorage (never persisted, never synced, never shipped).
 *
 * now() is a drop-in replacement for `new Date()` for any page that
 * needs to derive a time-of-day state.
 */
const OFFSET_KEY = '__wakewise_dev_clock_offset_ms';

export const now = () => {
  if (import.meta.env.DEV) {
    try {
      const raw = sessionStorage.getItem(OFFSET_KEY);
      if (raw) {
        const offset = Number(raw);
        if (Number.isFinite(offset)) return new Date(Date.now() + offset);
      }
    } catch {
      // sessionStorage unavailable — fall through to the real clock.
    }
  }
  return new Date();
};
