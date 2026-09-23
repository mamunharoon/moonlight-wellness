/*
 * Phase 3 UX correction — AnswerOptionButton
 *
 * Physical-device feedback: the original preset controls (SelectionChip/
 * SelectionRow, shared with ChangeIntention/AnytimeReset/Meditate) read as
 * small tick/chevron controls on a real iPhone, not as clear, tappable
 * buttons. Rather than change SelectionChip/SelectionRow themselves (which
 * would also change those three unrelated, already-shipped screens), this
 * is a NEW component used only by Reflection/Gratitude's tap-first
 * questions (via PromptStepper) - every other caller of SelectionChip/
 * SelectionRow is completely untouched.
 *
 * Selected state is a genuinely filled, coloured button (never a tick/
 * checkmark, never a navigation chevron) - `accent` picks which section's
 * colour: 'reflection' reuses the app's own existing primary/on-primary
 * tokens (WakeWise's own peach/coral, already contrast-paired and already
 * used for every primary CTA - not a second, barely-different peach);
 * 'gratitude' uses the new gratitude-accent/on-gratitude-accent pair (see
 * index.css) - a warm sunrise gold with no prior token in this app.
 *
 * Selection is never colour-only: selected also gets a stronger border,
 * bold weight, and a subtle inset/pressed shadow - aria-pressed carries
 * the real semantic state for VoiceOver/screen readers.
 *
 * `centered` (default false) mirrors PromptStepper's own layout choice -
 * true for the 2-column grid (a narrower, squarish tile reads better with
 * centered text), false for full-width rows (a wide rectangle reads better
 * left-aligned) - purely a text-alignment difference, the button's own
 * sizing/colour contract is identical either way.
 */
const ACCENT_SELECTED_CLASSES = {
  reflection: 'bg-primary border-primary text-on-primary',
  gratitude: 'bg-gratitude-accent border-gratitude-accent text-on-gratitude-accent'
};

export const AnswerOptionButton = ({ label, selected, onClick, accent = 'reflection', centered = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`w-full min-h-[52px] px-5 py-3 rounded-2xl border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] ${
      centered ? 'text-center' : 'text-left'
    } ${
      selected
        ? `${ACCENT_SELECTED_CLASSES[accent]} font-bold shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)]`
        : 'bg-surface-container border-white/15 text-on-surface font-medium hover:bg-white/10'
    }`}
  >
    <span className="block text-sm leading-snug">{label}</span>
  </button>
);
