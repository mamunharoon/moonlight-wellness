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
 *
 * Guest pre-start-music correction (Build 18) — `isGuest`/`onSignIn`
 * REMOVED. This switch never touches playback or the network itself; it
 * only ever records intent for the calling page's own Begin handler (see
 * this file's own top comment). Routing a guest's tap to sign-in was
 * therefore never actually protecting anything - the real interactive
 * ambient-music control this switch's own intent feeds into
 * (InteractiveAmbientMusic.jsx) has had no guest gate at all since the
 * earlier guest-interactive-audio correction (IB01/IS01/IM01/IM02 are all
 * server-allowlisted for guests). This switch simply always calls
 * `onToggle` now, for every user - the calling page decides what onToggle
 * actually does with a guest's choice (see musicPreference.js's new
 * setMusicPreferenceForUser: a guest's choice still genuinely drives
 * playback this mount, it is just never written to the shared, device-
 * scoped persisted-preference key).
 *
 * Morning Visual Uplift (Build 16) — `accent` (additive, default
 * 'primary' - every existing caller omits it and keeps its exact
 * original WakeWise-peach ON state, byte-for-byte unchanged): 'morning'
 * swaps the ON track/knob-border/focus-ring to the same already-
 * contrast-verified morning-accent gold BreathingPatternRow's own
 * 'morning' accent uses, never a new colour. Only MorningFlow.jsx and
 * Breathe.jsx pass `accent="morning"`; EveningBreathing.jsx and
 * QuietBreathing.jsx (Anytime) both still omit the prop and keep
 * rendering peach - see musicPreferenceToggleSharedConsumers.test.js.
 * The On/Off text label and aria-checked keep reflecting the same real
 * `isOn` boolean regardless of accent - this toggle never rendered a
 * visual state that disagreed with its own label to begin with, so
 * there was nothing to correct, only to keep true while adding gold.
 *
 * Evening Visual Uplift (Build 17) — 'evening' is a third accent value,
 * additive exactly like 'morning' above: it reuses the already-contrast-
 * verified evening-accent periwinkle BreathingPatternRow's own 'evening'
 * accent and PrepareToggleRow already use, never a new colour. Only
 * EveningBreathing.jsx passes `accent="evening"`; QuietBreathing.jsx
 * (Anytime) still omits the prop and keeps rendering peach - see
 * musicPreferenceToggleSharedConsumers.test.js.
 *
 * Acceptance-audit correction (Decision 2) — the switch's real tappable
 * box measured 48x28px (w-12 h-7), under the 44px minimum on its shorter
 * axis. The visible pill itself must stay exactly that size ("do not make
 * the visual switch disproportionately large"), so the fix moves the
 * `w-12 h-7`/track styling onto a purely decorative, aria-hidden inner
 * `<span>`, and grows the real interactive `<button>` around it via
 * symmetric `py-2` padding (28 + 8 + 8 = 44px) with a matching `-my-2`
 * negative margin - the same established technique "Exit routine"'s own
 * acceptance-audit fix and ProgressIndicator.jsx's review chips already
 * use, so the surrounding row's own layout height is unaffected (the
 * negative margin cancels exactly the padding it added) even though the
 * real hit box is now 44px tall. `aria-label={label}` already gave the
 * switch a correct accessible name before this change and still does -
 * unchanged.
 */
const ACCENT_TOKENS = {
  primary: { track: 'bg-primary', knobBorder: 'border-primary', focusRing: 'focus-visible:ring-primary' },
  morning: { track: 'bg-morning-accent', knobBorder: 'border-morning-accent', focusRing: 'focus-visible:ring-morning-accent' },
  evening: { track: 'bg-evening-accent', knobBorder: 'border-evening-accent', focusRing: 'focus-visible:ring-evening-accent' }
};

export const MusicPreferenceToggle = ({ isOn, onToggle, label = 'Background music', description, accent = 'primary' }) => {
  const tokens = ACCENT_TOKENS[accent];

  return (
  <div className="glass-panel rounded-2xl p-4 border-white/10">
    <div className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-bold text-on-surface">{label}</span>
        <span className="block text-[11px] text-on-surface-variant">
          {description}
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
          onClick={onToggle}
          className={`shrink-0 rounded-full -my-2 py-2 focus-visible:ring-2 ${tokens.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
        >
          <span
            aria-hidden="true"
            className={`block w-12 h-7 rounded-full transition-colors relative ${
              isOn ? tokens.track : 'bg-outline'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-surface-container-lowest border ${tokens.knobBorder} shadow transition-transform ${
                isOn ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>
      </span>
    </div>
  </div>
  );
};
