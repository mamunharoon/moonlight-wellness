// Build 16 physical-iPhone correction (F3) — shared 5-second preparation
// screen shown between a page's own pre-start setup and the real timed
// practice. Purely presentational (all timing lives in
// usePreparationCountdown) so Stretch/Breathing/Meditation each render
// this with their own context-appropriate `cue` rather than duplicating
// markup. `onSkip` ("Start now") is the only forward action here - Back/
// Cancel is handled by each page's own existing BackButton
// (onBeforeLeave calls the countdown's own cancel() and returns false,
// exactly like every other "intercept Back mid-flow" case already in
// this codebase), not a second control on this screen.
export const PreparationCountdown = ({ secondsRemaining, cue, onSkip, accent = 'primary' }) => {
  const accentText = accent === 'morning' ? 'text-morning-accent' : accent === 'evening' ? 'text-evening-accent' : 'text-primary';
  const accentBorder = accent === 'morning' ? 'border-morning-accent/40' : accent === 'evening' ? 'border-evening-accent/40' : 'border-primary/40';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 select-none" role="status" aria-live="polite">
      <div className={`w-24 h-24 rounded-full glass-panel border-2 ${accentBorder} flex items-center justify-center`}>
        <span className={`text-4xl font-bold ${accentText}`}>{secondsRemaining}</span>
      </div>
      <div className="space-y-2 px-6">
        <p className="text-lg font-bold text-on-surface">
          {secondsRemaining > 0 ? `Starting in ${secondsRemaining}…` : 'Starting now…'}
        </p>
        {cue && <p className="text-sm text-on-surface-variant max-w-xs mx-auto">{cue}</p>}
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="glass-panel text-on-surface px-6 py-3 rounded-full font-bold text-sm hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px]"
      >
        Start now
      </button>
    </div>
  );
};
