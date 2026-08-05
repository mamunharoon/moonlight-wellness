import { useEffect, useId, useRef } from 'react';

/*
 * Stage 3 — Particles (MLT-3B-07/08/09/10, Ticket Group 5)
 *
 * The single, shared, poolable particle engine from
 * docs/stage-3-implementation-blueprint.md §2.2 — "always event-triggered,
 * never continuously ambient." One component, three approved event types
 * (breath-cycle, gratitude-save, celebration), never a bespoke component
 * per event, per the workbook's own MLT-3B-07 rationale ("avoids three
 * bespoke particle implementations").
 *
 * MOUNTING
 *   This component has no awareness of tier, phase, or trigger source —
 *   AtmosphereManager decides when to mount it
 *   (canRenderTier(tier, 2) && particleEventType is set &&
 *   !reducedMotion && !documentHidden, per its own MOUNTED LAYERS doc
 *   comment). Nothing wires a real breath cycle, gratitude save, or
 *   celebration to it yet — Stage3Preview.jsx's manual buttons are the
 *   only caller today. See SESSION INTEGRATION below.
 *
 * WHY CSS-ONLY, NOT requestAnimationFrame
 *   A pooled, replayable, one-shot animation sounds like it might need a
 *   frame loop, but it doesn't: the browser's own CSS animation restart
 *   trick — set `animation: none`, force one synchronous reflow (read
 *   `el.offsetHeight`), then set the real `animation` shorthand back —
 *   replays a CSS animation on an *existing* DOM node without creating a
 *   new one and without any per-frame JavaScript. This runs exactly once
 *   per trigger (inside a `useEffect` keyed on `triggerKey`), not once
 *   per frame, so there is no rAF loop, no per-frame React state, and no
 *   per-frame allocation anywhere in this file. `animation-fill-mode:
 *   forwards` leaves each particle at its final (opacity: 0) keyframe
 *   when it finishes, so there's nothing to detect or clean up — an
 *   idle/finished particle is simply inert.
 *
 * POOLING
 *   A single fixed pool of PARTICLE_POOL_SIZE (20) <span> elements is
 *   rendered once and never added to or removed from — every event type
 *   reuses the same physical pool, activating only the first `count`
 *   elements it needs (breath-cycle 6, gratitude-save 5, celebration 12
 *   — the largest, still comfortably under the pool size). No
 *   Math.random() anywhere; every particle's direction, distance,
 *   timing, opacity, size, and colour is derived deterministically from
 *   (particle index, triggerKey, event type) via deriveVariation below,
 *   so the exact same trigger always produces the exact same motion.
 *
 * REPLAY SEMANTICS
 *   A ref (not state) tracks the last triggerKey actually fired. The
 *   effect below is a no-op whenever the incoming triggerKey matches
 *   that ref — repeated triggerKey values never replay. A new
 *   triggerKey (any change, not just an increment) always replays,
 *   restarting the pool's active particles from their 0% keyframe.
 *
 * PROPS
 *   eventType    'breath-cycle' | 'gratitude-save' | 'celebration' | null
 *                (default null). null means idle — no event configured,
 *                nothing can fire regardless of triggerKey.
 *   triggerKey   string | number, default 0. Changing this (while active
 *                and eventType is set) replays the event; leaving it
 *                unchanged never does, even across re-renders.
 *   active       boolean, default true. false suppresses all emission —
 *                a changed triggerKey while inactive is simply not
 *                acted on (and is not "remembered": if the same key
 *                arrives again once active, it will still fire).
 *   paused       boolean, default false. Set by AtmosphereManager from
 *                its existing document.visibilitychange state — pauses
 *                any in-flight animation and blocks new emission while
 *                true. No second visibility listener is created here.
 *   className    optional, forwarded to the root wrapper.
 *
 * VISIBILITY PAUSE
 *   Reuses AtmosphereManager's existing `documentHidden` state. In the
 *   real integrated path AtmosphereManager also gates *mounting* itself
 *   on document visibility (see its own doc comment) — the `paused`
 *   prop's in-component handling below is what actually gets exercised
 *   in Stage3Preview.jsx's standalone panels, and is retained as the
 *   defensive, always-correct behaviour regardless of how a future
 *   caller mounts this component.
 *
 * REDUCED MOTION
 *   Defensive only — AtmosphereManager already forces tier to 0 under
 *   `prefers-reduced-motion: reduce`, so in the real integrated app this
 *   component is never mounted at all while reduced motion is active.
 *   This internal `@media` fallback exists purely for standalone preview
 *   use. Because animations here are started by direct inline
 *   `el.style.animation` writes (not a static CSS class), the fallback
 *   needs `!important` to reliably win over whatever was just set inline
 *   — a deliberate, narrow use, not a general pattern in this codebase.
 *
 * ACCESSIBILITY
 *   `aria-hidden="true"` and `pointer-events-none` on the root — purely
 *   decorative, no focusable elements, no semantic text, nothing for a
 *   screen reader to announce.
 *
 * SESSION INTEGRATION
 *   Deliberately not connected to the Session Engine, Gratitude flow, or
 *   Celebration Engine — none of those exist yet. `particleEventType`/
 *   `particleTriggerKey` (owned by AtmosphereManager, not this file) are
 *   the narrow extension points a future ticket will drive for real.
 */

export const PARTICLE_POOL_SIZE = 20;

const EVENT_CONFIG = {
  'breath-cycle': {
    count: 6,
    duration: 5,
    keyframe: 'rise',
    baseDistance: 40,
    distanceJitter: 20,
    minOpacity: 0.18,
    maxOpacity: 0.34,
    baseSize: 4,
    colors: ['var(--stage3-moonlight)', 'var(--stage3-mist)'],
  },
  'gratitude-save': {
    count: 5,
    duration: 1,
    keyframe: 'burst',
    baseDistance: 18,
    distanceJitter: 10,
    minOpacity: 0.4,
    maxOpacity: 0.65,
    baseSize: 3,
    colors: ['var(--stage3-ember)', 'var(--stage3-dawn)'],
  },
  celebration: {
    count: 12,
    duration: 2.5,
    keyframe: 'radiate',
    baseDistance: 55,
    distanceJitter: 25,
    minOpacity: 0.3,
    maxOpacity: 0.5,
    baseSize: 4,
    colors: ['var(--stage3-moonlight)', 'var(--stage3-dawn)', 'var(--stage3-ember)'],
  },
};

// Deterministic — never Math.random(). The same (index, triggerKey,
// eventType) always produces the same direction/distance/timing, but
// different triggerKeys produce different-looking replays, per the
// "derive from index, triggerKey, event type" requirement.
const deriveVariation = (i, triggerKey, eventType) => {
  const config = EVENT_CONFIG[eventType];
  const keyNum = typeof triggerKey === 'number'
    ? triggerKey
    : String(triggerKey).split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const seed = i * 13 + keyNum * 7;
  const angleDeg = (seed * 37) % 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const distance = config.baseDistance + (seed % config.distanceJitter);

  const dx = Math.cos(angleRad) * distance;
  const dy = eventType === 'breath-cycle'
    ? -(config.baseDistance + (seed % 20)) // breath motes always rise
    : Math.sin(angleRad) * distance;

  return {
    dx: Math.round(dx),
    dy: Math.round(dy),
    delay: (seed % 5) * 0.08,
    peakOpacity: config.minOpacity + ((seed % 5) / 5) * (config.maxOpacity - config.minOpacity),
    size: config.baseSize + (seed % 3),
    left: 40 + (seed % 20),
    top: eventType === 'breath-cycle' ? 70 + (seed % 15) : 45 + (seed % 10),
    color: config.colors[i % config.colors.length],
  };
};

export const Particles = ({
  eventType = null,
  triggerKey = 0,
  active = true,
  paused = false,
  className = '',
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const poolRefs = useRef([]);
  const lastFiredKey = useRef(null);

  // Fires once per genuinely new triggerKey — never per frame. Mutates
  // existing pool elements' inline styles directly; no React state
  // changes here, so this never triggers a re-render of its own.
  useEffect(() => {
    if (!active || !eventType || paused) return;
    if (triggerKey === lastFiredKey.current) return; // repeated key -> no replay
    lastFiredKey.current = triggerKey;

    const config = EVENT_CONFIG[eventType];
    if (!config) return;

    poolRefs.current.forEach((el, i) => {
      if (!el) return;

      if (i >= config.count) {
        el.style.animation = 'none';
        return;
      }

      const v = deriveVariation(i, triggerKey, eventType);
      el.style.left = `${v.left}%`;
      el.style.top = `${v.top}%`;
      el.style.width = `${v.size}px`;
      el.style.height = `${v.size}px`;
      el.style.background = v.color;
      el.style.setProperty('--particle-dx', `${v.dx}px`);
      el.style.setProperty('--particle-dy', `${v.dy}px`);
      el.style.setProperty('--particle-peak', v.peakOpacity);

      // Restart trick: clear, force a reflow, then re-apply — replays
      // the animation on this same node rather than creating a new one.
      el.style.animation = 'none';
      void el.offsetHeight;
      el.style.animation = `stage3-particle-${config.keyframe}-${uid} ${config.duration}s ease-out ${v.delay}s 1 forwards`;
    });
  }, [eventType, triggerKey, active, paused, uid]);

  // Separate from the trigger effect on purpose: pausing/resuming must
  // work independently of whether a new trigger has arrived.
  useEffect(() => {
    poolRefs.current.forEach((el) => {
      if (!el || !el.style.animation || el.style.animation === 'none') return;
      el.style.animationPlayState = paused ? 'paused' : 'running';
    });
  }, [paused]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @keyframes stage3-particle-rise-${uid} {
          0% { transform: translate(0, 0) scale(0.8); opacity: 0; }
          20% { opacity: var(--particle-peak, 0.3); }
          80% { opacity: var(--particle-peak, 0.3); }
          100% { transform: translate(var(--particle-dx, 0px), var(--particle-dy, -40px)) scale(1); opacity: 0; }
        }
        @keyframes stage3-particle-burst-${uid} {
          0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
          30% { opacity: var(--particle-peak, 0.5); transform: translate(calc(var(--particle-dx, 0px) * 0.4), calc(var(--particle-dy, 0px) * 0.4)) scale(1); }
          100% { transform: translate(var(--particle-dx, 0px), var(--particle-dy, 0px)) scale(0.9); opacity: 0; }
        }
        @keyframes stage3-particle-radiate-${uid} {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          15% { opacity: var(--particle-peak, 0.4); }
          100% { transform: translate(var(--particle-dx, 0px), var(--particle-dy, 0px)) scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .stage3-particles-${uid} .particle {
            animation: none !important;
            opacity: 0 !important;
          }
        }
      `}</style>
      <div className={`stage3-particles-${uid} absolute inset-0`}>
        {Array.from({ length: PARTICLE_POOL_SIZE }, (_, i) => (
          <span
            key={i}
            ref={(el) => { poolRefs.current[i] = el; }}
            className="particle absolute rounded-full"
            style={{ opacity: 0 }}
          />
        ))}
      </div>
    </div>
  );
};
