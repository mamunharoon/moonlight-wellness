import { useId } from 'react';

/*
 * Stage 3 — Moon (MLT-3A-06 / MLT-3A-07)
 *
 * The primary Moonlight visual anchor from docs/stage-3-design-proposal.md
 * and docs/stage-3-implementation-blueprint.md §6 — a calm, atmospheric
 * disc, not a progress meter, streak indicator, badge, notification icon,
 * or avatar. `phase` is purely decorative/externally supplied; nothing
 * here reads app usage, Supabase, or the (not-yet-built) Emotional Engine.
 *
 * PROPS
 *   size        number | string, default 96. Applied directly as the
 *               SVG's width/height.
 *   phase       'full' | 'waxing' | 'waning' | 'crescent', default 'full'.
 *   glow        'soft' | 'medium' | 'strong', default 'medium'.
 *   animated    boolean, default false. See ANIMATION below.
 *   decorative  boolean, default true. See ACCESSIBILITY below.
 *   label       optional string. Only meaningful when decorative={false};
 *               defaults to a phase-derived label ("Full moon", etc.) so
 *               the accessible name never depends on the shape alone.
 *   className   optional extra classes on the outer wrapper.
 *
 * PHASE RENDERING
 *   Two overlapping SVG circles (a lit disc, a shadow disc offset along
 *   x) — the classic, cheap technique for a stylised phase silhouette.
 *   This is a decorative approximation, not a real lunar-phase
 *   calculation, per this ticket's scope. The shadow disc's edge carries
 *   a small, fixed Gaussian blur (stdDeviation 2.2, applied only to that
 *   one shadow circle, not the whole graphic) purely to soften the
 *   terminator line so it reads as atmospheric rather than a hard-edged
 *   icon cutout — the only filter in this component.
 *
 * ANIMATION
 *   When animated, a single CSS @keyframes drift (translateY + a faint
 *   opacity pulse, 14s ease-in-out loop) is injected via a scoped <style>
 *   tag unique to each instance (via useId) — no interval, no
 *   requestAnimationFrame, no per-frame JS. Under
 *   prefers-reduced-motion: reduce, the animation is disabled entirely
 *   (movement removed) while the glow and phase shape — the full visual
 *   meaning — are unaffected, rendering a static Moon.
 *
 * ACCESSIBILITY
 *   decorative=true (default): wrapped in aria-hidden="true", not
 *   focusable, no role. decorative=false: rendered with role="img" and an
 *   aria-label carrying the phase in words (never relying on the shape
 *   alone to convey it).
 *
 * TOKENS
 *   Only --stage3-ink, --stage3-dusk, --stage3-moonlight, --stage3-mist
 *   are used, per this ticket's scope — no Dawn/Ember, no new colours.
 */

const GLOW_LEVELS = {
  soft: { radius: 44, opacity: 0.14 },
  medium: { radius: 56, opacity: 0.2 },
  strong: { radius: 70, opacity: 0.28 },
};

// Shadow-disc x-offset per phase, in the 0-100 viewBox (lit disc r=32,
// centred at 50,50). Smaller offsets cover more of the lit disc (thinner
// crescent); larger offsets uncover more of it (fuller gibbous). A
// decorative approximation, not an astronomical calculation.
const PHASE_SHADOW_OFFSET = {
  full: null, // no shadow disc rendered at all
  waxing: -45,
  waning: 45,
  crescent: -12,
};

const PHASE_LABELS = {
  full: 'Full moon',
  waxing: 'Waxing moon',
  waning: 'Waning moon',
  crescent: 'Crescent moon',
};

export const Moon = ({
  size = 96,
  phase = 'full',
  glow = 'medium',
  animated = false,
  decorative = true,
  label,
  className = '',
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const halo = GLOW_LEVELS[glow] ?? GLOW_LEVELS.medium;
  const shadowOffset = PHASE_SHADOW_OFFSET[phase] ?? PHASE_SHADOW_OFFSET.full;
  const accessibleLabel = label || PHASE_LABELS[phase] || PHASE_LABELS.full;

  const wrapperClassName = `stage3-moon-${uid} inline-block ${className}`;

  return (
    <span className={wrapperClassName} data-animated={animated ? 'true' : 'false'}>
      <style>{`
        @keyframes stage3-moon-drift-${uid} {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-4px); opacity: 0.96; }
        }
        .stage3-moon-${uid}[data-animated="true"] {
          display: inline-block;
          animation: stage3-moon-drift-${uid} 14s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .stage3-moon-${uid}[data-animated="true"] {
            animation: none;
          }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-hidden={decorative ? 'true' : undefined}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : accessibleLabel}
        focusable="false"
      >
        <defs>
          <radialGradient id={`moon-lit-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="var(--stage3-mist)" />
            <stop offset="100%" stopColor="var(--stage3-moonlight)" />
          </radialGradient>
          <radialGradient id={`moon-halo-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--stage3-moonlight)" stopOpacity="0" />
            <stop offset="48%" stopColor="var(--stage3-moonlight)" stopOpacity="0" />
            <stop offset="70%" stopColor="var(--stage3-moonlight)" stopOpacity={halo.opacity} />
            <stop offset="100%" stopColor="var(--stage3-moonlight)" stopOpacity="0" />
          </radialGradient>
          <filter id={`moon-soften-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* Halo — a single radial gradient, no filter cost */}
        <circle cx="50" cy="50" r={halo.radius} fill={`url(#moon-halo-${uid})`} />

        {/* Lit disc */}
        <circle cx="50" cy="50" r="32" fill={`url(#moon-lit-${uid})`} />

        {/* Restrained surface texture — faint, asymmetric, not face-like */}
        <circle cx="41" cy="39" r="3.1" fill="var(--stage3-dusk)" opacity="0.16" />
        <circle cx="59" cy="54" r="2" fill="var(--stage3-dusk)" opacity="0.12" />
        <circle cx="47" cy="61" r="1.5" fill="var(--stage3-dusk)" opacity="0.1" />

        {/* Phase shadow — the one softened (blurred) element in this graphic */}
        {shadowOffset !== null && (
          <circle
            cx={50 + shadowOffset}
            cy="50"
            r="32"
            fill="var(--stage3-ink)"
            opacity="0.94"
            filter={`url(#moon-soften-${uid})`}
          />
        )}
      </svg>
    </span>
  );
};
