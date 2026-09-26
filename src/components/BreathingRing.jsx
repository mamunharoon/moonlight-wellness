/*
 * Stage 4 Batch F2 — BreathingRing
 *
 * Extracted verbatim from Breathe.jsx's own inline markup (Morning
 * flow, Group 3D Batch B) — a pure extraction, not a redesign. Every
 * className, transition, and conditional below is unchanged from what
 * Breathe.jsx already rendered; only the JSX's location moved, so the
 * evening flow's own breathing screen (F6, not this batch) can reuse
 * the same visual instead of duplicating it.
 *
 * breatheState: 'Inhale' | 'Hold' | 'Exhale' — the same three states
 *   Breathe.jsx's own local state already used.
 * secondsLeft: number, displayed as "{secondsLeft}s left".
 *
 * Context-aware Meditation/Breathing theming — `journeyTone` (additive,
 * default 'primary': the original warm coral gradient/glow, byte-
 * identical to before this prop existed). Breathe.jsx passes its own
 * fixed 'morning', EveningBreathing.jsx its own fixed 'evening',
 * QuietBreathing.jsx's standalone branch its own dynamically-resolved
 * journeyTone (see usePracticeJourneyTone.js) - one shared component,
 * not three separate rings. Only the colour changes: the scale/opacity/
 * size/brightness animation timing and the breatheState/secondsLeft
 * text are completely unchanged, and every tone's own text colour
 * reuses this app's already contrast-verified `on-<accent>` pairing
 * (journeyAction.js's own primary-button text uses the identical
 * tokens), never a fresh hex value.
 *
 * WakeWise Phase 1 correction — the 'primary' tone's white label sat
 * directly on the orb's own peach gradient (#954835 -> #ff9d85). At the
 * gradient's light end that measured only ~2.02:1 (subtext at
 * text-white/60 measured worse, ~1.53:1) - both well under the 4.5:1
 * normal-text floor, and neither number is stable anyway since the
 * label's actual backdrop shifts continuously across the gradient and
 * brightens further under Hold's brightness-110 filter. Rather than
 * retune the gradient (a journey-coloured-ring redesign is explicitly
 * out of scope this phase) or pick a single text colour that can only
 * ever be tuned for one end of a two-stop gradient, `labelScrim` gives
 * the label a small opaque backing plate so its contrast is independent
 * of gradient position entirely: white text on a solid black/60 plate
 * measures >=6.88:1 against the gradient's lightest, worst-case point,
 * even after Hold's brightness-110 (white is already clamped at 255 and
 * unaffected by that filter; only the plate's own colour brightens
 * slightly, and 0.60 leaves enough headroom that it still clears 4.5:1
 * comfortably). morning/anytime/evening are untouched - their solid
 * accent fills paired with on-<accent> tokens already measure >=8.6:1
 * (>=9.3:1 under Hold), so they get no plate.
 */
const RING_TOKENS = {
  primary: {
    glow: 'bg-primary/10',
    orb: 'bg-gradient-to-br from-[#954835] to-[#ff9d85] shadow-primary/10',
    text: 'text-white',
    subtext: 'text-white/80',
    labelScrim: 'bg-black/60'
  },
  morning: {
    glow: 'bg-morning-accent-tint/15',
    orb: 'bg-morning-accent shadow-morning-accent-tint/20',
    text: 'text-on-morning-accent',
    subtext: 'text-on-morning-accent/70',
    labelScrim: null
  },
  anytime: {
    glow: 'bg-tertiary-tint/15',
    orb: 'bg-tertiary shadow-tertiary-tint/20',
    text: 'text-on-tertiary',
    subtext: 'text-on-tertiary/70',
    labelScrim: null
  },
  evening: {
    glow: 'bg-evening-accent-tint/15',
    orb: 'bg-evening-accent shadow-evening-accent-tint/20',
    text: 'text-on-evening-accent',
    subtext: 'text-on-evening-accent/70',
    labelScrim: null
  }
};

// WakeWise Phase 1 correction — Reduced Motion previously had no effect on
// this ring at all (BreathingRing.jsx never read the preference). `w-44
// h-44` is a fixed middle ground between the existing w-48 (Inhale/Hold)
// and w-36 (Exhale) sizes, and the glow's animated scale/opacity swap
// collapses to a single static value - both removed rather than merely
// slowed, since the phase name (breatheState) is already rendered
// unconditionally below and stays clearly legible from text alone with
// the scaling/pulsing/brightness motion gone.
export const BreathingRing = ({ breatheState, secondsLeft, journeyTone = 'primary', reducedMotion = false }) => {
  const tokens = RING_TOKENS[journeyTone] || RING_TOKENS.primary;
  const glowMotionClasses = reducedMotion
    ? 'opacity-70'
    : `transition-all duration-[4000ms] ${breatheState === 'Inhale' ? 'scale-125 opacity-100' : 'scale-95 opacity-50'}`;
  const orbSizeClasses = reducedMotion
    ? 'w-44 h-44'
    : `transition-all duration-[4000ms] ease-in-out ${breatheState === 'Inhale' ? 'w-48 h-48' : breatheState === 'Hold' ? 'w-48 h-48 brightness-110' : 'w-36 h-36'}`;

  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full ${tokens.glow} blur-3xl ${glowMotionClasses}`}></div>

      <div className="absolute inset-0 border-2 border-white/5 rounded-full"></div>

      <div className={`rounded-full ${tokens.orb} flex flex-col items-center justify-center shadow-xl ${tokens.text} ${orbSizeClasses}`}>
        <div className={tokens.labelScrim ? `${tokens.labelScrim} rounded-2xl px-4 py-1.5 flex flex-col items-center` : 'flex flex-col items-center'}>
          <span className="text-lg font-bold tracking-wider uppercase">{breatheState}</span>
          <span className={`text-xs ${tokens.subtext} mt-1 font-semibold`}>{secondsLeft}s left</span>
        </div>
      </div>
    </div>
  );
};
