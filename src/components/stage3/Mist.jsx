import { useId } from 'react';

/*
 * Stage 3 — Mist (MLT-3B-05, Ticket Group 4)
 *
 * The session-specific atmospheric layer from
 * docs/stage-3-implementation-blueprint.md §2.2 — "low-opacity horizontal
 * fog band, soft edges, no motion beyond a very slow drift... never
 * ambient/everyday." Presence, not spectacle: this is the most restrained
 * layer in the stack so far (0.03–0.08 opacity, barely perceptible).
 *
 * MOUNTING
 *   This component has no awareness of tier or triggers —
 *   AtmosphereManager decides when to mount it
 *   (canRenderTier(tier, 2) && mistActive, per its own MOUNTED LAYERS doc
 *   comment). The Session Engine (Phase 3C) that would set `mistActive`
 *   for real doesn't exist yet — see that same comment for the stub.
 *
 * IMPLEMENTATION
 *   Exactly 3 bands, positions/durations/opacities fixed in MIST_BANDS
 *   below — no Math.random(), so the field never changes between renders
 *   or reloads. Each band is a soft-edged CSS gradient strip (a plain
 *   `linear-gradient` fade, not a `filter: blur` — blur is explicitly out
 *   of scope for this layer per this ticket's performance requirement)
 *   gently swaying via a `translateX`/`translateY` @keyframes animation —
 *   a small side-to-side sway plus a few pixels of vertical drift, never
 *   a full screen crossing the way Clouds does, which is what keeps this
 *   feeling like "presence" rather than a moving object. Transform and
 *   opacity only. No canvas, no requestAnimationFrame, no animation
 *   library, no new dependency. Same useId-scoped <style> pattern as
 *   every other Stage 3 visual component.
 *
 * PROPS
 *   active      boolean, default true. Whether the mist is visually on —
 *               distinct from whether it's mounted at all (that's
 *               AtmosphereManager's job). When false, bands render at
 *               opacity 0 with animation paused, so a demo can compare
 *               "mounted and active" against "mounted and inactive" side
 *               by side without an unmount/remount flicker. In the real,
 *               integrated path this is always true — AtmosphereManager
 *               only mounts Mist once `mistActive` is already true, so
 *               this prop mainly exists for Stage3Preview.jsx's
 *               standalone demo panels.
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
 *   This internal `@media` fallback exists purely in case Mist is ever
 *   rendered standalone outside AtmosphereManager (as it is in
 *   Stage3Preview.jsx's own demo panels) — it freezes each band at a
 *   static, visible mid-sway position rather than animating.
 *
 * ACCESSIBILITY
 *   `aria-hidden="true"` and `pointer-events-none` on the root — purely
 *   decorative, no focusable elements, no semantic content.
 */

// Fixed, deterministic — never Math.random(). duration deliberately much
// slower than Clouds' crossing (this is a sway in place, not a
// traversal); peakOpacity within this ticket's 0.03–0.08 range;
// verticalPx is the "optional vertical movement of only a few pixels".
const MIST_BANDS = [
  { top: 22, height: 60, duration: 220, delay: -30, peakOpacity: 0.05, verticalPx: 4 },
  { top: 50, height: 70, duration: 260, delay: -140, peakOpacity: 0.07, verticalPx: 6 },
  { top: 74, height: 50, duration: 190, delay: -80, peakOpacity: 0.03, verticalPx: 3 },
];

export const Mist = ({ active = true, paused = false, className = '' }) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const keyframesCSS = MIST_BANDS.map((band, i) => `
    @keyframes stage3-mist-sway-${uid}-${i} {
      0%, 100% { transform: translateX(-2%) translateY(0px); opacity: ${active ? band.peakOpacity * 0.6 : 0}; }
      50% { transform: translateX(2%) translateY(${band.verticalPx}px); opacity: ${active ? band.peakOpacity : 0}; }
    }
    .stage3-mist-${uid} .band-${i} {
      top: ${band.top}%;
      height: ${band.height}px;
      animation: stage3-mist-sway-${uid}-${i} ${band.duration}s ease-in-out infinite;
      animation-delay: ${band.delay}s;
      animation-play-state: ${active && !paused ? 'running' : 'paused'};
      opacity: ${active ? band.peakOpacity : 0};
    }
    @media (prefers-reduced-motion: reduce) {
      .stage3-mist-${uid} .band-${i} {
        animation: none;
        transform: none;
        opacity: ${active ? band.peakOpacity : 0};
      }
    }
  `).join('\n');

  return (
    <div
      className={`stage3-mist-${uid} absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style>{keyframesCSS}</style>
      {MIST_BANDS.map((_, i) => (
        <div
          key={i}
          className={`band-${i} absolute`}
          style={{
            left: '-5%',
            width: '110%',
            background: 'linear-gradient(to bottom, transparent, var(--stage3-mist) 50%, transparent)',
          }}
        />
      ))}
    </div>
  );
};
