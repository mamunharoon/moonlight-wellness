import { useId } from 'react';

/*
 * Stage 3 — Clouds (MLT-3B-01, Ticket Group 3)
 *
 * The Daylight/Dusk atmospheric layer from
 * docs/stage-3-implementation-blueprint.md §2.2 — "slow horizontal drift
 * (90–150s crossing), translucent, 2–4 on screen max." A purely decorative,
 * ambient layer; carries no information and has no interactive behaviour.
 *
 * MOUNTING
 *   This component has no awareness of phase or tier — AtmosphereManager
 *   decides when to mount it (canRenderTier(tier, 1) && phase is daylight
 *   or dusk, per docs/stage-3-implementation-blueprint.md §2.2/§2.4). It
 *   never checks either itself.
 *
 * IMPLEMENTATION
 *   Exactly 3 clouds, positions/durations/opacities fixed in CLOUDS below
 *   — no Math.random(), so the field never changes between renders or
 *   reloads. Each cloud is a single soft-edged CSS shape (border-radius +
 *   a static filter: blur, applied once per element, not re-computed per
 *   animation frame) drifting left-to-right via a `translateX` @keyframes
 *   animation, cross-fading in/out at the screen edges via `opacity` in
 *   the same keyframes — transform and opacity only, exactly as scoped.
 *   No canvas, no requestAnimationFrame, no animation library, no new
 *   dependency. Same useId-scoped <style> pattern as Gradient.jsx/
 *   Moon.jsx/Breathing.jsx, so multiple instances never collide.
 *
 * VISIBILITY PAUSE
 *   `paused` (boolean prop, default false) is set by AtmosphereManager
 *   from its own `document.visibilitychange` listener — applies
 *   `animation-play-state: paused` while the tab is backgrounded. Stars
 *   deliberately does not receive an equivalent prop (see its own doc
 *   comment) — this is Clouds-specific.
 *
 * REDUCED MOTION
 *   Defensive only — AtmosphereManager already forces tier to 0 under
 *   `prefers-reduced-motion: reduce`, so in the real integrated app this
 *   component is never mounted at all while reduced motion is active.
 *   This internal `@media` fallback exists purely in case Clouds is ever
 *   rendered standalone outside AtmosphereManager (e.g. an isolated
 *   Stage3Preview.jsx demo panel, the same way Gradient/Moon/Breathing
 *   are each demoed individually there) — it freezes each cloud at a
 *   static, visible mid-crossing position rather than animating.
 *
 * ACCESSIBILITY
 *   `aria-hidden="true"` and `pointer-events-none` on the root — purely
 *   decorative, no focusable elements, cannot introduce a keyboard trap.
 */

// Fixed, deterministic — never Math.random(). top/size in %/px of the
// container; duration within the blueprint's 90–150s range (here
// deliberately narrowed further to this ticket's 120–180s requirement);
// negative delay staggers each cloud's starting position in its own
// cycle without needing JS or randomness. peakOpacity within 0.08–0.15.
const CLOUDS = [
  { top: '10%', width: 220, height: 70, duration: 150, delay: -20, peakOpacity: 0.12 },
  { top: '24%', width: 260, height: 80, duration: 170, delay: -95, peakOpacity: 0.09 },
  { top: '40%', width: 180, height: 60, duration: 130, delay: -55, peakOpacity: 0.14 },
];

export const Clouds = ({ paused = false, className = '' }) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const keyframesCSS = CLOUDS.map((cloud, i) => `
    @keyframes stage3-cloud-drift-${uid}-${i} {
      0% { transform: translateX(-40%); opacity: 0; }
      8% { opacity: ${cloud.peakOpacity}; }
      92% { opacity: ${cloud.peakOpacity}; }
      100% { transform: translateX(140%); opacity: 0; }
    }
    .stage3-clouds-${uid} .cloud-${i} {
      top: ${cloud.top};
      width: ${cloud.width}px;
      height: ${cloud.height}px;
      animation: stage3-cloud-drift-${uid}-${i} ${cloud.duration}s linear infinite;
      animation-delay: ${cloud.delay}s;
      animation-play-state: ${paused ? 'paused' : 'running'};
    }
    @media (prefers-reduced-motion: reduce) {
      .stage3-clouds-${uid} .cloud-${i} {
        animation: none;
        transform: translateX(50%);
        opacity: ${cloud.peakOpacity};
      }
    }
  `).join('\n');

  return (
    <div
      className={`stage3-clouds-${uid} absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style>{keyframesCSS}</style>
      {CLOUDS.map((_, i) => (
        <div
          key={i}
          className={`cloud-${i} absolute rounded-full`}
          style={{ background: 'var(--stage3-mist)', filter: 'blur(18px)' }}
        />
      ))}
    </div>
  );
};
