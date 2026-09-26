import { formatCadence, formatBreathingDuration } from '../lib/breathingPatterns';
import { JOURNEY_TONE_TOKENS } from '../lib/journeyTone';

/*
 * Build 15 — BreathingPatternRow
 *
 * One selectable real breathing pattern, shown on the Morning Breathe,
 * standalone Breathe, and (Build 15 Evening UX correction) Evening
 * Breathing pre-start screens. A real native <input type="radio"> -
 * exactly one pattern may be selected at a time - wrapped by one <label>
 * covering the whole row, matching the same accessible construction
 * AnswerOptionButton.jsx already established and proved (contrast-
 * verified this same session): a strong ring when unselected, a filled
 * ring plus a small contrasting inner dot when selected - never a
 * checkmark, never a chevron. Kept as its own small component (not a
 * reuse of AnswerOptionButton, which lives under components/evening/ and
 * carries Reflection/Gratitude's own section-accent contract) so
 * Morning/standalone/Evening each just pass their own accent identity.
 *
 * F7 (pre-Build-15 usability pass) — approved compact card structure:
 * the duration used to sit on its own third line below the cadence
 * ("Inhale 4s · Hold 4s · Exhale 6s" then, on its own line, "56 sec"),
 * making every card unnecessarily tall. Duration now sits beside the
 * cadence on the same row (justify-between, so it right-aligns when
 * there's room), wrapping onto its own line at narrow widths
 * (flex-wrap) rather than ever overlapping the cadence text or the
 * radio indicator - both still ordinary text within the same flex-1
 * label content, so the whole card stays selectable exactly as before.
 * min-h-[56px] -> min-h-[44px] (still the established minimum, just no
 * longer padded for a fourth line of content this shape no longer has).
 *
 * Correction (acceptance review) — the duration span had carried
 * `uppercase` since before this pass (the original third-line design),
 * so live verification showed "56 SEC"/"~1 MIN" despite the approved
 * copy reading "56 sec"/"1 min" in real sentence case. Removed here -
 * the rendered text now matches the approved copy's own casing exactly.
 * See breathingPatterns.js's own doc comment for the separate "~1 min"
 * rounding correction.
 *
 * `accent` (additive, default 'primary' - every existing Morning/
 * standalone caller omits it and keeps its exact original WakeWise-peach
 * look, byte-for-byte unchanged): 'evening' swaps in the same
 * evening-accent periwinkle tokens already used throughout the rest of
 * the Evening journey (AnswerOptionButton's own unselected rows,
 * PrepareToggleRow's switches) - never a third, new colour.
 *
 * Morning Visual Uplift (Build 16) — 'morning' is a NEW accent value,
 * additive exactly like 'evening' above: it reuses the already-contrast-
 * verified morning-accent/on-morning-accent gold pair (the same tokens
 * Home's Today's Rhythm Morning tab already uses), never a new colour.
 * Only Breathe.jsx (Morning's real mindful-breathing screen) passes
 * `accent="morning"`; EveningBreathing.jsx, QuietBreathing.jsx (Anytime),
 * and SelfGuidedMeditation.jsx all still omit the prop entirely and keep
 * rendering the exact 'primary' peach tokens they always have - see
 * breathingPatternRowSharedConsumers.test.js for the regression proof
 * that this stays true.
 */
// WakeWise DEV — journey-aware primary action colour.
//
// Pre-existing bug fixed for 'morning'/'evening', and avoided for the
// new 'anytime' case: `selectedRow` previously used `bg-morning-accent/10`/
// `bg-evening-accent/10` directly - the same opacity-on-plain-hex-CSS-var
// gap JourneyGlow.jsx's own doc comment documents (confirmed live:
// bg-morning-accent/10 computes to fully transparent) - so the selected
// pattern row's own tinted background likely rendered invisible on
// Morning/Evening before this fix. Now uses the alpha-safe `-tint`
// RGB-triplet tokens. `primary`'s own identical `bg-primary/10` has the
// same defect (AnytimeResetProgress.jsx's own doc comment already names
// this exact gap and explicitly defers it as "out of scope" for that
// phase) - left untouched here too, a pre-existing, separately-scoped
// issue this pass doesn't otherwise touch.
//
// 'anytime' is a NEW accent value: QuietBreathing.jsx's standalone
// branch and SelfGuidedMeditation.jsx (neither of which render this
// component today, but may in future) can now pass accent="anytime" for
// the same mint identity every other Anytime surface already uses,
// rather than silently falling back to peach.
// Context-aware Breathing/Meditation theming — now sourced from the
// shared journeyTone.js token file (identical content) so Meditation's
// own controls can reuse the exact same mapping instead of a second,
// divergent copy. The local `ACCENT_TOKENS` name is kept (rather than
// renaming every reference below) purely to minimise this diff - it is
// the same object JOURNEY_TONE_TOKENS is, not a fork of it.
const ACCENT_TOKENS = JOURNEY_TONE_TOKENS;

// Build 16 physical-iPhone correction (F5) — `compact` renders a grid-
// card variant: pattern name only, no cadence/duration on the card
// itself (a shared description area below the grid shows the currently
// selected pattern's full cadence+duration once - see Breathe.jsx/
// EveningBreathing.jsx/QuietBreathing.jsx). Same real radio input/label
// wrapping, focus-visible ring, and selected-state visual language
// (filled ring + dot, tinted background, bold text) as the full row -
// only the layout and the omitted cadence/duration differ. The full
// name is never abbreviated. min-h-[44px] keeps the touch target at the
// established minimum even in a 2-column grid on a 320px-wide screen.
export const BreathingPatternRow = ({ pattern, selected, onSelect, groupName, accent = 'primary', compact = false, className = '' }) => {
  const tokens = ACCENT_TOKENS[accent];

  if (compact) {
    return (
      <label
        className={`flex items-center justify-center gap-2 w-full min-h-[44px] px-3 py-3 rounded-2xl border text-center transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
          selected ? tokens.selectedRow : tokens.unselectedRow
        } ${className}`}
      >
        <input
          type="radio"
          name={groupName}
          checked={selected}
          onChange={() => onSelect(pattern.id)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={`relative w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
            selected ? tokens.selectedRing : tokens.unselectedRing
          }`}
        >
          {selected && <span className={`absolute inset-0 m-auto w-1.5 h-1.5 rounded-full ${tokens.dot}`} />}
        </span>
        <span className={`text-xs leading-snug ${selected ? tokens.selectedLabel : 'text-on-surface font-medium'}`}>
          {pattern.label}
        </span>
      </label>
    );
  }

  return (
    <label
      className={`flex items-center justify-between gap-3 w-full min-h-[44px] px-5 py-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        selected ? tokens.selectedRow : tokens.unselectedRow
      }`}
    >
      <input
        type="radio"
        name={groupName}
        checked={selected}
        onChange={() => onSelect(pattern.id)}
        className="sr-only"
      />
      <span className="flex-1 min-w-0">
        <span className={`block text-sm leading-snug ${selected ? tokens.selectedLabel : 'text-on-surface font-medium'}`}>
          {pattern.label}
        </span>
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mt-1">
          <span className="text-xs text-on-surface-variant">
            {formatCadence(pattern)}
          </span>
          <span className="text-[10px] text-on-surface-variant/70 font-semibold tracking-wide shrink-0">
            {formatBreathingDuration(pattern.totalSeconds)}
          </span>
        </span>
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
