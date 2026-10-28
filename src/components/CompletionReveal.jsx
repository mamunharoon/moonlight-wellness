/* eslint-disable no-unused-vars */
import { Fragment, useEffect, useState } from 'react';
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
//   - Reduced Motion (getReducedMotionPreference() OR the OS media query),
//     for a genuinely fresh completion, plays a short, plain opacity
//     cross-fade only (REDUCED_MOTION_TRANSITION_MS) - never the scale/
//     glow/stagger treatment. The CTA and every piece of VoiceOver-
//     readable content are already in the DOM (and already interactive -
//     pointer-events are never disabled) the instant this fades in, so
//     nothing is ever functionally held up by the fade itself.
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
// milestone) rather than everything appearing at once - each item settles
// with a small upward slide (STAGGER_RISE_PX) alongside its own opacity
// fade, the approved brief's "small upward greeting reveal" applied
// uniformly to every staggered item, greeting included. Omitting `stagger`
// renders `children` as one uniform fade+scale with no internal
// staggering (and no slide) - both are valid.
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

// B67 device-feedback pass — see useCompletionHandoff.js's own doc
// comment for the full root-cause (the prior ~1.1-1.4s combined sequence
// read as sluggish next to the ~2s audio fade starting at the same
// instant, NOT because either fade individually looked wrong). New
// combined target: ~600-800ms total, "fade out the exercise content, then
// fade in the completion content."
//
// Combined math, with useCompletionHandoff's own retuned 300ms prefix
// (50ms hold + 250ms exit-fade - this component mounts only once that
// prefix completes): COMMIT_DELAY_MS lands `entered` at local +40ms; a
// no-stagger frame then settles at 40+300=340ms after mount (total
// 300+340=640ms); a 2-item stagger's LAST item settles at
// 40+60+1*80+250=430ms after mount (total 300+430=730ms) - both inside
// the 600-800ms target (verified in this file's own test suite). Screens
// with no useCompletionHandoff prefix (the always-rendered completion
// pages reached via navigate(), which have no prior "exercise content" of
// their own to fade out first) settle on this component's timing alone -
// a 2-item stagger there finishes at ~430ms, faster still, which is
// correct: there is nothing to coordinate a fade-OUT with on those pages.
const COMMIT_DELAY_MS = 40;
const FRAME_TRANSITION_MS = 300;
const STAGGER_TRANSITION_MS = 250;
const STAGGER_STEP_MS = 80;
const STAGGER_BASE_DELAY_MS = 60;
const REDUCED_MOTION_TRANSITION_MS = 200;
// "Small upward greeting reveal" (approved brief) - every staggered item,
// greeting included, settles in with a small upward slide alongside its
// own opacity fade (never a bare pop-in). Reduced Motion never applies
// this - see the reducedMotion render branch below, which flattens
// `stagger` with no transform at all, matching "remove scale, slide,
// stagger and pulsing" exactly.
const STAGGER_RISE_PX = 8;

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
  // A revisit/non-fresh render never animates at all, regardless of
  // motion preference - there is no live event to mark. A genuinely
  // fresh completion always animates in SOME form: the full scale/glow/
  // stagger treatment normally, or - under Reduced Motion - a short,
  // plain opacity cross-fade only (see the render branches below).
  const shouldAnimate = genuinelyFresh;

  const [entered, setEntered] = useState(() => !shouldAnimate);

  useEffect(() => {
    if (!active || !shouldAnimate || entered) return;
    // A short delay (not a bare synchronous setState) so the browser
    // reliably commits the initial "not entered" paint first - the exact
    // same reasoning SessionComplete.jsx's own ring-fill effect already
    // documents for the identical reason.
    const timer = setTimeout(() => setEntered(true), COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  if (!shouldAnimate) {
    // A revisit/non-fresh render - fully settled immediately, no
    // transition classes, no stagger delay at all.
    return (
      <div className={className} {...rest}>
        {stagger ? stagger.map((node, i) => <div key={i}>{node}</div>) : children}
        {actions}
      </div>
    );
  }

  if (reducedMotion) {
    // Genuinely fresh, but Reduced Motion is on - a short, plain opacity
    // cross-fade for the WHOLE panel at once, never per-item (no stagger),
    // never scale/glow. `stagger`'s own nodes are simply flattened here,
    // not individually delayed.
    return (
      <div
        className={className}
        style={{ opacity: entered ? 1 : 0, transition: `opacity ${REDUCED_MOTION_TRANSITION_MS}ms ease-out` }}
        {...rest}
      >
        {stagger ? stagger.map((node, i) => <Fragment key={i}>{node}</Fragment>) : children}
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
            // The upward slide is part of the celebratory treatment, same
            // as scale/glow above - a genuine early-exit/interruption
            // surface (celebratory={false}) gets "only a soft plain fade"
            // per the approved brief, never this slide either.
            ...(celebratory ? { transform: entered ? 'translateY(0)' : `translateY(${STAGGER_RISE_PX}px)` } : null),
            transition: celebratory
              ? `opacity ${STAGGER_TRANSITION_MS}ms ease-out, transform ${STAGGER_TRANSITION_MS}ms ease-out`
              : `opacity ${STAGGER_TRANSITION_MS}ms ease-out`,
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
