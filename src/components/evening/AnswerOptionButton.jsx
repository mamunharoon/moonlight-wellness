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
 *   primary CTA - not a second, barely-different peach); 'gratitude' uses
 *   the gratitude-accent/on-gratitude-accent pair (see index.css) - a warm
 *   sunrise gold with no prior token in this app.
 *
 * `groupName` scopes the native radio `name` to this question only (its
 * own promptId) so the browser's built-in radio-group behaviour (arrow
 * keys cycle selection within the group, Tab moves in/out as one stop)
 * never leaks across different questions.
 * The old `centered` prop (from the first Phase 3 correction) is gone -
 * PromptStepper no longer offers a 2-column grid at all, since a right-
 * aligned radio glyph plus a left-aligned label needs a full-width row to
 * stay readable; every question now renders one column of these rows.
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
const ACCENT_TOKENS = {
  reflection: { text: 'text-primary', border: 'border-primary', tint: 'bg-primary/10', radioFill: 'border-primary bg-primary', dot: 'bg-on-primary' },
  gratitude: { text: 'text-gratitude-accent', border: 'border-gratitude-accent', tint: 'bg-gratitude-accent/10', radioFill: 'border-gratitude-accent bg-gratitude-accent', dot: 'bg-on-gratitude-accent' }
};

export const AnswerOptionButton = ({ label, selected, onClick, accent = 'reflection', groupName, readOnly = false }) => {
  const tokens = ACCENT_TOKENS[accent];

  return (
    <label
      className={`flex items-center justify-between gap-3 w-full min-h-[52px] px-5 py-3 rounded-2xl border text-left transition-all duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        readOnly ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'
      } ${
        selected
          ? `${tokens.tint} ${tokens.border}`
          : `bg-surface-container border-white/15 ${readOnly ? '' : 'hover:bg-white/10'}`
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
      <span className={`block text-sm leading-snug ${selected ? `${tokens.text} font-bold` : 'text-on-surface font-medium'}`}>
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
          selected ? tokens.radioFill : 'border-on-surface-variant'
        }`}
      >
        {selected && <span className={`absolute inset-0 m-auto w-2 h-2 rounded-full ${tokens.dot}`} />}
      </span>
    </label>
  );
};
