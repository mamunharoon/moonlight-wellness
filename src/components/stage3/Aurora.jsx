import { useId } from 'react';

/*
 * Stage 3 — Aurora (MLT-3B-11/12, Ticket Group 6)
 *
 * The most restricted atmospheric layer in the stack (blueprint §2.2,
 * §2.4; workbook 3B-E5) — "a slow soft sweep of color across the upper
 * sky, reserved *exclusively* for [an explicit trigger], Moonlight window
 * only." Its value is that it does *not* appear anywhere else: design
 * principle 6 ("progress is felt, not counted") extends here to
 * "specialness is felt, not diluted." Purpose is peace, completion,
 * stillness, reflection, gratitude, emotional warmth — presence a user
 * feels more than notices, never spectacle.
 *
 * MOUNTING
 *   This component has no awareness of tier, phase, or trigger source —
 *   AtmosphereManager decides when to mount it (canRenderTier(tier, 3) &&
 *   resolvedPhase === 'moonlight' && auroraActive && !reducedMotion &&
 *   !documentHidden, per its own MOUNTED LAYERS doc comment). Like
 *   Particles, and unlike Mist/Rain, the gate checks reduced-motion and
 *   visibility directly rather than relying solely on tier-0/paused — the
 *   most premium, most expensive layer should never begin appearing the
 *   instant a hidden tab regains focus, or start life fighting a reduced-
 *   motion device that only reached Tier 3 through an override.
 *
 * IMPLEMENTATION
 *   Exactly 3 bands, positions/durations/opacities/rotations/scales fixed
 *   in AURORA_BANDS below — no Math.random(), so the field never changes
 *   between renders or reloads. Each band is a single soft-edged CSS
 *   linear-gradient strip (colour fading to transparent at both ends, the
 *   same soft-edge technique Mist uses — never `filter: blur`, which is
 *   explicitly out of scope for this layer) that drifts, rotates, and
 *   breathes via one @keyframes animation combining `translate`,
 *   `rotate`, and `scale` with `opacity` — transform and opacity only, as
 *   scoped. Timing is deliberately much slower than every other layer
 *   (130–180s per cycle, within this ticket's 90–180s range) and
 *   amplitude is minimal — a few percent of translation, a few degrees of
 *   rotation, a few percent of scale — so the motion reads as "drifting
 *   light" and "calm waves," never as an object crossing the screen the
 *   way Clouds does. No flicker, no twinkle, no particle emission — nulls
 *   out the temptation to reuse Stars' or Particles' techniques here. No
 *   canvas, no WebGL, no SVG filters, no requestAnimationFrame, no
 *   animation library, no new dependency. Same useId-scoped <style>
 *   pattern as every other Stage 3 visual component, so multiple
 *   instances (e.g. Stage3Preview.jsx's demo panels) never collide.
 *
 * COLOUR PALETTE
 *   Three bands, three colours, each fading to transparent: moonlight
 *   blue (`var(--stage3-moonlight)`, the existing token), a muted teal,
 *   and a soft lavender — deliberately desaturated, no pure white, no
 *   bright green, no saturated purple, no strong yellow. The teal and
 *   lavender are not existing `--stage3-*` tokens (tokens are out of
 *   scope for this ticket group), so they're inlined here as fixed,
 *   muted hex values chosen to sit comfortably alongside the token
 *   palette rather than compete with it.
 *
 * PROPS
 *   active      boolean, default true. Whether Aurora is visually on —
 *               distinct from whether it's mounted at all (that's
 *               AtmosphereManager's job). When false, bands render at
 *               opacity 0 with animation paused, so a demo can compare
 *               "mounted and active" against "mounted and inactive" side
 *               by side without an unmount/remount flicker. In the real,
 *               integrated path this is always true — AtmosphereManager
 *               only mounts Aurora once every gate condition, including
 *               `auroraActive`, is already satisfied.
 *   paused      boolean, default false. Set by AtmosphereManager from its
 *               existing document.visibilitychange listener (the same one
 *               introduced for Clouds — no new listener here).
 *   className   optional, forwarded to the root wrapper.
 *
 * VISIBILITY PAUSE
 *   Reuses AtmosphereManager's existing `documentHidden` state — no
 *   second `document.visibilitychange` listener is created anywhere. When
 *   hidden, `animation-play-state: paused` freezes every band exactly
 *   where it is; no work continues while backgrounded.
 *
 * REDUCED MOTION
 *   Reduced motion forces Tier 0 in AtmosphereManager, so Aurora — a
 *   Tier 3 layer — never mounts at all while `prefers-reduced-motion:
 *   reduce` is active in the real, integrated app; there is no code path
 *   where reduced motion is on and Aurora is on screen. This internal
 *   `@media` fallback exists purely as defense-in-depth, for the case
 *   where Aurora is ever rendered standalone outside AtmosphereManager's
 *   gate (as it is in Stage3Preview.jsx's own demo panels) — it freezes
 *   each band at a static, visible mid-cycle position rather than
 *   animating.
 *
 * ACCESSIBILITY
 *   `aria-hidden="true"` and `pointer-events-none` on the root — purely
 *   decorative, no focusable elements, no semantic content.
 *
 * TRIGGER CONTRACT / SESSION INTEGRATION
 *   Deliberately not connected to any real trigger — no Celebration
 *   Engine, Gratitude flow, Session Engine, or evening-moment detector
 *   exists yet. `auroraActive` (owned by AtmosphereManager, not this
 *   file, default false) is the one, narrow extension point a future
 *   ticket will drive for real — eventually from celebration completion,
 *   milestone acknowledgement, deep reflection, or a special evening
 *   moment. Stage3Preview.jsx's manual overrides are its only caller
 *   today. Tier permission alone must never activate Aurora, and Moonlight
 *   phase alone must never activate Aurora — both are necessary,
 *   neither is sufficient, and `auroraActive` is the third, independently
 *   required condition (see AtmosphereManager's own gate).
 */

// Fixed, deterministic — never Math.random(). top/left/width in % of the
// container so each band bleeds past its rotated edges; height in px, the
// same mixed-unit approach Mist uses. duration within this ticket's
// 90–180s range; peakOpacity kept low and restrained (0.06–0.10) —
// presence, not spectacle. rotation/scale ranges are deliberately small
// (a few degrees, a few percent) — minimal amplitude, per this ticket's
// explicit instruction.
const AURORA_BANDS = [
  {
    top: '4%',
    left: '-18%',
    width: 140,
    height: 260,
    duration: 150,
    delay: -35,
    peakOpacity: 0.1,
    rotation: -5,
    scaleFrom: 1,
    scaleTo: 1.06,
    gradient: 'linear-gradient(100deg, transparent 0%, var(--stage3-moonlight) 45%, transparent 85%)',
  },
  {
    top: '15%',
    left: '-22%',
    width: 150,
    height: 220,
    duration: 180,
    delay: -110,
    peakOpacity: 0.08,
    rotation: 4,
    scaleFrom: 0.96,
    scaleTo: 1.03,
    gradient: 'linear-gradient(110deg, transparent 0%, #4F9E93 40%, transparent 82%)', // muted teal
  },
  {
    top: '25%',
    left: '-16%',
    width: 145,
    height: 200,
    duration: 130,
    delay: -70,
    peakOpacity: 0.07,
    rotation: -3,
    scaleFrom: 1.03,
    scaleTo: 0.98,
    gradient: 'linear-gradient(95deg, transparent 0%, #B9A9D9 42%, transparent 84%)', // soft lavender
  },
];

export const Aurora = ({ active = true, paused = false, className = '' }) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const keyframesCSS = AURORA_BANDS.map((band, i) => `
    @keyframes stage3-aurora-drift-${uid}-${i} {
      0%, 100% {
        transform: translate(-1.5%, 0%) rotate(${band.rotation - 1}deg) scale(${band.scaleFrom});
        opacity: ${active ? band.peakOpacity * 0.5 : 0};
      }
      50% {
        transform: translate(1.5%, -1.5%) rotate(${band.rotation + 1}deg) scale(${band.scaleTo});
        opacity: ${active ? band.peakOpacity : 0};
      }
    }
    .stage3-aurora-${uid} .band-${i} {
      top: ${band.top};
      left: ${band.left};
      width: ${band.width}%;
      height: ${band.height}px;
      background: ${band.gradient};
      animation: stage3-aurora-drift-${uid}-${i} ${band.duration}s ease-in-out infinite;
      animation-delay: ${band.delay}s;
      animation-play-state: ${active && !paused ? 'running' : 'paused'};
      opacity: ${active ? band.peakOpacity : 0};
    }
    @media (prefers-reduced-motion: reduce) {
      .stage3-aurora-${uid} .band-${i} {
        animation: none;
        transform: none;
        opacity: ${active ? band.peakOpacity : 0};
      }
    }
  `).join('\n');

  return (
    <div
      className={`stage3-aurora-${uid} absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style>{keyframesCSS}</style>
      {AURORA_BANDS.map((_, i) => (
        <div key={i} className={`band-${i} absolute`} />
      ))}
    </div>
  );
};
