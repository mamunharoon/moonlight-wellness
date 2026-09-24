/*
 * Build 15 — MusicPreferenceToggle
 *
 * A plain local preference switch shown on every pre-start screen
 * (Morning Stretch, Morning Breathe, Evening Breathing, standalone
 * Breathe). Deliberately NOT wired to real playback itself - flipping
 * this switch only ever records intent (`onToggle`); the calling page's
 * own "Begin" handler is what actually calls InteractiveAmbientMusic's
 * exposed start() once, synchronously, from that real user gesture. This
 * is what makes "music never starts on mount or on changing the switch"
 * true by construction, not by convention.
 *
 * Shows a truthful "Sign in to use background music." message and routes
 * the tap to sign-in instead of toggling, for a guest - matching the
 * same guest-lock convention InteractiveAmbientMusic's own toggle and
 * MusicEntryChoice already use elsewhere in this app.
 *
 * Release-quality contrast fix (Build 15): the OFF track used to be
 * `bg-white/10`, composited over this row's own glass-panel background
 * (~#232b3c) to roughly #262e3f - only ~1.36:1 against the knob
 * (surface-container-lowest, #060e20), badly failing the WCAG AA 3:1
 * non-text minimum and making the knob nearly invisible when off. The
 * OFF track now reuses the app's existing `outline` token (#a28c87, an
 * already-defined design-system colour, not a new one) - knob-vs-track
 * contrast becomes ~6.08:1. Off=left/On=right and every existing prop/
 * ARIA attribute (role="switch", aria-checked) are unchanged. A compact
 * visible "On"/"Off" text label sits beside the switch for a second,
 * non-colour-dependent cue - aria-hidden since the switch's own
 * aria-checked already announces the accessible state.
 */
export const MusicPreferenceToggle = ({ isOn, onToggle, isGuest = false, onSignIn, label = 'Background music', description }) => (
  <div className="glass-panel rounded-2xl p-4 border-white/10">
    <div className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-bold text-on-surface">{label}</span>
        <span className="block text-[11px] text-on-surface-variant">
          {isGuest ? 'Sign in to use background music.' : description}
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant" aria-hidden="true">
          {isOn ? 'On' : 'Off'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={label}
          onClick={isGuest ? onSignIn : onToggle}
          className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
            isOn ? 'bg-primary' : 'bg-outline'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-surface-container-lowest border border-primary shadow transition-transform ${
              isOn ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </span>
    </div>
  </div>
);
