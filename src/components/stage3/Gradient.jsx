/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';

/*
 * Stage 3 — Gradient (MLT-3A-04 / MLT-3A-05)
 *
 * The base "colour is the clock" layer from docs/stage-3-design-proposal.md
 * §12 and docs/stage-3-implementation-blueprint.md §2.1. Resolves to one of
 * four named sky phases and cross-fades between them, driven by local
 * device time.
 *
 * PROPS
 *   phase      optional: 'moonlight' | 'dawn' | 'daylight' | 'dusk'.
 *              Overrides automatic time resolution — used by
 *              Stage3Preview.jsx so each anchor can be inspected without
 *              changing the device clock. Omit (default) for the real,
 *              automatic behaviour.
 *   className  optional extra classes on the outer container.
 *   children   optional content rendered above the gradient. A subtle
 *              legibility scrim sits between the gradient and children so
 *              overlaid text keeps adequate contrast on every phase; it is
 *              not one of the Phase 3B atmospheric layers.
 *
 * AUTOMATIC-TIME BEHAVIOUR
 *   Local device hour is checked once a minute (CHECK_INTERVAL_MS). React
 *   state only updates when the resolved phase actually changes — at most
 *   four times a day — never on every tick, so this never causes rapid or
 *   per-frame re-rendering. When `phase` is supplied, the timer doesn't
 *   run at all.
 *
 *   Scope note: this ticket resolves to one of the four *named* anchors
 *   and cross-fades on the (rare) boundary crossing — it does not yet
 *   continuously blend hues minute-by-minute *within* a window. That
 *   finer interpolation, if wanted, is a natural later extension of
 *   PHASE_GRADIENTS/resolvePhaseFromDate below, not built here.
 *
 * REDUCED-MOTION BEHAVIOUR
 *   The same cross-fade mechanism is used in both cases — only the
 *   transition duration changes. Under `prefers-reduced-motion: reduce`,
 *   the fade collapses to a near-instant swap (a "cut", not a sweep) so
 *   there is no continuous movement, while the correct phase — and all of
 *   its visual information — is still always shown.
 *
 * ACCESSIBILITY
 *   The four gradient layers are purely decorative and marked
 *   `aria-hidden="true"`; `children` render in a separate, normal
 *   (non-hidden) layer. The component renders no focusable elements, so
 *   it cannot introduce a keyboard trap.
 *
 * PHASE 3B EXTENSION POINTS
 *   `resolvePhaseFromDate` and `PHASE_WINDOWS` are exported so the
 *   Atmospheric Engine (clouds/stars/mist/rain/particles/aurora) can query
 *   the same phase logic this component uses, rather than duplicating it.
 *   `children` is the intended slot for those layers once built.
 */

export const PHASES = ['moonlight', 'dawn', 'daylight', 'dusk'];

// Each phase's gradient is composed only from the six tokens already
// frozen in docs/stage-3-design-proposal.md §12 (via src/styles/
// stage3-tokens.css) — "daylight" has no colour of its own in that
// document, only a described *behaviour* ("the quietest part of the
// gradient"), so it's composed here from the existing muted tokens rather
// than inventing an unspecified new one.
export const PHASE_GRADIENTS = {
  moonlight: 'linear-gradient(to bottom, var(--stage3-ink) 0%, var(--stage3-dusk) 55%, var(--stage3-moonlight-dim) 100%)',
  dawn: 'linear-gradient(to bottom, var(--stage3-dusk) 0%, var(--stage3-moonlight-dim) 35%, var(--stage3-dawn) 100%)',
  daylight: 'linear-gradient(to bottom, var(--stage3-dusk) 0%, var(--stage3-moonlight-dim) 50%, var(--stage3-mist-dim) 100%)',
  dusk: 'linear-gradient(to bottom, var(--stage3-mist-dim) 0%, var(--stage3-dawn) 45%, var(--stage3-ember) 70%, var(--stage3-dusk) 100%)',
};

// Local-time windows (24h, device clock). First match wins; moonlight is
// the implicit fallback for every hour not otherwise covered (20:00–05:00,
// wrapping past midnight) — matches the approximate windows in
// docs/stage-3-implementation-blueprint.md §2.1.
export const PHASE_WINDOWS = [
  { phase: 'dawn', startHour: 5, endHour: 8 },
  { phase: 'daylight', startHour: 8, endHour: 17 },
  { phase: 'dusk', startHour: 17, endHour: 20 },
];

export const resolvePhaseFromDate = (date) => {
  const hour = date.getHours() + date.getMinutes() / 60;
  const match = PHASE_WINDOWS.find((w) => hour >= w.startHour && hour < w.endHour);
  return match ? match.phase : 'moonlight';
};

const CHECK_INTERVAL_MS = 60 * 1000; // low-frequency: recheck once a minute
const FADE_MS = 4000; // atmospheric cross-fade duration
const FADE_MS_REDUCED = 300; // near-instant swap under reduced motion

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
};

export const Gradient = ({ phase: phaseOverride, className = '', children }) => {
  const [autoPhase, setAutoPhase] = useState(() => resolvePhaseFromDate(new Date()));
  const reducedMotion = usePrefersReducedMotion();

  const isOverridden = phaseOverride && PHASES.includes(phaseOverride);
  const resolvedPhase = isOverridden ? phaseOverride : autoPhase;

  useEffect(() => {
    if (isOverridden) return; // preview override active — automatic timer not needed

    const id = setInterval(() => {
      setAutoPhase((current) => {
        const next = resolvePhaseFromDate(new Date());
        return next === current ? current : next; // state only changes on a real phase change
      });
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isOverridden]);

  const fadeMs = reducedMotion ? FADE_MS_REDUCED : FADE_MS;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Decorative — the four sky layers. Always mounted, cross-faded via
          opacity so a phase change never requires transitioning between
          two different gradient strings (which CSS cannot animate
          reliably on its own). */}
      <div className="absolute inset-0" aria-hidden="true">
        {PHASES.map((p) => (
          <div
            key={p}
            className="absolute inset-0"
            style={{
              background: PHASE_GRADIENTS[p],
              opacity: resolvedPhase === p ? 1 : 0,
              transition: `opacity ${fadeMs}ms ease`,
            }}
          />
        ))}
        {/* Legibility scrim, not an atmospheric layer — keeps overlaid
            text at adequate contrast regardless of which phase is active. */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.22))' }}
        />
      </div>

      {children && <div className="relative">{children}</div>}
    </div>
  );
};
