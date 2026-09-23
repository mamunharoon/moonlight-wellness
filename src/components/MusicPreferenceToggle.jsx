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
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={label}
        onClick={isGuest ? onSignIn : onToggle}
        className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
          isOn ? 'bg-primary' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-surface-container-lowest border border-primary shadow transition-transform ${
            isOn ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  </div>
);
