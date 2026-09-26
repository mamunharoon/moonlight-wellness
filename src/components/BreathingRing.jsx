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
 */
const RING_TOKENS = {
  primary: {
    glow: 'bg-primary/10',
    orb: 'bg-gradient-to-br from-[#954835] to-[#ff9d85] shadow-primary/10',
    text: 'text-white',
    subtext: 'text-white/60'
  },
  morning: {
    glow: 'bg-morning-accent-tint/15',
    orb: 'bg-morning-accent shadow-morning-accent-tint/20',
    text: 'text-on-morning-accent',
    subtext: 'text-on-morning-accent/70'
  },
  anytime: {
    glow: 'bg-tertiary-tint/15',
    orb: 'bg-tertiary shadow-tertiary-tint/20',
    text: 'text-on-tertiary',
    subtext: 'text-on-tertiary/70'
  },
  evening: {
    glow: 'bg-evening-accent-tint/15',
    orb: 'bg-evening-accent shadow-evening-accent-tint/20',
    text: 'text-on-evening-accent',
    subtext: 'text-on-evening-accent/70'
  }
};

export const BreathingRing = ({ breatheState, secondsLeft, journeyTone = 'primary' }) => {
  const tokens = RING_TOKENS[journeyTone] || RING_TOKENS.primary;
  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full ${tokens.glow} blur-3xl transition-all duration-[4000ms] ${
        breatheState === 'Inhale' ? 'scale-125 opacity-100' : 'scale-95 opacity-50'
      }`}></div>

      <div className="absolute inset-0 border-2 border-white/5 rounded-full"></div>

      <div className={`rounded-full ${tokens.orb} flex flex-col items-center justify-center shadow-xl ${tokens.text} transition-all duration-[4000ms] ease-in-out ${
        breatheState === 'Inhale' ? 'w-48 h-48' : breatheState === 'Hold' ? 'w-48 h-48 brightness-110' : 'w-36 h-36'
      }`}>
        <span className="text-lg font-bold tracking-wider uppercase">{breatheState}</span>
        <span className={`text-xs ${tokens.subtext} mt-1 font-semibold`}>{secondsLeft}s left</span>
      </div>
    </div>
  );
};
