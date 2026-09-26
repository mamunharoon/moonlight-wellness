import { getJourneyToneTokens } from '../lib/journeyTone';

/*
 * WakeWise — Self-Guided Meditation — progress ring.
 *
 * No existing "elapsing SVG ring" component exists anywhere in this app
 * (BreathingRing.jsx pulses/sizes with breath phase, not elapsed time;
 * AnytimeResetProgress.jsx is a discrete 3-step wizard bar, not a
 * continuous countdown) - built fresh here, reusing only the established
 * accessibility contract both of those already use: role="progressbar"
 * with aria-valuemin/max/now, a visible numeric label (never colour/motion
 * alone), and reduced-motion awareness.
 *
 * The ring's fill fraction and the visible mm:ss text are both derived
 * from the same elapsedSeconds/durationSeconds - the ring conveys nothing
 * the text doesn't already state plainly.
 *
 * Context-aware Meditation theming — `journeyTone` (additive, default
 * 'primary': every pre-existing caller that omits it keeps its exact
 * original peach ring): the active stroke colour (`stroke="currentColor"`
 * reads the element's own text colour) now reuses the same shared
 * journeyTone.js token map every other Meditation/Breathing control uses.
 * The timer number/label stay neutral (text-on-surface/text-on-surface-
 * variant) regardless - only the ring itself carries the journey colour.
 */
export const MeditationProgressRing = ({ elapsedSeconds, durationSeconds, reducedMotion = false, journeyTone = 'primary' }) => {
  const safeDuration = durationSeconds > 0 ? durationSeconds : 1;
  const remainingSeconds = Math.max(0, safeDuration - elapsedSeconds);
  const fraction = Math.max(0, Math.min(1, elapsedSeconds / safeDuration));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - fraction);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = Math.floor(remainingSeconds % 60);
  const timeLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeDuration}
      aria-valuenow={elapsedSeconds}
      aria-label="Meditation time remaining"
      className="relative w-56 h-56 max-w-[70vw] max-h-[70vw] mx-auto"
    >
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className={getJourneyToneTokens(journeyTone).text}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={reducedMotion ? undefined : { transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" aria-hidden="true">
        <span className="text-4xl font-bold text-on-surface tabular-nums">{timeLabel}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">remaining</span>
      </div>
    </div>
  );
};
