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
// `border-morning-accent-tint/40`/`border-evening-accent-tint/40` directly - the
// same opacity-on-plain-hex-CSS-var gap JourneyGlow.jsx's own doc
// comment documents (a Tailwind `/<n>` modifier silently resolves to
// fully transparent on these tokens), so the countdown ring's own border
// likely rendered with NO visible colour at all on Morning/Evening
// before this fix. Now uses the same alpha-safe `-tint` RGB-triplet
// tokens JourneyGlow.jsx uses, for all three journeys consistently.
//
// Mobile correction #3 — strengthened visual per the approved Stitch
// concept: a contained dark card (bg-surface-container, the same token
// already used for other contained surfaces in this app, e.g. the guided-
// sessions disclosure on Stretch/Breathe) instead of a plain glass-panel
// ring, a larger/bolder number with a "SECONDS" support label, and a
// subtle static journey-coloured glow (the existing morning-glow/mint-
// glow/evening-glow/welcome-glow shadow tokens - never a new colour, and
// never animated, so there is nothing to gate behind Reduced Motion on
// its own). "Start now" gains a light journey-tinted fill for more visual
// weight while staying deliberately short of a solid primary-action fill
// - see this file's own note above on why it must never compete with the
// screen's real Begin/Continue action that follows. Functional timing/
// Skip/audio-unlock behaviour is entirely unchanged: every prop here is
// still purely presentational, exactly as before.
const ACCENT_TONES = {
  morning: { text: 'text-morning-accent', border: 'border-morning-accent-tint/40', glow: 'shadow-morning-glow', fill: 'bg-morning-accent-tint/15' },
  anytime: { text: 'text-tertiary', border: 'border-tertiary-tint/40', glow: 'shadow-mint-glow', fill: 'bg-tertiary-tint/15' },
  evening: { text: 'text-evening-accent', border: 'border-evening-accent-tint/40', glow: 'shadow-evening-glow', fill: 'bg-evening-accent-tint/15' },
  primary: { text: 'text-primary', border: 'border-primary/40', glow: 'shadow-welcome-glow', fill: 'bg-primary/15' }
};

// Physical-device correction — the number badge above was its own small
// circle floating on the bare page background, with the "Starting in…"
// text/cue/button sitting directly on that same bare background below it
// - reported as reading weak/undefined against the page rather than as
// one clear countdown card. The whole presentation (number, Seconds
// label, "Starting in…", cue, Start now) now lives inside ONE near-square
// card carrying the dark surface/border/glow instead - deliberately no
// forced aspect-square (height stays auto, driven by real content) so a
// short viewport (320x568) can never clip it; max-w keeps it visually
// square-ish and centred rather than stretching edge-to-edge on a wider
// phone. Every prop/behaviour this component's own contract depends on
// (secondsRemaining/cue/onSkip/accent, the exact "Starting in N…"/"Seconds"
// copy, role="status") is unchanged - this is a container restructure only.
export const PreparationCountdown = ({ secondsRemaining, cue, onSkip, accent = 'primary' }) => {
  const tone = ACCENT_TONES[accent] ?? ACCENT_TONES.primary;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4" role="status" aria-live="polite">
      <div
        className={`w-full max-w-[300px] mx-auto rounded-[2rem] bg-surface-container border ${tone.border} ${tone.glow} flex flex-col items-center text-center gap-5 px-6 py-8 select-none`}
      >
        <div className="flex flex-col items-center">
          <span className={`text-7xl font-extrabold leading-none ${tone.text}`}>{secondsRemaining}</span>
          {secondsRemaining > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1.5">Seconds</span>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-lg font-bold text-on-surface">
            {secondsRemaining > 0 ? `Starting in ${secondsRemaining}…` : 'Starting now…'}
          </p>
          {cue && <p className="text-xs text-on-surface-variant max-w-[220px] mx-auto">{cue}</p>}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className={`${tone.fill} ${tone.text} px-8 py-3.5 rounded-full font-bold text-sm border ${tone.border} hover:bg-white/10 active:scale-95 transition-all min-h-[44px] w-full`}
        >
          Start now
        </button>
      </div>
    </div>
  );
};
