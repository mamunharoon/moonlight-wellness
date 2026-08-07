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
 */
export const BreathingRing = ({ breatheState, secondsLeft }) => {
  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full bg-primary/10 blur-3xl transition-all duration-[4000ms] ${
        breatheState === 'Inhale' ? 'scale-125 opacity-100' : 'scale-95 opacity-50'
      }`}></div>

      <div className="absolute inset-0 border-2 border-white/5 rounded-full"></div>

      <div className={`rounded-full bg-gradient-to-br from-[#954835] to-[#ff9d85] flex flex-col items-center justify-center shadow-xl shadow-primary/10 text-white transition-all duration-[4000ms] ease-in-out ${
        breatheState === 'Inhale' ? 'w-48 h-48' : breatheState === 'Hold' ? 'w-48 h-48 brightness-110' : 'w-36 h-36'
      }`}>
        <span className="text-lg font-bold tracking-wider uppercase">{breatheState}</span>
        <span className="text-xs text-white/60 mt-1 font-semibold">{secondsLeft}s left</span>
      </div>
    </div>
  );
};
