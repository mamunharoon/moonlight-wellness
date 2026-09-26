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
// WakeWise DEV — journey-aware primary action colour: 'anytime' added
// alongside the existing 'morning'/'evening' cases (every existing
// caller passing 'morning'/'evening'/omitting this prop is unaffected;
// QuietBreathing.jsx's standalone branch and SelfGuidedMeditation.jsx
// now pass 'anytime' explicitly instead of omitting it and silently
// getting the generic peach ring/button). "Start now" itself gets only a
// light, journey-tinted border/text treatment (not a solid fill) - it is
// a shortcut past the countdown, not the screen's own primary
// Begin/Continue action, so it stays in the "secondary... very light
// journey-tinted border/background" tier per the approved brief, never
// competing visually with the real primary action that follows it.
//
// Pre-existing bug fixed in passing: accentBorder previously used
// `border-morning-accent/40`/`border-evening-accent/40` directly - the
// same opacity-on-plain-hex-CSS-var gap JourneyGlow.jsx's own doc
// comment documents (a Tailwind `/<n>` modifier silently resolves to
// fully transparent on these tokens), so the countdown ring's own border
// likely rendered with NO visible colour at all on Morning/Evening
// before this fix. Now uses the same alpha-safe `-tint` RGB-triplet
// tokens JourneyGlow.jsx uses, for all three journeys consistently.
export const PreparationCountdown = ({ secondsRemaining, cue, onSkip, accent = 'primary' }) => {
  const accentText = accent === 'morning' ? 'text-morning-accent' : accent === 'anytime' ? 'text-tertiary' : accent === 'evening' ? 'text-evening-accent' : 'text-primary';
  const accentBorder = accent === 'morning' ? 'border-morning-accent-tint/40' : accent === 'anytime' ? 'border-tertiary-tint/40' : accent === 'evening' ? 'border-evening-accent-tint/40' : 'border-primary/40';

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
        className={`glass-panel ${accentText} px-6 py-3 rounded-full font-bold text-sm hover:bg-white/10 active:scale-95 transition-all ${accentBorder} min-h-[44px]`}
      >
        Start now
      </button>
    </div>
  );
};
