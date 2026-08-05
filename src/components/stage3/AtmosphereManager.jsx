/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { Gradient, PHASES, resolvePhaseFromDate } from './Gradient';

/*
 * Stage 3 — AtmosphereManager (MLT-3B-18 / MLT-3B-13/14/15, Ticket Groups 1-2)
 *
 * The Environmental Engine's orchestration root from
 * docs/stage-3-implementation-blueprint.md §2 and §6 ("Atmospheric
 * layers... Tier-gated"). Group 1 established phase detection,
 * reduced-motion detection, performance-tier detection, compositing
 * order, and extension points. Group 2 hardens the tier and
 * reduced-motion system into a gating *contract* every future layer
 * registers against — it does not add any visual layer. Gradient is
 * still the only layer actually mounted. Clouds, Stars, Mist, Rain,
 * Particles, and Aurora are not built yet; no session, celebration, or
 * audio integration exists.
 *
 * PROPS
 *   phase       optional: 'moonlight' | 'dawn' | 'daylight' | 'dusk'.
 *               Overrides automatic time resolution — same override
 *               contract as Gradient.jsx, used by Stage3Preview.jsx.
 *   tier        optional: 0 | 1 | 2 | 3. Overrides automatic device-
 *               capability detection — lets a future layer ticket (or
 *               Stage3Preview.jsx) force-test each tier without needing
 *               matching hardware, per the tiering system's own
 *               testability requirement (workbook MLT-3B-13 acceptance
 *               criteria: "any single tier can be forced for QA"). An
 *               invalid value (not 0/1/2/3) is silently ignored and
 *               automatic detection is used instead — it never throws
 *               and never produces an out-of-range tier.
 *   className   optional extra classes, forwarded to Gradient's container.
 *   children    real UI content, rendered above every atmospheric layer —
 *               the "→ UI/Components" terminal step of the compositing
 *               order below.
 *
 * PHASE DETECTION
 *   Reuses Gradient.jsx's exported `resolvePhaseFromDate`, deliberately
 *   not reimplemented here — Gradient.jsx's own doc comment names this
 *   exact export as the Phase 3B extension point. Same lightweight,
 *   low-frequency pattern as Gradient.jsx: local device hour checked once
 *   a minute, React state only updates when the resolved phase actually
 *   changes. AtmosphereManager owns the one timer for this value and
 *   passes the resolved phase down to <Gradient> as its `phase` override
 *   prop — a single source of truth and a single interval, not two
 *   components independently polling the clock. This is a plain prop, not
 *   a shared context, matching blueprint §8's "Animation state...
 *   Component-local" state-architecture rule. Phase and tier are resolved
 *   from entirely independent inputs (clock vs. device/override) — a
 *   phase change never alters tier, and a tier change never alters phase.
 *
 * REDUCED-MOTION DETECTION
 *   Same `matchMedia('(prefers-reduced-motion: reduce)')` listener
 *   pattern already used independently in Gradient.jsx, Moon.jsx, and
 *   Breathing.jsx — duplicated locally here rather than extracted to a
 *   shared hook, consistent with those three components' own precedent of
 *   each computing its inputs independently rather than depending on a
 *   shared provider.
 *
 * PERFORMANCE-TIER CONTRACT
 *   Tier 0 — Gradient only. Mandatory fallback, correct on every device.
 *            Forced whenever `prefers-reduced-motion: reduce` is active,
 *            regardless of device capability or any override.
 *   Tier 1 — Tier 0 + Clouds/Stars. The default target: what a normal,
 *            unknown-capability device gets, including whenever
 *            `hardwareConcurrency` or `deviceMemory` is unavailable.
 *   Tier 2 — Tier 1 + Mist/Rain/Particles. Mid-tier-and-above devices only.
 *   Tier 3 — Tier 2 + Aurora. Highest-capability devices only. Tier 3
 *            only ever grants *permission* to mount Aurora — it does not
 *            make Aurora appear. Aurora also requires a valid celebration
 *            trigger (Phase 3E, not built yet), so at Tier 3 today Aurora
 *            still correctly renders nothing.
 *   This asymmetry — tier as a ceiling, never a trigger — applies to
 *   every future conditional layer, not just Aurora: a layer needs both
 *   "the tier permits it" AND "its own real trigger condition is true"
 *   before it may mount. See LAYER-GATING CONTRACT below.
 *
 * DEVICE-CAPABILITY HEURISTIC
 *   `resolvePerformanceTier({ hardwareConcurrency, deviceMemory })` is a
 *   pure function (exported below) so its exact thresholds can be
 *   verified directly, without mocking `navigator` — mirroring how
 *   Gradient.jsx's `resolvePhaseFromDate` takes a `Date` rather than
 *   reading `new Date()` internally. `detectDeviceTier()` is the only
 *   thing that actually reads `navigator`, once, on mount (via a lazy
 *   `useState` initializer — never a timer, never re-evaluated).
 *
 *   Thresholds (predictable over clever, deliberately coarse):
 *     - `hardwareConcurrency` or `deviceMemory` undefined -> Tier 1.
 *       `deviceMemory` is Chrome/Edge-only (undefined on Safari and
 *       Firefox) — an unsupported API is never treated as evidence of
 *       either high or low capability, only as "unknown", which resolves
 *       to the same Tier 1 as a genuinely mid/unknown device.
 *     - cores >= 6 AND memory >= 6 (GB) -> Tier 3.
 *     - cores >= 4 AND memory >= 4 (GB) -> Tier 2.
 *     - anything else (both APIs present, below those floors) -> Tier 1.
 *   Tier 0 is never a heuristic outcome — it is reserved exclusively for
 *   the reduced-motion override, applied by the caller, not by this
 *   function. This function answers "how capable is this device", not
 *   "should motion play right now."
 *
 * REDUCED-MOTION PRECEDENCE
 *   Exactly three inputs feed the effective tier, evaluated in this
 *   fixed order — each one fully decides the outcome before the next is
 *   even considered:
 *     1. prefers-reduced-motion  — if active, effective tier is 0. Final.
 *     2. explicit `tier` override — used only if reduced motion is off.
 *     3. device capability        — used only if neither of the above applies.
 *   Reduced motion always wins. A `tier={3}` override cannot bypass it —
 *   there is no code path in which reduced motion is active and the
 *   resolved tier is non-zero.
 *
 * COMPOSITING ORDER
 *   Fixed by docs/stage-3-implementation-blueprint.md §2.3:
 *     Gradient → Clouds → Stars → Mist/Rain → Aurora → Particles → UI
 *   Reproduced below as the exported LAYER_ORDER constant and mirrored by
 *   the ordered (currently empty) slot comments in the render output, so
 *   later tickets have one already-agreed place to add each layer rather
 *   than re-deriving the order.
 *
 * LAYER-GATING CONTRACT
 *   `canRenderTier(currentTier, requiredTier)` — deliberately just an
 *   inequality (`currentTier >= requiredTier`), not a registry, plugin
 *   system, or event bus. A future layer ticket checks this once before
 *   mounting; it grants permission only, never activation (see
 *   PERFORMANCE-TIER CONTRACT above). The six commented slots below show
 *   the exact call each future layer will make.
 *
 * VISIBILITY / BACKGROUND HANDLING — deliberately deferred, not built
 *   Inspected for this ticket group and intentionally not implemented.
 *   The only timer that exists anywhere in AtmosphereManager today is the
 *   60-second phase check, which is already cheap enough (a single date
 *   comparison once a minute) that pausing it in the background would
 *   save nothing measurable — adding a `document.visibilitychange`
 *   listener now would be state with no consumer, which this ticket
 *   group's own instructions rule out ("do not add animation logic yet").
 *   Visibility handling belongs with the first continuously-animating
 *   layer (most likely Clouds, per the recommended implementation order)
 *   where a real, continuous CSS/JS animation actually needs to pause
 *   when the tab is backgrounded (risk R-03, battery). Revisit there, not
 *   here.
 *
 * EXTENSION POINTS
 *   `resolvedPhase`, `reducedMotion`, and `tier` are computed once here
 *   and are the values every future layer ticket will need — a later
 *   ticket adds a layer by importing it directly into this file and
 *   passing it these already-computed values as props, in the slot that
 *   matches its position in LAYER_ORDER, guarded by `canRenderTier`. This
 *   file does not export a context or a public setter for any of the
 *   three; nothing outside AtmosphereManager needs them yet.
 */

export const LAYER_ORDER = ['gradient', 'clouds', 'stars', 'mist', 'rain', 'aurora', 'particles'];

const TIERS = [0, 1, 2, 3];

const CHECK_INTERVAL_MS = 60 * 1000; // matches Gradient.jsx's own low-frequency check

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

// Pure — see DEVICE-CAPABILITY HEURISTIC above for the exact thresholds
// and rationale. Never returns 0; reduced motion is applied by the caller.
export const resolvePerformanceTier = ({ hardwareConcurrency, deviceMemory } = {}) => {
  if (hardwareConcurrency === undefined || deviceMemory === undefined) return 1;
  if (hardwareConcurrency >= 6 && deviceMemory >= 6) return 3;
  if (hardwareConcurrency >= 4 && deviceMemory >= 4) return 2;
  return 1;
};

// The only thing that actually reads `navigator` — once, on mount, via a
// lazy useState initializer below. Never a timer, never re-evaluated.
const detectDeviceTier = () => {
  if (typeof navigator === 'undefined') return 1;
  return resolvePerformanceTier({
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
  });
};

// Layer-gating contract — see LAYER-GATING CONTRACT above. A future layer
// checks canRenderTier(tier, N) before mounting; it never forces one on.
export const canRenderTier = (currentTier, requiredTier) => currentTier >= requiredTier;

export const AtmosphereManager = ({
  phase: phaseOverride,
  tier: tierOverride,
  className = '',
  children,
}) => {
  const [autoPhase, setAutoPhase] = useState(() => resolvePhaseFromDate(new Date()));
  const [deviceTier] = useState(detectDeviceTier);
  const reducedMotion = usePrefersReducedMotion();

  const isPhaseOverridden = phaseOverride && PHASES.includes(phaseOverride);
  const resolvedPhase = isPhaseOverridden ? phaseOverride : autoPhase;

  useEffect(() => {
    if (isPhaseOverridden) return; // preview override active — automatic timer not needed

    const id = setInterval(() => {
      setAutoPhase((current) => {
        const next = resolvePhaseFromDate(new Date());
        return next === current ? current : next; // state only changes on a real phase change
      });
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isPhaseOverridden]);

  // Invalid override values (not exactly 0/1/2/3 — undefined, a typo'd
  // string, an out-of-range number) are simply not "included", so this
  // falls back to automatic detection rather than throwing or clamping.
  const isTierOverridden = TIERS.includes(tierOverride);

  // Precedence, in this fixed order — see REDUCED-MOTION PRECEDENCE
  // above: (1) reduced motion always wins, full stop; (2) the explicit
  // override, only considered when reduced motion is off; (3) automatic
  // device detection, the fallback when neither of the above applies.
  const tier = reducedMotion ? 0 : (isTierOverridden ? tierOverride : deviceTier);

  return (
    // `display: contents` — a plain DOM carrier for the two data
    // attributes below that takes no part in layout itself. Gradient.jsx
    // doesn't spread arbitrary props onto its own root (and isn't
    // modified here, per this ticket group's scope), so the resolved
    // values are surfaced one level up instead — purely so a QA pass or
    // DevTools inspection can confirm what resolved and why, without
    // needing to read component internals.
    <div className="contents" data-atmosphere-tier={tier} data-atmosphere-reduced-motion={reducedMotion}>
      <Gradient phase={resolvedPhase} className={className}>
        {/* Compositing order (blueprint §2.3) — reserved slots, ordered.
            Ticket Group 2 mounts none of them; Gradient (above, via the
            <Gradient> this is nested inside) is the only rendered layer.
            Each future layer's own mount condition will be
            `canRenderTier(tier, N) && <its own real trigger>` — tier
            alone only ever grants permission, per PERFORMANCE-TIER
            CONTRACT above. */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Tier 1 — Clouds slot (Daylight/Dusk only). Gate: canRenderTier(tier, 1). Not yet built. */}
          {/* Tier 1 — Stars slot (Moonlight only). Gate: canRenderTier(tier, 1). Not yet built. */}
          {/* Tier 2 — Mist slot (session-specific, overwhelmed sessions). Gate: canRenderTier(tier, 2). Not yet built. */}
          {/* Tier 2 — Rain slot (session-specific, anxiety/stress sessions). Gate: canRenderTier(tier, 2). Not yet built. */}
          {/* Tier 3 — Aurora slot (celebration-only, Moonlight window). Gate: canRenderTier(tier, 3) && celebrationActive. Not yet built. */}
          {/* Tier 2 — Particles slot (event-triggered: breath/gratitude/celebration). Gate: canRenderTier(tier, 2) && eventActive. Not yet built. */}
        </div>

        {children}
      </Gradient>
    </div>
  );
};
