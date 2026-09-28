import { useEffect, useState } from 'react';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';

// Physical-iPhone completion-transition-tuning pass — root-cause diagnosis
// of "the completion transition still feels slightly too quick/abrupt"
// after the first Phase 3 pass: it was never really about total duration
// (CompletionReveal's own settle time was already ~800-1200ms). Every
// ternary-swap/early-return screen this hook is used on (MorningFlow.jsx,
// Breathe.jsx, EveningBreathing.jsx, QuietBreathing.jsx's standalone
// branch, MorningMeditate.jsx, EveningMeditate.jsx) unmounted its active
// exercise view (ring, timer, controls) the EXACT instant `isCompleted`
// flipped true, with CompletionReveal's own panel starting from a literal
// empty/background-only frame (opacity 0) - a hard, silent cut instantly
// followed by a delayed fade-in. That cut is what reads as abrupt,
// regardless of how gently the fade-in itself plays out afterward - see
// this hook's own test file for the frame-by-frame reasoning.
//
// This hook is PURELY ADDITIVE and purely visual - it never reads or
// changes the screen's own `isCompleted` state, and every existing
// behaviour already gated on that state (audio/timer suspension, toggle
// visibility, "suspended" props, etc.) is completely unaffected, unmoved
// in time. It only controls WHICH of a screen's two render branches
// actually shows, by decoupling "logically complete, immediately, for
// every pre-existing side effect" (the caller's own unchanged
// `isCompleted`) from "visually ready to swap to the completion panel"
// (`showCompletionPanel`, below) - inserting a brief HOLD (the exercise's
// own final frame stays on screen exactly as it already was, ~200ms) and
// then a brief EXIT FADE of that SAME still-mounted active view (~350ms,
// applied only to its own outer wrapper - its internal DOM/logic is
// completely untouched) before the completion panel actually swaps in.
// Never a large per-screen architectural rewrite: the active view is
// never kept mounted "alongside" the completion panel, and no true
// simultaneous cross-fade of both DOMs is attempted - this is the
// smallest reusable improvement that removes the hard cut, not a
// rendering-architecture change.
//
// Reduced Motion skips the hold and exit-fade entirely, revealing
// immediately - matching "no scale, slide, pulse or stagger" (this hook
// contributes no stagger of its own either way; CompletionReveal owns
// that, and applies its own short cross-fade once `showCompletionPanel`
// is true).
//
// Persistence/cleanup are never gated on this hook: every existing
// completion handler already stops timers/audio and records completion
// synchronously, at the exact original moment, before this hook's timers
// even start - this hook only ever delays which JSX renders, never any
// side effect.
const HOLD_MS = 200;
const EXIT_FADE_MS = 350;

const detectReducedMotion = () => {
  try {
    return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
};

export const useCompletionHandoff = (isCompleted) => {
  const [reducedMotion] = useState(detectReducedMotion);
  // 'phase' is only meaningful while isCompleted && !reducedMotion - see
  // effectivePhase below, which derives the actual returned state for
  // every other case rather than routing them through more setState
  // calls here.
  const [phase, setPhase] = useState('active');

  useEffect(() => {
    if (!isCompleted || reducedMotion) return;
    // Resets to 'active' synchronously at the start of every fresh
    // completion cycle - the first step of kicking off this effect's own
    // hold -> exit-fade timer sequence below (the same sanctioned
    // "external system"/timer-kickoff idiom useMomentumCompletion.js's
    // own loading-state reset already documents), not the "you might not
    // need an Effect" anti-pattern react-hooks/set-state-in-effect
    // otherwise guards against. Required, not cosmetic: without it, a
    // second completion in the same mount (Play Again/Breathe again)
    // would inherit the PREVIOUS cycle's stale 'revealed' phase for the
    // brief instant before the hold timer below fires.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('active');
    const holdTimer = setTimeout(() => setPhase('exiting'), HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, [isCompleted, reducedMotion]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const fadeTimer = setTimeout(() => setPhase('revealed'), EXIT_FADE_MS);
    return () => clearTimeout(fadeTimer);
  }, [phase]);

  // Derived, not stored: both "not completed" (always 'active', however
  // stale `phase` itself might be from a prior cycle) and "completed but
  // Reduced Motion" (always 'revealed' immediately, no hold/exit-fade at
  // all) are fully derivable from props/reducedMotion already available
  // this render.
  const effectivePhase = !isCompleted ? 'active' : reducedMotion ? 'revealed' : phase;

  return {
    // The active view's own branch stays rendered (unchanged internally)
    // through both 'active' and 'exiting' - only 'revealed' swaps it out.
    showActiveView: effectivePhase !== 'revealed',
    // Gate an opacity/transition style on the active view's own outer
    // wrapper only during 'exiting' - never during the initial hold,
    // where it must stay at full, unchanged opacity.
    activeViewExiting: effectivePhase === 'exiting',
    showCompletionPanel: effectivePhase === 'revealed'
  };
};
