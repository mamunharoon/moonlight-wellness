// Morning Visual Uplift (Phase 6) — a small, header-scale sound toggle,
// replacing the large full-width MusicPreferenceToggle card on Morning's
// Stretch/Breathing pre-start screens per the approved Stitch-direction
// restructure ("compact Sound control in the top-right area"). This is a
// pure presentation wrapper: `isOn`/`onToggle` are always the SAME
// state/handler the caller already passes to MusicPreferenceToggle
// elsewhere (musicPreferenceOn/handleToggleMusicPreference,
// getMusicPreference/setMusicPreferenceForUser-backed) - it never creates
// a second audio/preference state of its own, and never touches playback
// directly (exactly like MusicPreferenceToggle's own documented
// contract - the caller's own "Begin" handler is what starts real
// playback from a genuine user gesture).
//
// `journeyTone` (additive, default 'primary') reuses the same
// already-contrast-verified accent tokens MusicPreferenceToggle/
// BreathingPatternRow/MovementCheckboxRow already use - never a new
// colour. Only Morning's Stretch/Breathing setup screens use this today
// (journeyTone="morning"); Evening/Anytime are untouched by this pass and
// keep their existing full-width MusicPreferenceToggle unchanged.
const ACCENT_TOKENS = {
  primary: { on: 'bg-primary/15 text-primary border-primary/40', focusRing: 'focus-visible:ring-primary' },
  morning: { on: 'bg-morning-accent-tint/20 text-morning-accent border-morning-accent-tint/50', focusRing: 'focus-visible:ring-morning-accent' },
  anytime: { on: 'bg-tertiary-tint/20 text-tertiary border-tertiary-tint/50', focusRing: 'focus-visible:ring-tertiary' },
  evening: { on: 'bg-evening-accent-tint/20 text-evening-accent border-evening-accent-tint/50', focusRing: 'focus-visible:ring-evening-accent' }
};

export const CompactSoundControl = ({ isOn, onToggle, journeyTone = 'primary', label = 'Background music' }) => {
  const tokens = ACCENT_TOKENS[journeyTone] || ACCENT_TOKENS.primary;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={`${label}: ${isOn ? 'on' : 'off'}`}
      onClick={onToggle}
      className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center gap-1.5 px-3 rounded-full border transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${tokens.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
        isOn ? tokens.on : 'bg-white/5 text-on-surface-variant border-white/10'
      }`}
    >
      <span className="material-symbols-outlined text-lg" aria-hidden="true">{isOn ? 'volume_up' : 'volume_off'}</span>
      <span className="text-[11px] font-bold uppercase tracking-wide">Sound</span>
    </button>
  );
};
