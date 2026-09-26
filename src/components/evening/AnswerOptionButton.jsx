/*
 * Phase 3 UX correction — AnswerOptionButton
 *
 * Physical-device feedback, round 2: the first correction (a fully filled
 * coloured button) read as too bright/heavy for a genuinely single-select
 * answer, and the intended pattern was a contrasting RADIO selector, not a
 * filled-button style - sliding toggle switches are reserved for Prepare
 * for Rest's independent, multi-select checklist actions (a later,
 * separately-approved subphase), never for these single-select questions.
 *
 * Still a NEW component used only by Reflection/Gratitude's tap-first
 * questions (via PromptStepper) - SelectionChip/SelectionRow remain
 * completely untouched, still used exactly as before by ChangeIntention.jsx/
 * AnytimeReset.jsx/Meditate.jsx.
 *
 * MARKUP: a real native <input type="radio"> (visually hidden via sr-only,
 * never removed from the accessibility tree) wrapped by one <label> that
 * covers the entire row - clicking anywhere activates it, never only the
 * visible circle. Sharing one `name` (the question's own promptId) across
 * every option in the group gives real arrow-key cycling and Home/End
 * behaviour for free, native to every screen reader, with no hand-rolled
 * ARIA-widget keydown handling needed - "prefer semantic radiogroup/radio
 * behaviour... rather than switch semantics" is satisfied by using an
 * actual <input type="radio">, not a styled <button role="radio">.
 * PromptStepper wraps the whole set in role="radiogroup".
 *
 * SELECTED STATE (subtle, never "excessively bright")
 *   The row itself only gets a subtle colour-tinted background
 *   (bg-primary/10 or bg-gratitude-accent/10 - already how this app tints
 *   a container from a CSS-variable colour, see SelectionChip.jsx's own
 *   established bg-primary-container/25 precedent), a full-strength
 *   border, and bold, coloured label text - never a fully filled block.
 *   All of the saturated colour lives in the RADIO GLYPH on the right: an
 *   outlined, empty circle when unselected: filled with a small,
 *   contrasting inner dot when selected - never a tick/checkmark, never a
 *   chevron. `accent` picks which section's colour: 'reflection' reuses
 *   the app's own existing primary/on-primary tokens (WakeWise's own
 *   peach/coral, already contrast-paired and already used for every
 *   primary CTA - not a second, barely-different peach); 'gratitude'
 *   (Build 15 Evening UX correction) now reuses this EXACT SAME peach/
 *   on-primary pair too - previously it used the gratitude-accent/
 *   on-gratitude-accent gold pair (see index.css), but that read as an
 *   unexplained, mixed colour identity against Reflection's peach within
 *   the same Evening journey. The gratitude-accent/on-gratitude-accent
 *   CSS variables and Tailwind tokens themselves are NOT removed -
 *   Home.jsx's Today's Rhythm Morning card (`morning-accent`) reuses this
 *   exact same CSS variable for its own, unrelated sunrise-gold identity
 *   - only Gratitude's own consumption of them, here, stops.
 *
 * `groupName` scopes the native radio `name` to this question only (its
 * own promptId) so the browser's built-in radio-group behaviour (arrow
 * keys cycle selection within the group, Tab moves in/out as one stop)
 * never leaks across different questions.
 * The old `centered` prop (from the first Phase 3 correction) is gone -
 * this component still makes no column-count decision of its own; that
 * now lives in each caller's own options-container className (see
 * PromptStepper.jsx/EveningEditQuestion.jsx/EveningReviewQuestion.jsx),
 * not here.
 *
 * Compact two-column layout (Build 16): every caller's options container
 * is now a 2-column CSS grid rather than a single stacked column, so this
 * component itself became a GRID CARD rather than a full-width row -
 * `min-h-[52px]`/`px-5 py-3`/`gap-3` (sized for a full-width row with room
 * to spare) became `min-h-[64px]`/`px-3 py-3`/`gap-2` (the approved
 * 64px-minimum touch height, and tighter horizontal padding/gap so real
 * option text still has genuine room at a ~106-134px card width on a
 * 320-375px screen, unconditionally, at every width - see
 * PromptStepper.jsx's own doc comment for the real measured numbers and
 * why no narrow-screen fallback was needed. `justify-between` still pins
 * the label left and the radio
 * glyph right within each card, so "radio must not overlap text" holds
 * exactly as before; grid's own default `align-items: stretch` (never
 * overridden here) is what makes two cards in the same row match height
 * automatically when one label wraps to more lines than its neighbour -
 * no explicit height/JS measurement needed for that.
 *
 * Evening selectable-control visual refinement (Build 15): the row's own
 * unselected border and the radio's own unselected ring both moved from a
 * near-invisible neutral (white/15, on-surface-variant) to
 * evening-accent - the same calm periwinkle Prepare for Rest's switches
 * already use - so every Evening selectable row now shares one visual
 * language. Calculated, not eyeballed: evening-accent/55 measures ~3.4:1
 * against the row's own surface-container background (clears the 3:1 AA
 * non-text floor); the unselected radio's full-strength evening-accent
 * ring measures ~8:1. The unselected radio's centre is now an explicit
 * dark fill (surface-container-lowest) rather than transparent - ~9.4:1
 * against its own ring, satisfying "centre against its surrounding
 * circle" as its own measured pair, not just "whatever the row happens to
 * show through."
 *
 * Evening journey-theme correction — found live: Reflection/Gratitude's
 * SELECTED state was still hardcoded peach (`ACCENT_TOKENS.reflection`/
 * `.gratitude`, both byte-identical bg-primary/text-primary/on-primary
 * tokens) regardless of journey, while the row's own UNSELECTED border/
 * ring above were already hardcoded to evening-accent regardless of
 * journey too - the opposite bug, silently painting a periwinkle
 * unselected border onto any non-Evening consumer (StressRelease.jsx's
 * Anytime prompts). Both are now driven by one real `journeyTone` prop
 * (default 'primary', the exact original peach look, byte-identical for
 * any caller that omits it) via the same shared journeyTone.js token map
 * BreathingPatternRow/MeditationSetupPanel/MovementCheckboxRow already
 * use - selected and unselected both resolve from the same tone, so a
 * genuine Anytime consumer (StressRelease, passing journeyTone="anytime")
 * now correctly gets mint throughout, not a mixed peach/periwinkle
 * identity. Reflection.jsx/Gratitude.jsx (and their read-only Review/Edit
 * twins) now explicitly pass journeyTone="evening".
 *
 * `readOnly` (Evening completed-review work, additive - every existing
 * active-journey caller omits it and is completely unaffected):
 *   Uses the native `disabled` attribute on the real radio input, never a
 *   CSS-only trick. The visible circle/dot/row are all hand-drawn <span>
 *   elements (not the browser's own radio chrome), so disabling the
 *   underlying input has NO visual side effect on them at all - the
 *   selected/unselected styling stays exactly as legible as the live
 *   journey's own, satisfying "disabled browser styling does not reduce
 *   contrast" by construction rather than by tuning opacity values. A
 *   disabled input cannot be focused, tabbed to, or toggled by keyboard,
 *   touch, or pointer (native HTML behaviour, not application code); its
 *   `checked` state is still exposed to assistive tech exactly as
 *   before, so VoiceOver/TalkBack still announce which option is the
 *   saved answer. `onChange` is `undefined` in this mode - nothing is
 *   wired to fire on interaction (React does not warn about a missing
 *   onChange on a controlled input when `disabled` is true - this is an
 *   intentional, documented React exemption, not a suppressed warning).
 *   The hover/press affordances (hover:bg-white/10, active:scale-[0.98],
 *   cursor-pointer) are also dropped in this mode, since nothing happens
 *   on press - a non-interactive control should not visually invite a
 *   press.
 */
// Evening journey-theme correction — replaces the old accent-keyed
// ACCENT_TOKENS (peach for 'reflection'/'gratitude', a hardcoded
// evening-accent unselected state regardless of accent) with the same
// shared journeyTone.js token map every other journey-aware selectable
// control in this app already uses (BreathingPatternRow/
// MeditationSetupPanel/MovementCheckboxRow). 'primary' is byte-identical
// to the old reflection/gratitude tokens (bg-primary/10 border-primary
// selected, text-primary label, border-primary bg-primary radio fill,
// bg-on-primary dot) - so a caller passing no journeyTone at all keeps
// the exact original peach look; 'evening' is the real fix Reflection/
// Gratitude now opt into explicitly.
import { getJourneyToneTokens } from '../../lib/journeyTone';

export const AnswerOptionButton = ({ label, selected, onClick, journeyTone = 'primary', groupName, readOnly = false }) => {
  const tokens = getJourneyToneTokens(journeyTone);

  return (
    <label
      className={`flex items-center justify-between gap-2 w-full min-h-[64px] px-3 py-3 rounded-2xl border text-left transition-all duration-150 has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        readOnly ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'
      } ${
        selected
          ? tokens.selectedRow
          : readOnly
            ? tokens.unselectedRow.replace(' hover:bg-white/10', '')
            : tokens.unselectedRow
      }`}
    >
      <input
        type="radio"
        name={groupName}
        checked={selected}
        onChange={readOnly ? undefined : onClick}
        disabled={readOnly}
        className="sr-only"
      />
      <span className={`block text-sm leading-snug ${selected ? tokens.selectedLabel : 'text-on-surface font-medium'}`}>
        {label}
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
