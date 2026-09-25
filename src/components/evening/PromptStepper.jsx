/* eslint-disable no-unused-vars */
import { useRef, useState } from 'react';
import { AnswerOptionButton } from './AnswerOptionButton';
import { BetaVideoRow } from '../BetaVideoRow';
import { BetaVideoModal } from '../BetaVideoModal';
import { SignInPromptDialog } from '../SignInPromptDialog';
import { useProtectedVideo } from '../../hooks/useProtectedVideo';
import { getBetaVideoById } from '../../lib/betaVideoManifest';
import { getCachedDurationMinutes } from '../../lib/durationCache';

// Reflection/Gratitude persistence race fix: firing onChange (an async
// Supabase upsert - see routineResponses.js) on every single keystroke,
// with no ordering guarantee between overlapping requests, let a SLOWER
// earlier request's write land in the database AFTER a faster later
// one's - reproduced live typing "A calm walk outside" then reviewing
// back to it: the saved/reloaded value was truncated to "A calm walk
// outsi". Debouncing the onChange call (never the local `answers`
// state, which still updates synchronously on every keystroke so
// handleComplete's own final flush always has the true latest value
// regardless) collapses a burst of keystrokes into one save, which both
// fixes the race in the overwhelming common case and cuts the number of
// writes drastically. Only applies to actual free-text typing - a preset
// tap is a single discrete action, not a keystroke stream, and commits
// immediately (see handleSelectPreset).
const CHANGE_DEBOUNCE_MS = 400;

/*
 * Phase 3 (Reflection/Gratitude tap-first redesign) — PromptStepper
 *
 * Generic "one question per screen" sub-stepper shared by Reflection.jsx
 * and Gratitude.jsx. Each question now shows tap-first preset choices
 * (never a large required-looking text area up front), an optional
 * collapsed custom-answer field, and an optional collapsed guidance
 * disclosure - see each prop's own doc below.
 *
 * CONTROLLED ACTIVE INDEX (Phase 3 back-navigation fix)
 *   `activeIndex` is now owned by the CALLING PAGE, not this component -
 *   the page derives it from an allowlisted `?q=` route param and is the
 *   one thing that actually calls navigate() to move between questions,
 *   so the shared circular BackButton (rendered by EveningSceneShell,
 *   entirely outside this component) can send Back to the exact right
 *   destination - see Reflection.jsx/Gratitude.jsx for the full mapping,
 *   including Gratitude Q1's Back correctly landing on Reflection's own
 *   Q3 rather than its Q1. This component no longer renders its own
 *   in-card "Previous" button at all - Back is the shared control's job
 *   now, exclusively.
 *
 * SINGLE PROTECTED-VIDEO OWNER
 *   This component owns the one `useProtectedVideo()` instance and the
 *   one `<BetaVideoModal>`/guidance `<SignInPromptDialog>` for BOTH
 *   Reflection and Gratitude now - each page no longer instantiates its
 *   own (Reflection.jsx used to; Gratitude.jsx never had guidance at
 *   all). Prevents two competing owners of the same "which video is
 *   open" state from ever existing on one page.
 *
 * SINGLE-SELECT PERSISTENCE (Build 15 - routine_responses stores one
 * plain-text string per question, no schema change this phase)
 *   Exactly one of {a selected preset, custom text} is ever the answer -
 *   never both, never concatenated, never JSON/delimiters/ids. Which one
 *   is "selected" is derived, not separately stored: if the current
 *   answer string exactly equals one of `options`, that chip/row reads
 *   as selected; otherwise (non-empty, no match) it's a custom answer -
 *   this is also how a historical free-text response loads correctly as
 *   a custom answer, and how a historical response that happens to match
 *   a preset's exact wording restores as that preset selected, with zero
 *   extra stored flags. Tapping a different preset always explicitly,
 *   immediately replaces whatever was there (preset or custom) - a
 *   single deterministic rule, no confirmation step, matching every
 *   other tap-to-select control in this app (SelectionChip/SelectionRow
 *   never ask "are you sure" on reselection elsewhere either).
 *
 * PROPS
 *   prompts       array of { id, label, options: string[], guidance?:
 *                 [{ id, blurb }] }. Every question renders its options as
 *                 a single column of full-width AnswerOptionButton radio
 *                 rows (see that component's own doc comment for why the
 *                 earlier 2-column grid was dropped once each row grew a
 *                 right-aligned radio glyph). `guidance` is optional and
 *                 capped at 2 items by the
 *                 calling page's own data - this component renders
 *                 whatever it's given, never invents or pads a third.
 *   activeIndex   number (controlled - see above).
 *   initialAnswers  { [promptId]: value } map, optional. Seeds this
 *                 component's own local answer state ONCE, at mount
 *                 (e.g. previously-saved responses loaded from
 *                 routine_responses). Since the load is async, the
 *                 calling page must wait for it to resolve before ever
 *                 rendering this component - this component itself never
 *                 re-seeds after mount.
 *   onChange      (promptId, value) => void, optional. Called whenever
 *                 the active prompt's answer changes - immediately for a
 *                 preset tap or a Clear, debounced for free-text typing.
 *   onClear       (promptId) => void, optional. Called only after the
 *                 user has explicitly confirmed clearing an existing
 *                 answer - the parent owns the actual delete
 *                 (routineResponses.js's deleteRoutineResponse).
 *   onAdvance     (nextIndex) => void, optional. Called when Next or Skip
 *                 moves off a prompt that is NOT the last one - the
 *                 calling page turns this into a real navigate() to the
 *                 next question's own `?q=` route, which is also what
 *                 makes the shared BackButton land correctly afterward.
 *   onComplete    (answers) => void, optional. Called once, only when
 *                 Next or Skip is pressed on the LAST prompt. `answers`
 *                 is a { [promptId]: value } map of everything entered -
 *                 skipped prompts are simply absent from the map.
 *   accent        'reflection' | 'gratitude' (required) - which section's
 *                 colour AnswerOptionButton uses for a selected answer
 *                 (see that component's own doc comment). Passed straight
 *                 through; this component makes no colour decisions of
 *                 its own.
 */
export const PromptStepper = ({ prompts, activeIndex, initialAnswers, onChange, onClear, onAdvance, onComplete, accent }) => {
  const [answers, setAnswers] = useState(initialAnswers ?? {});
  // Per-prompt "Add your own" disclosure - lazily seeded once at mount so
  // a historical free-text answer (one that doesn't match any preset for
  // its own question) starts already expanded and visible, never hidden
  // behind an extra tap the first time this page loads it.
  const [customOpenByPrompt, setCustomOpenByPrompt] = useState(() => {
    const seed = {};
    for (const p of prompts) {
      const value = (initialAnswers ?? {})[p.id];
      seed[p.id] = Boolean(value && !p.options?.includes(value));
    }
    return seed;
  });
  // Confirm-before-clear and the guidance disclosure are both per-visit,
  // not per-answer state - reset whenever the active question changes so
  // a stray tap left over from the previous question can never confirm-
  // clear or appear expanded on the wrong one. Adjusted directly during
  // render (React's own documented pattern for "reset state when a prop
  // changes" - see "You Might Not Need An Effect") rather than in a
  // useEffect, so this never causes an extra committed/painted render.
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [prevActiveIndex, setPrevActiveIndex] = useState(activeIndex);
  if (activeIndex !== prevActiveIndex) {
    setPrevActiveIndex(activeIndex);
    setConfirmingClear(false);
    setGuidanceOpen(false);
  }

  const debounceTimersRef = useRef({});

  const {
    openVideo,
    handleSelect: handleSelectVideo,
    closeVideo,
    promptOpen: videoPromptOpen,
    dismissPrompt: dismissVideoPrompt,
    confirmSignIn: confirmVideoSignIn,
    confirmCreateAccount: confirmVideoCreateAccount
  } = useProtectedVideo();

  const activePrompt = prompts[activeIndex];
  const isLast = activeIndex === prompts.length - 1;

  if (!activePrompt) return null;

  const currentValue = answers[activePrompt.id] ?? '';
  const hasExistingAnswer = Boolean(currentValue.trim());
  const selectedOption = activePrompt.options?.find((opt) => opt === currentValue) ?? null;
  const isCustomOpen = customOpenByPrompt[activePrompt.id] ?? false;

  const clearPendingSave = (promptId) => {
    clearTimeout(debounceTimersRef.current[promptId]);
    delete debounceTimersRef.current[promptId];
  };

  // A tap is one discrete action, not a keystroke stream - commits and
  // saves immediately, deterministically replacing whatever answer (a
  // different preset or custom text) was there before. Also collapses
  // the custom field, since a preset is now the authoritative answer.
  const handleSelectPreset = (value) => {
    clearPendingSave(activePrompt.id);
    setAnswers((prev) => ({ ...prev, [activePrompt.id]: value }));
    setCustomOpenByPrompt((prev) => ({ ...prev, [activePrompt.id]: false }));
    onChange?.(activePrompt.id, value);
  };

  const handleCustomChange = (value) => {
    const promptId = activePrompt.id;
    setAnswers((prev) => ({ ...prev, [promptId]: value }));
    clearPendingSave(promptId);
    debounceTimersRef.current[promptId] = setTimeout(() => {
      onChange?.(promptId, value);
    }, CHANGE_DEBOUNCE_MS);
  };

  const handleToggleCustom = () => {
    setCustomOpenByPrompt((prev) => ({ ...prev, [activePrompt.id]: !prev[activePrompt.id] }));
  };

  const handleRequestClear = () => setConfirmingClear(true);
  const handleCancelClear = () => setConfirmingClear(false);
  const handleConfirmClear = () => {
    const promptId = activePrompt.id;
    clearPendingSave(promptId);
    setAnswers((prev) => {
      const rest = { ...prev };
      delete rest[promptId];
      return rest;
    });
    setCustomOpenByPrompt((prev) => ({ ...prev, [promptId]: false }));
    setConfirmingClear(false);
    onClear?.(promptId);
  };

  // Next keeps whatever the active prompt's answer currently is (already
  // synced into `answers` via handleSelectPreset/handleCustomChange) and
  // advances - to the next question via onAdvance, or completes via
  // onComplete on the last one.
  const handleNext = () => {
    if (isLast) {
      onComplete?.(answers);
      return;
    }
    onAdvance?.(activeIndex + 1);
  };

  // Skip is distinct from Next: it discards any value for the active
  // prompt (and cancels any pending debounced save for it, so a save
  // scheduled just before Skip can never land afterward and silently
  // resurrect the "skipped" answer) before advancing - a skipped prompt
  // is genuinely skipped, not silently recorded.
  const handleSkip = () => {
    const promptId = activePrompt.id;
    clearPendingSave(promptId);
    const rest = { ...answers };
    delete rest[promptId];
    setAnswers(rest);
    if (isLast) {
      onComplete?.(rest);
      return;
    }
    onAdvance?.(activeIndex + 1);
  };

  const guidanceItems = (activePrompt.guidance ?? [])
    .map(({ id, blurb }) => {
      const entry = getBetaVideoById(id);
      if (!entry) return null;
      const cachedMinutes = getCachedDurationMinutes(id);
      const duration = entry.durationLabel || (cachedMinutes ? `~${cachedMinutes} min` : 'Guided video');
      return { id, entry, blurb, duration };
    })
    .filter(Boolean);

  return (
    // Build 16 physical-iPhone correction (F9, then Decision 3 acceptance
    // correction) — space-y-6 -> space-y-4 -> space-y-3: reduces the
    // vertical gap between this stepper's own top-level sections (heading,
    // answer grid, "Add your own", guidance disclosure, Next, Skip) before
    // touching any font size, per spec. Combines with Reflection.jsx/
    // Gratitude.jsx's own card-padding trim to bring Next within the
    // 390x844/393x852 viewport.
    <div className="space-y-3 w-full">
      {/* Evening colour-contrast fix: the counter was /60 and the
          placeholder /40 - both blend toward whatever's behind them, a
          real WCAG AA failure against the evening gradient's light bands
          even with Gradient.jsx's strengthened scrim (manually verified:
          on-surface-variant at 40-60% opacity there measures ~2-3:1, well
          under the 4.5:1 normal-text floor). This component is only ever
          used by Reflection.jsx/Gratitude.jsx (both evening), so both are
          fixed unconditionally to full-opacity on-surface-variant rather
          than needing a session check like ProgressIndicator's. */}
      <div className="text-center space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant font-bold">
          {activeIndex + 1} of {prompts.length}
        </p>
        <h2 className="font-serif italic text-2xl text-on-surface">{activePrompt.label}</h2>
        <p className="text-xs text-on-surface-variant">Choose the option that feels closest, or add your own.</p>
      </div>

      {/* Compact two-column layout (Build 16): every question now renders
          its options as a 2-column CSS grid rather than the Phase 3
          round-2 single stacked column (that earlier full-width-row
          design was itself a reaction to an even earlier, differently-
          shaped 2-column tile - see AnswerOptionButton.jsx's own doc
          comment for the full history). `gap-3` gives both the row and
          column gap in one utility (12px at this app's default 4px
          scale - the approved "approximately 10-12px gap"). Grid's own
          default `align-items: stretch`/`justify-items: stretch` (never
          overridden) is what makes both cards equal width and equal
          height per row automatically - no explicit sizing needed here
          beyond the column count itself. `activePrompt.layout` is still
          not read here; Reflection's own `went-well` question keeps its
          (redundant, harmless) `layout: 'rows'` field in its data rather
          than editing data that already matches this universal grid.

          Unconditional 2 columns, no narrow-screen fallback: real
          rendered measurement (this app's own actual font/layout, the
          real card width a genuine 224px-wide grid produces at exactly
          320px - see this file's own Build 16 validation report for the
          full numbers) showed every real Reflection/Gratitude option,
          including the single longest ("Stayed calm in a difficult
          moment", 34 characters), stays fully readable and unclipped
          even at 320px - it wraps to 4 lines (one line more than the
          "two/three-line" guideline anticipated for the worst case
          alone; every other option on every question stays within 2-3
          lines), and every card still measures 84px+ tall, comfortably
          above the 64px floor. Since genuine testing did not demonstrate
          the "unacceptable compression" the approved spec's fallback
          clause was conditioned on, no narrow-screen single-column
          carve-out was added - it would only have removed the
          improvement for exactly the smallest real screens it matters
          most on. */}
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={activePrompt.label}>
        {activePrompt.options?.map((option) => (
          <AnswerOptionButton
            key={option}
            label={option}
            selected={selectedOption === option}
            onClick={() => handleSelectPreset(option)}
            accent={accent}
            groupName={activePrompt.id}
          />
        ))}
      </div>

      {/* Optional "Add your own" - collapsed by default, unless the
          loaded answer is a historical custom response (seeded above).
          The textarea is always bound directly to the same single answer
          value every preset chip/row also writes to - editing it is what
          actually deselects a previously-tapped preset (the moment the
          value diverges from every option string), matching the single-
          select persistence contract's own "entering a custom answer
          deselects the preset" rule. */}
      <div>
        {/* Phase 3 UX correction: a static "edit" icon, not a directional
            chevron - this disclosure never navigates anywhere, it only
            reveals the same custom-text field every historical/typed
            answer already used. Expanded state tints icon+label with
            this section's own accent colour (a subtle cue, not a filled
            button) - explicitly never the same treatment as a selected
            preset answer, per "do not make it look like a selected
            preset". */}
        <button
          type="button"
          onClick={handleToggleCustom}
          aria-expanded={isCustomOpen}
          aria-controls={`${activePrompt.id}-custom-field`}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors px-1 min-h-[44px] ${
            // Build 15 Evening UX correction — Gratitude's "Add your own"
            // toggle now matches Reflection's peach exactly, same as
            // AnswerOptionButton's own selected-state tokens; the old
            // accent-branching ternary here is gone since both branches
            // would now be identical.
            isCustomOpen
              ? 'text-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            edit
          </span>
          <span>Add your own</span>
        </button>
        {isCustomOpen && (
          <textarea
            id={`${activePrompt.id}-custom-field`}
            value={currentValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Write your own answer..."
            rows={3}
            className="mt-2 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary focus:border-transparent outline-none resize-none"
          />
        )}
      </div>

      {/* Explicit clear confirmation - only offered when this prompt
          already has a real answer (nothing to clear otherwise).
          Cancelling leaves the existing response completely untouched;
          only the confirm tap calls onClear, which is the parent's own
          signal to delete the stored row (routineResponses.js). */}
      {hasExistingAnswer && (
        confirmingClear ? (
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-xs text-on-surface-variant">Clear this response?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelClear}
                className="px-3 py-1.5 rounded-full glass-panel text-on-surface-variant text-xs font-semibold hover:bg-white/10 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRequestClear}
            className="text-xs text-on-surface-variant/70 hover:text-on-surface-variant transition-colors px-1"
          >
            Clear response
          </button>
        )
      )}

      {/* Optional guidance - collapsed by default on every question, a
          maximum of two real catalogue items (the calling page's own
          data, never padded or invented here). Closing the video leaves
          the user on this exact question with this exact answer/custom-
          field state untouched - BetaVideoModal is only ever mounted
          here, layered on top, never navigating anywhere.

          Evening selectable-control visual refinement (Build 15): moved
          off the generic translucent glass-panel onto the same deep
          surface-container background every Evening row now shares, but
          deliberately kept a neutral white/15 border (not the periwinkle
          evening-accent border) - a disclosure is not an answer choice,
          and must stay recognisably different from a radio/switch row,
          not just visually coordinated with it. Its own expand/collapse
          chevron is unchanged. */}
      {guidanceItems.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setGuidanceOpen((v) => !v)}
            aria-expanded={guidanceOpen}
            aria-controls={`${activePrompt.id}-guidance`}
            className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="text-sm font-semibold text-on-surface">Would some guidance help?</span>
            <span
              className="material-symbols-outlined text-on-surface-variant transition-transform"
              style={{ transform: guidanceOpen ? 'rotate(180deg)' : 'none' }}
              aria-hidden="true"
            >
              expand_more
            </span>
          </button>
          {guidanceOpen && (
            <div id={`${activePrompt.id}-guidance`} className="space-y-2">
              {guidanceItems.map(({ id, entry, blurb, duration }) => (
                <BetaVideoRow
                  key={id}
                  title={entry.title}
                  description={blurb}
                  duration={duration}
                  onClick={() => handleSelectVideo(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleNext}
          className="flex-1 bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>{isLast ? 'Continue' : 'Next'}</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>

      <button
        onClick={handleSkip}
        className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/40"
      >
        Skip
      </button>

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}
      <SignInPromptDialog
        open={videoPromptOpen}
        onSignIn={confirmVideoSignIn}
        onCreateAccount={confirmVideoCreateAccount}
        onDismiss={dismissVideoPrompt}
      />
    </div>
  );
};
