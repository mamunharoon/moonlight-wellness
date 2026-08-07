/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { Gradient, PHASES, resolvePhaseFromDate } from './Gradient';
import { Clouds } from './Clouds';
import { Stars } from './Stars';
import { Mist } from './Mist';
import { Rain } from './Rain';
import { Aurora } from './Aurora';
import { Particles } from './Particles';
import { getReducedMotionPreference } from '../../lib/reducedMotionPreference';

/*
 * Stage 3 — AtmosphereManager (MLT-3B-18 / MLT-3B-13/14/15 / MLT-3B-01/03 / MLT-3B-05/06/07 / MLT-3B-11/12, Ticket Groups 1-6)
 *
 * The Environmental Engine's orchestration root from
 * docs/stage-3-implementation-blueprint.md §2 and §6 ("Atmospheric
 * layers... Tier-gated"). Group 1 established phase detection,
 * reduced-motion detection, performance-tier detection, compositing
 * order, and extension points. Group 2 hardened the tier and
 * reduced-motion system into a gating contract. Group 3 mounted the
 * first two conditional layers — Clouds (Daylight/Dusk) and Stars
 * (Moonlight). Group 4 mounted Mist and Rain, gated by tier plus a stub
 * session trigger. Group 5 mounted Particles, gated by tier plus an
 * explicit event request — the only layer whose mount condition also
 * checked reduced-motion and document-visibility directly (see MOUNTED
 * LAYERS below), since a one-shot event should never start firing while
 * hidden or motion-reduced, not just render paused. Group 6 mounts
 * Aurora — the most restricted layer, gated by tier plus phase plus an
 * explicit `auroraActive` trigger, and (like Particles) also checking
 * reduced-motion and document-visibility directly. Gradient, Clouds,
 * Stars, Mist, Rain, Particles, and Aurora are now the only layers
 * mounted. No celebration, session, or audio integration exists yet —
 * Stage3Preview.jsx's manual overrides are Particles' and Aurora's only
 * caller.
 *
 * PROPS
 *   phase              optional: 'moonlight' | 'dawn' | 'daylight' | 'dusk'.
 *                      Overrides automatic time resolution — same override
 *                      contract as Gradient.jsx, used by Stage3Preview.jsx.
 *   tier               optional: 0 | 1 | 2 | 3. Overrides automatic device-
 *                      capability detection — lets a future layer ticket (or
 *                      Stage3Preview.jsx) force-test each tier without needing
 *                      matching hardware, per the tiering system's own
 *                      testability requirement (workbook MLT-3B-13 acceptance
 *                      criteria: "any single tier can be forced for QA"). An
 *                      invalid value (not 0/1/2/3) is silently ignored and
 *                      automatic detection is used instead — it never throws
 *                      and never produces an out-of-range tier.
 *   mistActive         optional boolean, default false. Stub extension point
 *                      for the Session Engine (Phase 3C, not built) — the real
 *                      trigger will be "an overwhelmed-support session is
 *                      active" (blueprint §2.2). Stage3Preview.jsx overrides
 *                      this manually for QA; nothing else sets it yet.
 *   rainActive         optional boolean, default false. Same stub pattern —
 *                      the real trigger will be "an anxiety/stress support
 *                      session is active" (blueprint §2.2).
 *   particleEventType  optional: 'breath-cycle' | 'gratitude-save' |
 *                      'celebration' | null (default null). Stub extension
 *                      point — the real callers (Session Engine breath
 *                      cycles, Gratitude flow saves, Celebration Engine
 *                      blooms) don't exist yet. null means no event is
 *                      requested, regardless of tier.
 *   particleTriggerKey optional string | number, default 0. Changing this
 *                      while `particleEventType` is set replays that event
 *                      — see Particles.jsx's own REPLAY SEMANTICS.
 *   auroraActive       optional boolean, default false. Stub extension
 *                      point for a future Celebration/Session Engine —
 *                      the real trigger will eventually be celebration
 *                      completion, milestone acknowledgement, deep
 *                      reflection, or a special evening moment (none of
 *                      those systems exist yet). Stage3Preview.jsx
 *                      overrides this manually for QA; nothing else sets
 *                      it yet. Tier permission alone and Moonlight phase
 *                      alone must never activate Aurora — see MOUNTED
 *                      LAYERS below.
 *   className          optional extra classes, forwarded to Gradient's container.
 *   children           real UI content, rendered above every atmospheric layer —
 *                      the "→ UI/Components" terminal step of the compositing
 *                      order below.
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
 *            make Aurora appear. Aurora also requires Moonlight phase and
 *            an explicit `auroraActive` trigger (see MOUNTED LAYERS
 *            below), so at Tier 3 today Aurora still renders nothing
 *            unless Stage3Preview.jsx's manual override is on.
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
 *     Gradient → Clouds → Stars → Mist/Rain → Particles → Aurora → UI
 *   Reproduced below as the exported LAYER_ORDER constant and mirrored by
 *   the render output — Clouds, Stars, Mist, Rain, Particles, and Aurora
 *   now mount in this order (see MOUNTED LAYERS below).
 *
 * LAYER-GATING CONTRACT
 *   `canRenderTier(currentTier, requiredTier)` — deliberately just an
 *   inequality (`currentTier >= requiredTier`), not a registry, plugin
 *   system, or event bus. Grants permission only, never activation (see
 *   PERFORMANCE-TIER CONTRACT above) — every mounted layer below is
 *   gated by `canRenderTier(tier, N) && <some other real condition>`,
 *   both required, neither sufficient alone.
 *
 * MOUNTED LAYERS
 *   Clouds (Group 3) — canRenderTier(tier, 1) AND resolvedPhase is
 *   'daylight' or 'dusk'. Stars (Group 3) — canRenderTier(tier, 1) AND
 *   resolvedPhase is 'moonlight'. Mist (Group 4) — canRenderTier(tier, 2)
 *   AND mistActive. Rain (Group 4) — canRenderTier(tier, 2) AND
 *   rainActive. Particles (Group 5) — canRenderTier(tier, 2) AND
 *   particleEventType is set AND !reducedMotion AND !documentHidden.
 *   Aurora (Group 6) — canRenderTier(tier, 3) AND resolvedPhase ===
 *   'moonlight' AND auroraActive AND !reducedMotion AND !documentHidden —
 *   three independent conditions are all required (tier permission,
 *   Moonlight phase, and the explicit trigger); tier alone never
 *   activates it, and Moonlight phase alone never activates it either.
 *   Particles and Aurora are the only two layers whose mount condition
 *   checks reduced-motion and visibility explicitly (the other three are
 *   technically redundant with the tier-0/paused-prop mechanisms already
 *   in place, kept anyway per this ticket's explicit instruction, since a
 *   one-shot or highest-cost layer should never start the instant a
 *   hidden tab regains focus). None of the six components check phase,
 *   tier, or their own active/event props themselves — see each file's
 *   own doc comment. All are plain conditional React mounts, not
 *   cross-faded in/out — the lowest-cost implementation; a future ticket
 *   may revisit this if a transition reads as too abrupt in practice.
 *
 * VISIBILITY / BACKGROUND HANDLING
 *   Group 1/2 deliberately deferred this until "the first
 *   continuously-animating layer" existed. That layer was Clouds, so
 *   Group 3 added exactly one `document.visibilitychange` listener here,
 *   exposing `documentHidden`. Group 4 reused that same listener and
 *   state (no second one created) and extended the `paused` prop to Mist
 *   and Rain as well. Group 5 reused it a third time — Particles both
 *   receives `paused` (for the standalone-preview path) and has
 *   `documentHidden` folded directly into its own mount condition (for
 *   the real, integrated path). Group 6 reuses it a fourth time — Aurora
 *   has the same dual pattern as Particles (`paused` prop plus
 *   `documentHidden` folded into its own mount condition) — still exactly
 *   one listener in the whole file. Stars' cheap opacity-only twinkle
 *   still does not receive `paused` (see Stars.jsx's own doc comment).
 *
 * EXTENSION POINTS
 *   `resolvedPhase`, `reducedMotion`, and `tier` are computed once here
 *   and are the values every future layer ticket will need — a later
 *   ticket adds a layer by importing it directly into this file and
 *   passing it these already-computed values as props, in the slot that
 *   matches its position in LAYER_ORDER, guarded by `canRenderTier`. This
 *   file does not export a context or a public setter for any of them;
 *   nothing outside AtmosphereManager needs them yet.
 */

export const LAYER_ORDER = ['gradient', 'clouds', 'stars', 'mist', 'rain', 'particles', 'aurora'];

const TIERS = [0, 1, 2, 3];

const CHECK_INTERVAL_MS = 60 * 1000; // matches Gradient.jsx's own low-frequency check

// Settings & Profile Polish, Sprint 1: OR'd with getReducedMotionPreference()
// so a user's manual "Reduced motion" toggle (Settings > Experience) forces
// this true even when the OS-level media query doesn't request it. The OS
// query remains the live-updating source (its own change listener still
// only watches that query) — the manual preference is read fresh on every
// evaluation instead, which is sufficient since it only ever changes via a
// full navigation to/from Settings, never while this hook is already mounted
// and idle.
const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || getReducedMotionPreference()
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches || getReducedMotionPreference());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
};

// Added in Ticket Group 3 alongside Clouds, the first continuously-
// animating layer — see VISIBILITY / BACKGROUND HANDLING above for why
// this wasn't added in Group 1/2. Passed only to Clouds, not Stars.
const useDocumentHidden = () => {
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return hidden;
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
  mistActive = false,
  rainActive = false,
  particleEventType = null,
  particleTriggerKey = 0,
  auroraActive = false,
  className = '',
  children,
}) => {
  const [autoPhase, setAutoPhase] = useState(() => resolvePhaseFromDate(new Date()));
  const [deviceTier] = useState(detectDeviceTier);
  const reducedMotion = usePrefersReducedMotion();
  const documentHidden = useDocumentHidden();

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

  const cloudsActive = canRenderTier(tier, 1) && (resolvedPhase === 'daylight' || resolvedPhase === 'dusk');
  const starsActive = canRenderTier(tier, 1) && resolvedPhase === 'moonlight';
  const mistGateActive = canRenderTier(tier, 2) && mistActive;
  const rainGateActive = canRenderTier(tier, 2) && rainActive;
  // Particles and Aurora are the only gates that also check reduced-
  // motion/visibility directly — see MOUNTED LAYERS above for why. Aurora's
  // three independent conditions are all required: tier permission,
  // Moonlight phase, and the explicit auroraActive trigger — neither tier
  // nor phase alone is ever sufficient.
  const particlesGateActive = canRenderTier(tier, 2) && particleEventType !== null && !reducedMotion && !documentHidden;
  const auroraGateActive = canRenderTier(tier, 3) && resolvedPhase === 'moonlight' && auroraActive && !reducedMotion && !documentHidden;

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
        {/* Compositing order (blueprint §2.3). Clouds, Stars, Mist, Rain,
            Particles, and Aurora are all real, gated mounts — see MOUNTED
            LAYERS above. */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {cloudsActive && <Clouds paused={documentHidden} />}
          {starsActive && <Stars />}
          {mistGateActive && <Mist active={mistActive} paused={documentHidden} />}
          {rainGateActive && <Rain active={rainActive} paused={documentHidden} />}
          {particlesGateActive && (
            <Particles eventType={particleEventType} triggerKey={particleTriggerKey} paused={documentHidden} />
          )}
          {auroraGateActive && <Aurora active={auroraActive} paused={documentHidden} />}
        </div>

        {children}
      </Gradient>
    </div>
  );
};
