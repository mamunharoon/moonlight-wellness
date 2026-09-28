import { useEffect, useState } from 'react';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';

// "Your Momentum" foundation, Phase 3 — the ONE shared, accessible
// completion-reveal transition, replacing the abrupt conditional-render
// swap every natural-completion surface previously used. No animation
// utility plugin exists in this repo (tailwind.config.js has `plugins: []`
// - the `animate-in`/`fade-in`/`duration-*` class names already scattered
// across several files, e.g. Meditate.jsx's outer wrapper, are silently
// inert dead code today; confirmed via a repo-wide search for
// `tailwindcss-animate` and any `@keyframes` definition - neither exists
// anywhere in this codebase). This component deliberately reuses this
// app's own ONE proven, actually-functioning animation technique instead
// (SessionComplete.jsx's own completion-ring fill: a short-delayed state
// flip paired with a plain inline `transition` style) rather than either
// inventing a bespoke keyframe system or relying on classes that render
// with zero visual effect.
//
// WHEN IT ANIMATES (and when it deliberately does not):
//   - Reduced Motion (getReducedMotionPreference() OR the OS media query)
//     always renders fully settled immediately - no opacity/scale
//     transition, no stagger, nothing delayed. VoiceOver focus is never
//     held up by this component either way (it never manages focus
//     itself - callers keep their own existing focus behaviour).
//   - A genuinely FRESH completion (this exact mount's own `active`
//     transitioning from false -> true) plays the entrance once.
//   - A screen that is ALREADY showing its completed content on this
//     mount's very first render (a revisit, a direct/stale URL arrival,
//     or - for the three always-rendered completion pages
//     (SessionComplete.jsx/EveningComplete.jsx/
//     SelfGuidedMeditationComplete.jsx) - simply not a genuine live
//     completion this time) must NEVER animate, matching
//     SessionComplete.jsx's own pre-existing `isFreshCompletion`
//     precedent exactly. For a screen whose own `active` boolean is only
//     ever true as a direct result of a real completion just happening
//     during THIS mount (every ternary-swap screen: MorningFlow.jsx,
//     Breathe.jsx, EveningBreathing.jsx, QuietBreathing.jsx,
//     MorningMeditate.jsx, EveningMeditate.jsx, BetaVideoModal.jsx), this
//     is detected automatically (whether `active` was already true on the
//     very first render). For an always-rendered completion PAGE, the
//     caller must pass its own explicit `isFresh` (its own existing
//     freshness signal, e.g. `state.status === 'playing'` captured at
//     mount) - auto-detection cannot distinguish "genuine" from "revisit"
//     for a component whose `active` prop is unconditionally true from
//     the start.
//
// `journeyTone` selects one of this app's own already-approved, existing
// glow shadow tokens (morning-glow/evening-glow/mint-glow - never a new
// colour) for a restrained, ONE-SHOT glow fade-in behind the check/badge
// (never a repeating pulse - a looping animation needs its own
// @keyframes, which would be new animation infrastructure this component
// deliberately avoids; a one-shot glow appearing alongside the fade+scale
// already reads as "settling in," not a static badge, while staying
// calmer and more accessible than a true oscillating pulse).
//
// `celebratory` (default true) distinguishes a genuine completion from an
// early-exit/interruption surface that shares the same wrapper shape
// (QuietBreathing.jsx's own combined isCompleted/earlyEnded block) -
// false disables the scale and glow entirely, leaving only the plain
// opacity cross-fade the approved brief requires for that case ("a simple
// supportive cross-fade only... do not show the completed check
// animation").
//
// `stagger` (optional) reveals an array of child nodes with a small,
// approved 100-150ms incremental delay each (badge -> greeting -> insight/
// milestone) rather than everything appearing at once. Omitting it renders
// `children` as one uniform fade+scale with no internal staggering - both
// are valid.
//
// `actions` (optional, only meaningful alongside `stagger`) renders after
// the staggered content with NO transitionDelay of its own - "reveal
// actions without delay" per the approved brief: the primary/secondary
// buttons fade in immediately alongside the frame itself rather than
// being stacked behind however many staggered items precede them. Neither
// `stagger` nor `actions` ever delay the primary action's own
// interactivity either way - only opacity animates in; pointer-events are
// never disabled during the transition.
const detectReducedMotion = () => {
  try {
    return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
};

const GLOW_CLASSES = Object.freeze({
  morning: 'shadow-morning-glow',
  evening: 'shadow-evening-glow',
  anytime: 'shadow-mint-glow'
});

// Physical-iPhone integration review — true end-to-end settle time is
// FRAME_TRANSITION_MS/stagger delay/STAGGER_TRANSITION_MS combined, not
// FRAME_TRANSITION_MS alone (measured, e.g. a 2-item stagger: 20ms initial
// commit delay + STAGGER_BASE_DELAY_MS + 1*STAGGER_STEP_MS +
// STAGGER_TRANSITION_MS ≈ 950ms). Retuned from an earlier pass that
// genuinely settled faster than the approved ~800-1200ms target (was
// BASE=100/STEP=120/TRANSITION=400, settling ~640-760ms) - STAGGER_STEP_MS
// stays within the approved 100-150ms-per-item range (now at its top);
// STAGGER_BASE_DELAY_MS is a separate initial settle-in delay before the
// first staggered item begins, not itself bound by that per-item range.
const FRAME_TRANSITION_MS = 550;
const STAGGER_TRANSITION_MS = 500;
const STAGGER_STEP_MS = 150;
const STAGGER_BASE_DELAY_MS = 300;

export const CompletionReveal = ({
  active,
  isFresh,
  journeyTone,
  celebratory = true,
  stagger,
  actions,
  children,
  className = '',
  ...rest
}) => {
  const [reducedMotion] = useState(detectReducedMotion);
  // Auto-detected freshness: true means `active` was NOT yet true on this
  // component's very first render, so a LATER transition to true within
  // this same mount is a genuine fresh completion. Ignored whenever the
  // caller passes an explicit `isFresh` instead (see the doc comment
  // above for why the always-rendered completion pages must do this).
  const [wasInactiveAtMount] = useState(() => !active);
  const genuinelyFresh = isFresh !== undefined ? Boolean(isFresh) : wasInactiveAtMount;
  const shouldAnimate = genuinelyFresh && !reducedMotion;

  const [entered, setEntered] = useState(() => !shouldAnimate);

  useEffect(() => {
    if (!active || !shouldAnimate || entered) return;
    // A short delay (not a bare synchronous setState) so the browser
    // reliably commits the initial "not entered" paint first - the exact
    // same reasoning SessionComplete.jsx's own ring-fill effect already
    // documents for the identical reason.
    const timer = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  if (!shouldAnimate) {
    // Reduced Motion, or a revisit/non-fresh render - fully settled
    // immediately, no transition classes, no stagger delay at all.
    return (
      <div className={className} {...rest}>
        {stagger ? stagger.map((node, i) => <div key={i}>{node}</div>) : children}
        {actions}
      </div>
    );
  }

  const glowClass = celebratory ? (GLOW_CLASSES[journeyTone] ?? '') : '';
  const scaleClass = celebratory ? (entered ? 'scale-100' : 'scale-95') : '';
  const frameClassName = `${entered ? 'opacity-100' : 'opacity-0'} ${scaleClass} ${glowClass}`.trim();
  const frameStyle = {
    transition: `opacity ${FRAME_TRANSITION_MS}ms ease-out, transform ${FRAME_TRANSITION_MS}ms ease-out, box-shadow ${FRAME_TRANSITION_MS}ms ease-out`
  };

  if (!stagger) {
    return (
      <div className={`${className} ${frameClassName}`.trim()} style={frameStyle} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div className={`${className} ${frameClassName}`.trim()} style={frameStyle} {...rest}>
      {stagger.map((node, i) => (
        <div
          key={i}
          style={{
            opacity: entered ? 1 : 0,
            transition: `opacity ${STAGGER_TRANSITION_MS}ms ease-out`,
            transitionDelay: `${STAGGER_BASE_DELAY_MS + i * STAGGER_STEP_MS}ms`
          }}
        >
          {node}
        </div>
      ))}
      {actions && (
        <div style={{ opacity: entered ? 1 : 0, transition: `opacity ${STAGGER_TRANSITION_MS}ms ease-out` }}>
          {actions}
        </div>
      )}
    </div>
  );
};
