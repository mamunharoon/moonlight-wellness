import { useId } from 'react';

/*
 * Stage 3 — Stars (MLT-3B-03, Ticket Group 3)
 *
 * The Moonlight-only atmospheric layer from
 * docs/stage-3-implementation-blueprint.md §2.2 — "sparse (12–20), gentle
 * twinkle (opacity pulse, 3–6s, staggered)." A purely decorative, ambient
 * layer; carries no information and has no interactive behaviour.
 *
 * MOUNTING
 *   This component has no awareness of phase or tier — AtmosphereManager
 *   decides when to mount it (canRenderTier(tier, 1) && phase is
 *   moonlight). It never checks either itself.
 *
 * IMPLEMENTATION
 *   15 stars (within this ticket's 14–16 requirement), one <svg> root
 *   containing 15 <circle> children — SVG, matching Moon.jsx's own
 *   precedent for celestial visuals rather than 15 separate HTML divs.
 *   Positions, radii, twinkle duration, and twinkle delay are all
 *   computed once from STARS below via a deterministic index-based
 *   formula (modular arithmetic) — never Math.random(), so the field
 *   never changes between renders or reloads. Only `opacity` animates
 *   (no `transform`, per this ticket's scope); no glow — each circle is
 *   a single flat fill, no filter, no radial-gradient halo (contrast
 *   with Moon.jsx's own halo, which this deliberately does not repeat).
 *   No canvas, no requestAnimationFrame, no animation library, no new
 *   dependency. Same useId-scoped <style> pattern as the other Stage 3
 *   components.
 *
 * VISIBILITY PAUSE
 *   Deliberately absent. Unlike Clouds, Stars has no `paused` prop and
 *   AtmosphereManager's document.visibilitychange listener does not
 *   reach it — an opacity-only twinkle across 15 small SVG circles is
 *   cheap enough that pausing it in the background saves nothing
 *   measurable (same reasoning Group 2 used to defer visibility handling
 *   in the first place, still valid here for this specific layer).
 *
 * REDUCED MOTION
 *   Defensive only — AtmosphereManager already forces tier to 0 under
 *   `prefers-reduced-motion: reduce`, so in the real integrated app this
 *   component is never mounted at all while reduced motion is active.
 *   This internal `@media` fallback exists purely in case Stars is ever
 *   rendered standalone outside AtmosphereManager — it freezes every
 *   star at a static, visible mid-twinkle opacity rather than animating.
 *
 * ACCESSIBILITY
 *   `aria-hidden="true"` and `pointer-events-none` on the root — purely
 *   decorative, no focusable elements, cannot introduce a keyboard trap.
 *
 * EXTENSION POINT
 *   blueprint §2.2 / workbook MLT-3B-04 reserve a future celebration
 *   density boost ("density doubles briefly during a Celebration
 *   bloom"). Not implemented as a prop here — the Celebration Engine
 *   (Phase 3E) doesn't exist yet, and an unused prop would be dead API
 *   surface. This comment is the extension point until 3E has something
 *   real to pass.
 */

const STAR_COUNT = 15;

// Deterministic — never Math.random(). Modular arithmetic scatters each
// star's position/size/timing from its index alone, so the field is
// identical on every render, reload, and build. Multipliers (37, 53)
// chosen only to avoid an obviously-gridded look; the exact values carry
// no other meaning.
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  cx: ((i * 37 + 11) % 97) + 2,       // 2–98, spread across full width
  cy: ((i * 53 + 7) % 50) + 4,        // 4–53, upper-to-mid sky only
  r: 0.6 + (i % 3) * 0.25,            // 0.6 / 0.85 / 1.1, cycling
  twinkleDuration: 4 + (i % 4),       // 4–7s, cycling — this ticket's range
  twinkleDelay: -(i * 0.9),           // negative delay staggers phase, no JS needed
}));

export const Stars = ({ className = '' }) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @keyframes stage3-star-twinkle-${uid} {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }
        .stage3-stars-${uid} circle {
          animation-name: stage3-star-twinkle-${uid};
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .stage3-stars-${uid} circle {
            animation: none;
            opacity: 0.6;
          }
        }
      `}</style>
      <svg
        className={`stage3-stars-${uid} w-full h-full`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        {STARS.map((star, i) => (
          <circle
            key={i}
            cx={star.cx}
            cy={star.cy}
            r={star.r}
            fill="var(--stage3-mist)"
            style={{
              animationDuration: `${star.twinkleDuration}s`,
              animationDelay: `${star.twinkleDelay}s`,
            }}
          />
        ))}
      </svg>
    </div>
  );
};
