import { useId } from 'react';

/*
 * Stage 3 — Rain (MLT-3B-06, Ticket Group 4)
 *
 * The session-specific atmospheric layer from
 * docs/stage-3-implementation-blueprint.md §2.2 — "fine vertical particle
 * streaks, low density... always paired with the ambient rain audio cue —
 * never silent, never decorative-only." (Audio pairing is explicitly out
 * of scope for this ticket — see SESSION INTEGRATION below.) Calming, not
 * dramatic: long, slow-falling streaks, not a realistic downpour.
 *
 * MOUNTING
 *   This component has no awareness of tier or triggers —
 *   AtmosphereManager decides when to mount it
 *   (canRenderTier(tier, 2) && rainActive, per its own MOUNTED LAYERS doc
 *   comment). The Session Engine (Phase 3C) that would set `rainActive`
 *   for real doesn't exist yet — see that same comment for the stub.
 *
 * IMPLEMENTATION
 *   25 droplets (within this ticket's 20–30 requirement), positions/
 *   durations/opacities all computed once from DROPLETS below via a
 *   deterministic index-based formula — never Math.random(), so the
 *   field never changes between renders or reloads. Every droplet shares
 *   one @keyframes definition (a single `translateY` fall + `opacity`
 *   fade in/out) rather than 25 separate keyframe blocks — each
 *   droplet's peak opacity is supplied as a CSS custom property
 *   (--rain-peak) on its own inline style, referenced from the shared
 *   keyframe, the same "one keyframe, many custom-property instances"
 *   technique that keeps the injected stylesheet small at this element
 *   count (Stars uses the equivalent pattern for its 15 circles' timing).
 *   Transform and opacity only — no particle engine (that's the
 *   different, later MLT-3B-07 ticket: a shared *event-triggered* pool
 *   for Particles, not this continuous ambient layer), no splash
 *   simulation, no physics, no canvas, no requestAnimationFrame, no
 *   animation library, no new dependency.
 *
 *   Each droplet's fall distance is a fixed pixel value (0px to 400px,
 *   not a percentage) rather than the box-relative `%` some other Stage
 *   3 layers use for transforms — `translateY` percentages are relative
 *   to the *element's own* height, not its container, which would make a
 *   thin droplet barely move; a fixed pixel range was the simplest way
 *   to guarantee a full top-to-bottom crossing. 400px comfortably covers
 *   every container height used in Stage3Preview.jsx today; a much
 *   taller real session container would want this revisited when Rain is
 *   actually wired into one (see SESSION INTEGRATION).
 *
 * PROPS
 *   active      boolean, default true. Whether the rain is visually on —
 *               distinct from whether it's mounted at all (that's
 *               AtmosphereManager's job). When false, droplets render at
 *               opacity 0 with animation paused, so a demo can compare
 *               "mounted and active" against "mounted and inactive" side
 *               by side. In the real, integrated path this is always
 *               true — AtmosphereManager only mounts Rain once
 *               `rainActive` is already true.
 *   paused      boolean, default false. Set by AtmosphereManager from its
 *               existing document.visibilitychange listener (the same
 *               one introduced for Clouds — no new listener here).
 *   className   optional, forwarded to the root wrapper.
 *
 * VISIBILITY PAUSE
 *   Reuses AtmosphereManager's existing `documentHidden` state — no
 *   second `document.visibilitychange` listener is created anywhere.
 *
 * REDUCED MOTION
 *   Defensive only — AtmosphereManager already forces tier to 0 under
 *   `prefers-reduced-motion: reduce`, so in the real integrated app this
 *   component is never mounted at all while reduced motion is active.
 *   This internal `@media` fallback exists purely in case Rain is ever
 *   rendered standalone outside AtmosphereManager (as it is in
 *   Stage3Preview.jsx's own demo panels) — it freezes every droplet at a
 *   static, visible mid-fall opacity rather than animating.
 *
 * ACCESSIBILITY
 *   `aria-hidden="true"` and `pointer-events-none` on the root — purely
 *   decorative, no focusable elements, no semantic content.
 *
 * SESSION INTEGRATION
 *   Deliberately not connected to routines, emotional state,
 *   celebrations, audio, or recommendations — none of those engines
 *   exist yet. `rainActive` (owned by AtmosphereManager, not this file)
 *   is the one, narrow extension point a future Session Engine ticket
 *   will drive; this file has no other coupling to session state.
 */

const RAIN_COUNT = 25;
const FALL_DISTANCE_PX = 400; // see IMPLEMENTATION above

// Deterministic — never Math.random(). Modular arithmetic scatters each
// droplet's position/timing/opacity from its index alone, so the field
// is identical on every render, reload, and build.
const DROPLETS = Array.from({ length: RAIN_COUNT }, (_, i) => ({
  left: ((i * 41 + 13) % 96) + 2,          // 2–98%, spread across full width
  duration: 8 + (i % 5) * 1.2,             // ~8–13.8s — "long cycles", slight variation
  delay: -(i * 0.6),                       // negative delay staggers phase, no JS needed
  peakOpacity: 0.08 + (i % 4) * 0.04,      // 0.08 / 0.12 / 0.16 / 0.20, cycling
  height: 14 + (i % 3) * 6,                // 14 / 20 / 26 px streak length
}));

export const Rain = ({ active = true, paused = false, className = '' }) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @keyframes stage3-rain-fall-${uid} {
          0% { transform: translateY(0px); opacity: 0; }
          10% { opacity: var(--rain-peak, 0.12); }
          85% { opacity: var(--rain-peak, 0.12); }
          100% { transform: translateY(${FALL_DISTANCE_PX}px); opacity: 0; }
        }
        .stage3-rain-${uid} .droplet {
          animation-name: stage3-rain-fall-${uid};
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-play-state: ${active && !paused ? 'running' : 'paused'};
          opacity: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .stage3-rain-${uid} .droplet {
            animation: none;
            opacity: ${active ? 'var(--rain-peak, 0.12)' : 0};
          }
        }
      `}</style>
      <div className={`stage3-rain-${uid} absolute inset-0`}>
        {DROPLETS.map((drop, i) => (
          <div
            key={i}
            className="droplet absolute rounded-full"
            style={{
              left: `${drop.left}%`,
              top: '-20px',
              width: 1.5,
              height: drop.height,
              background: 'var(--stage3-mist)',
              animationDuration: `${drop.duration}s`,
              animationDelay: `${drop.delay}s`,
              '--rain-peak': active ? drop.peakOpacity : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
};
