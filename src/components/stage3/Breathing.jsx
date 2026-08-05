import { useId } from 'react';

/*
 * Stage 3 — Breathing (MLT-3A-08, 09, 10)
 *
 * The breathing visual foundation from docs/stage-3-design-proposal.md §5
 * and docs/stage-3-implementation-blueprint.md §6 — a visual and timing
 * component only. No Session Engine, no audio, no persisted progress, no
 * connection to recommendations, emotions, or Supabase.
 *
 * PROPS
 *   inhaleSeconds   number, default 4.
 *   exhaleSeconds   number, default 6. Together these define one 10s
 *                   cycle at the design proposal's base rhythm.
 *   size            number | string, default 96. Applied to the orb's
 *                   wrapper box (the halo renders slightly larger inside
 *                   the same box, never overflowing it).
 *   active          boolean, default true. See TIMING below.
 *   showLabel       boolean, default true.
 *   inhaleLabel     string, default 'Breathe in'.
 *   exhaleLabel     string, default 'Breathe out'.
 *   theme           'moonlight' | 'dawn', default 'moonlight'.
 *   decorative      boolean, default true. See ACCESSIBILITY below.
 *   label           optional string. Only meaningful when
 *                   decorative={false} — see ACCESSIBILITY below.
 *   className       optional extra classes on the outer wrapper.
 *
 * TIMING (no timer of any kind — see the code comment above
 * `keyframesCSS` for the full explanation)
 *   inhaleSeconds/exhaleSeconds are used exactly once per render to
 *   compute a keyframe percentage split (e.g. 4s/6s -> 40%/60% of a 10s
 *   cycle) and a total `animation-duration`. Both are baked into a
 *   scoped <style> tag (unique per instance via useId, same pattern as
 *   Gradient.jsx/Moon.jsx) and handed entirely to native CSS
 *   `@keyframes` + `animation-iteration-count: infinite`. There is no
 *   setInterval, no requestAnimationFrame, and no React state that
 *   changes over time — the only JS work is the one-time percentage
 *   arithmetic during render.
 *
 *   When active is false, `animation-play-state: paused` cleanly freezes
 *   every layer (orb, halo, labels) wherever they are — for a component
 *   that mounts with active={false} from the start, that's deterministically
 *   the 0% keyframe: smallest, softest, calm resting state.
 *
 * LABEL SYNCHRONISATION
 *   Both label strings are always present in the DOM as two stacked
 *   elements; only their opacity cross-fades, driven by their own
 *   `@keyframes` using the same percentage split and duration as the orb
 *   — so "Breathe in" is visible for the inhale portion of the cycle and
 *   "Breathe out" for the exhale portion, purely via CSS, perfectly
 *   locked to the visual animation because they share one clock (the
 *   single `animation-duration`), not two independently-timed ones.
 *
 * REDUCED MOTION
 *   The orb's scale animation is disabled entirely (`animation: none`,
 *   a fixed resting transform). The halo swaps to a dedicated
 *   opacity-only keyframe set (its normal keyframes also scale, so simply
 *   leaving its animation running was not sufficient) — satisfying
 *   "preserve pacing using a slow opacity/glow pulse" without any scale
 *   movement anywhere in the component. Labels are unaffected (a text
 *   cross-fade is a content change, not
 *   motion in the vestibular sense reduced-motion guards against) so
 *   their timing meaning is fully retained either way.
 *
 * ACCESSIBILITY
 *   decorative=true (default): aria-hidden="true", not focusable. The two
 *   visible label elements are themselves always aria-hidden (they cross-
 *   fade continuously, which would be a disruptive, repeating
 *   announcement if exposed to assistive tech). decorative=false instead
 *   exposes exactly one *stable* aria-label on the root — describing the
 *   exercise once ("Breathing guide, 4 second inhale, 6 second exhale")
 *   rather than oscillating between "Breathe in"/"Breathe out" every few
 *   seconds, which is what "a stable, non-disruptive accessibility
 *   approach" means here: the accessible name never changes, so it's
 *   never re-announced on a loop.
 *
 * TOKENS
 *   Only --stage3-moonlight, --stage3-dawn, --stage3-mist, --stage3-dusk,
 *   --stage3-ink are used, per this ticket's scope.
 */

const THEME_TOKENS = {
  moonlight: { core: 'var(--stage3-moonlight)', halo: 'var(--stage3-moonlight)' },
  dawn: { core: 'var(--stage3-dawn)', halo: 'var(--stage3-dawn)' },
};

export const Breathing = ({
  inhaleSeconds = 4,
  exhaleSeconds = 6,
  size = 96,
  active = true,
  showLabel = true,
  inhaleLabel = 'Breathe in',
  exhaleLabel = 'Breathe out',
  theme = 'moonlight',
  decorative = true,
  label,
  className = '',
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const tokens = THEME_TOKENS[theme] ?? THEME_TOKENS.moonlight;

  const total = Math.max(0.1, inhaleSeconds + exhaleSeconds);
  const inhalePct = (inhaleSeconds / total) * 100;
  const buffer = 3; // % of cycle, a gentle label cross-fade rather than a hard cut
  const inStart = Math.max(0, inhalePct - buffer);
  const inEnd = Math.min(100, inhalePct + buffer);
  const outEnd = Math.max(inEnd, 100 - buffer);

  const accessibleLabel =
    label || `Breathing guide, ${inhaleSeconds} second inhale, ${exhaleSeconds} second exhale`;

  // One-time, per-render CSS string — see the TIMING doc comment above.
  const keyframesCSS = `
    @keyframes stage3-breath-core-${uid} {
      0% { transform: scale(0.72); }
      ${inhalePct}% { transform: scale(1); }
      100% { transform: scale(0.72); }
    }
    @keyframes stage3-breath-halo-${uid} {
      0% { opacity: 0.32; transform: scale(0.9); }
      ${inhalePct}% { opacity: 0.85; transform: scale(1.1); }
      100% { opacity: 0.32; transform: scale(0.9); }
    }
    /* Reduced-motion variant of the halo pulse: opacity only, no
       transform/scale at any keyframe — the normal halo keyframes above
       do include a scale change, so reduced-motion must swap to this one
       rather than merely leaving the core's animation disabled. */
    @keyframes stage3-breath-halo-reduced-${uid} {
      0% { opacity: 0.32; }
      ${inhalePct}% { opacity: 0.85; }
      100% { opacity: 0.32; }
    }
    @keyframes stage3-breath-label-in-${uid} {
      0% { opacity: 1; }
      ${inStart}% { opacity: 1; }
      ${inEnd}% { opacity: 0; }
      100% { opacity: 0; }
    }
    @keyframes stage3-breath-label-out-${uid} {
      0% { opacity: 0; }
      ${inStart}% { opacity: 0; }
      ${inEnd}% { opacity: 1; }
      ${outEnd}% { opacity: 1; }
      100% { opacity: 0; }
    }
    .stage3-breath-${uid} .core {
      background: radial-gradient(circle at 35% 30%, var(--stage3-mist), ${tokens.core} 75%);
      animation: stage3-breath-core-${uid} ${total}s ease-in-out infinite;
      animation-play-state: ${active ? 'running' : 'paused'};
    }
    .stage3-breath-${uid} .halo {
      background: radial-gradient(circle, ${tokens.halo} 0%, transparent 68%);
      animation: stage3-breath-halo-${uid} ${total}s ease-in-out infinite;
      animation-play-state: ${active ? 'running' : 'paused'};
    }
    .stage3-breath-${uid} .label-in {
      animation: stage3-breath-label-in-${uid} ${total}s ease-in-out infinite;
      animation-play-state: ${active ? 'running' : 'paused'};
    }
    .stage3-breath-${uid} .label-out {
      animation: stage3-breath-label-out-${uid} ${total}s ease-in-out infinite;
      animation-play-state: ${active ? 'running' : 'paused'};
    }
    @media (prefers-reduced-motion: reduce) {
      .stage3-breath-${uid} .core {
        animation: none;
        transform: scale(0.86);
      }
      .stage3-breath-${uid} .halo {
        animation-name: stage3-breath-halo-reduced-${uid};
        transform: none;
      }
    }
  `;

  return (
    <span className={`stage3-breath-${uid} inline-flex flex-col items-center gap-3 ${className}`}>
      <style>{keyframesCSS}</style>
      <span
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden={decorative ? 'true' : undefined}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : accessibleLabel}
      >
        <span className="halo absolute inset-0 rounded-full" />
        <span
          className="core relative rounded-full"
          style={{ width: '58%', height: '58%' }}
        />
      </span>

      {showLabel && (
        <span className="relative inline-grid" aria-hidden="true">
          <span className="label-in col-start-1 row-start-1 text-sm font-serif italic text-stage3-mist whitespace-nowrap text-center">
            {inhaleLabel}
          </span>
          <span className="label-out col-start-1 row-start-1 text-sm font-serif italic text-stage3-mist whitespace-nowrap text-center">
            {exhaleLabel}
          </span>
        </span>
      )}
    </span>
  );
};
