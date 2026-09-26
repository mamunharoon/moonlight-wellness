import { getJourneyToneTokens } from '../../lib/journeyTone';

/*
 * WakeWise — Self-Guided Meditation — shared style/duration/sound controls.
 *
 * Extracted verbatim (same markup/classes) from SelfGuidedMeditation.jsx,
 * where these were previously file-local. Exported here so
 * MeditationSetupPanel.jsx/MeditationActiveSession.jsx (and the standalone
 * page itself, once recomposed) all render the exact same accessible
 * radiogroup rows - never a second, divergent selection control.
 *
 * Context-aware Meditation theming — `journeyTone` (additive, default
 * 'primary': every pre-existing call site that omits it keeps its exact
 * original peach look): selected border/background/label/radio-dot now
 * reuse the shared journeyTone.js token map (the same one
 * BreathingPatternRow.jsx uses) instead of hardcoded `primary` classes,
 * so a Morning/Evening/Anytime caller's selected style/duration/sound
 * matches its own journey colour rather than always peach.
 */

// Compact accessible radio row for the 5 meditation styles - same native
// <input type="radio"> + <label> construction BreathingPatternRow.jsx
// established (a strong ring when unselected, a filled ring plus a small
// contrasting dot when selected - never a checkmark).
export const MeditationOptionRow = ({ groupName, label, description, selected, onSelect, journeyTone = 'primary' }) => {
  const tokens = getJourneyToneTokens(journeyTone);
  return (
    <label
      className={`flex items-center justify-between gap-3 w-full min-h-[44px] px-4 py-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        selected ? tokens.selectedRow : tokens.unselectedRow
      }`}
    >
      <input type="radio" name={groupName} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="flex-1 min-w-0">
        <span className={`block text-sm leading-snug ${selected ? tokens.selectedLabel : 'text-on-surface font-medium'}`}>{label}</span>
        {description && <span className="block text-[11px] text-on-surface-variant mt-0.5 leading-snug">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
          selected ? tokens.selectedRing : tokens.unselectedRing
        }`}
      >
        {selected && <span className={`absolute inset-0 m-auto w-2 h-2 rounded-full ${tokens.dot}`} />}
      </span>
    </label>
  );
};

// F6 (pre-Build-15 usability pass) — approved compact two-column layout
// for the 5 meditation styles, replacing 5 stacked full-width
// MeditationOptionRow rows (each carrying its own description inline,
// making the setup screen unnecessarily long). This card shows only the
// style NAME - the description moves to one shared line below the grid
// in MeditationSetupPanel.jsx instead, updating with the current
// selection. The accessible name still carries the full "label:
// description" pair via aria-label on the actual <input> (not the
// wrapping <label>, which is what a screen reader's default label-text
// computation would otherwise use) - a screen reader user gets the same
// information a sighted user gets from the shared description line,
// even though it isn't inside this element's own visible text.
// `fullWidth` (used only for the 5th/odd-numbered style, Loving-
// Kindness) spans both grid columns rather than leaving a lone card
// half-empty in its own row.
export const MeditationStyleCard = ({ groupName, label, description, selected, onSelect, fullWidth = false, journeyTone = 'primary' }) => {
  const tokens = getJourneyToneTokens(journeyTone);
  return (
    <label
      className={`flex items-center justify-center min-h-[44px] px-3 py-3.5 rounded-2xl border text-center transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        fullWidth ? 'col-span-2' : ''
      } ${
        selected ? tokens.selectedRow : tokens.unselectedRow
      }`}
    >
      <input type="radio" name={groupName} checked={selected} onChange={onSelect} className="sr-only" aria-label={description ? `${label}: ${description}` : label} />
      <span className={`text-sm leading-snug ${selected ? tokens.selectedLabel : 'text-on-surface font-medium'}`}>{label}</span>
    </label>
  );
};

// Compact 3-across radio grid for the 3 durations - a segmented-control
// shape rather than 3 stacked full-width rows.
export const MeditationDurationChip = ({ groupName, label, sublabel, selected, onSelect, journeyTone = 'primary' }) => {
  const tokens = getJourneyToneTokens(journeyTone);
  return (
    <label
      className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 py-2.5 rounded-2xl border text-center transition-all duration-150 cursor-pointer active:scale-[0.97] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        selected ? tokens.selectedRow : tokens.unselectedRow
      }`}
    >
      <input type="radio" name={groupName} checked={selected} onChange={onSelect} className="sr-only" />
      <span className={`block text-sm ${selected ? tokens.selectedLabel : 'text-on-surface font-semibold'}`}>{label}</span>
      {/* RECOMMENDED badge - tone-coloured, matching the rest of this
          card's own selected-state identity. */}
      {sublabel && <span className={`block text-[9px] uppercase tracking-wide font-bold ${tokens.text}`}>{sublabel}</span>}
    </label>
  );
};
