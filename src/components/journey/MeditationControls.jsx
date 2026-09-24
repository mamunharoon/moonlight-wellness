/*
 * WakeWise — Self-Guided Meditation — shared style/duration/sound controls.
 *
 * Extracted verbatim (same markup/classes) from SelfGuidedMeditation.jsx,
 * where these were previously file-local. Exported here so
 * MeditationSetupPanel.jsx/MeditationActiveSession.jsx (and the standalone
 * page itself, once recomposed) all render the exact same accessible
 * radiogroup rows - never a second, divergent selection control.
 */

// Compact accessible radio row for the 5 meditation styles - same native
// <input type="radio"> + <label> construction BreathingPatternRow.jsx
// established (a strong ring when unselected, a filled ring plus a small
// contrasting dot when selected - never a checkmark).
export const MeditationOptionRow = ({ groupName, label, description, selected, onSelect }) => (
  <label
    className={`flex items-center justify-between gap-3 w-full min-h-[44px] px-4 py-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
      selected ? 'bg-primary/10 border-primary' : 'bg-surface-container border-primary/50 hover:bg-white/10'
    }`}
  >
    <input type="radio" name={groupName} checked={selected} onChange={onSelect} className="sr-only" />
    <span className="flex-1 min-w-0">
      <span className={`block text-sm leading-snug ${selected ? 'text-primary font-bold' : 'text-on-surface font-medium'}`}>{label}</span>
      {description && <span className="block text-[11px] text-on-surface-variant mt-0.5 leading-snug">{description}</span>}
    </span>
    <span
      aria-hidden="true"
      className={`relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
        selected ? 'border-primary bg-primary' : 'border-primary bg-surface-container-lowest'
      }`}
    >
      {selected && <span className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-on-primary" />}
    </span>
  </label>
);

// Compact 3-across radio grid for the 3 durations - a segmented-control
// shape rather than 3 stacked full-width rows.
export const MeditationDurationChip = ({ groupName, label, sublabel, selected, onSelect }) => (
  <label
    className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 py-2.5 rounded-2xl border text-center transition-all duration-150 cursor-pointer active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
      selected ? 'bg-primary/10 border-primary' : 'bg-surface-container border-primary/50 hover:bg-white/10'
    }`}
  >
    <input type="radio" name={groupName} checked={selected} onChange={onSelect} className="sr-only" />
    <span className={`block text-sm ${selected ? 'text-primary font-bold' : 'text-on-surface font-semibold'}`}>{label}</span>
    {sublabel && <span className="block text-[9px] uppercase tracking-wide font-bold text-primary">{sublabel}</span>}
  </label>
);
