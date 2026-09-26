/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { AnswerOptionButton } from './AnswerOptionButton';
import { getJourneyToneTokens } from '../../lib/journeyTone';

// journeyTone.js's own focusRing field is the has-[:focus-visible]:ring-X
// form (for a wrapping <label>); this textarea's plain `focus:ring-X`
// variant (matches on click too, not just keyboard focus) needs its own
// literal map for the same reason PromptStepper.jsx's does.
const TEXTAREA_FOCUS_RING = {
  primary: 'focus:ring-primary',
  evening: 'focus:ring-evening-accent',
  morning: 'focus:ring-morning-accent',
  anytime: 'focus:ring-tertiary'
};

/*
 * Edit Tonight's Responses (Build 15) — EveningEditQuestion
 *
 * Interactive presentation of ONE question in Edit Mode. Deliberately NOT
 * a reuse of PromptStepper.jsx: that component calls its own `onChange`
 * immediately (synchronously for a preset tap, debounced for typing),
 * which is exactly the "write straight through" behaviour that would
 * make Edit Mode's Cancel dishonest (see EditEveningResponses.jsx's own
 * doc comment). Every callback here (`onSelectPreset`/`onCustomChange`)
 * only ever updates the PARENT's own local draft state - nothing in this
 * file ever imports or calls anything from routineResponses.js.
 *
 * No Skip, no Clear response, no guidance disclosure - Build 15's
 * approved scope for Edit Mode explicitly excludes all three (clearing
 * an answer to blank would require mixing a delete into the same atomic
 * batch save, deferred to a later enhancement).
 *
 * `value` is this question's current DRAFT answer (may already differ
 * from what's saved). The caller renders this component with
 * `key={prompt.id}` so its own local `isCustomOpen` disclosure state
 * seeds fresh for each question - the same "expand only if the draft is
 * already a non-preset value" rule EveningReviewQuestion/PromptStepper
 * both already use, just re-derived once per question instead of once
 * per app-wide answer map.
 */
export const EveningEditQuestion = ({ prompt, questionNumber, totalQuestions, value, journeyTone = 'primary', groupName, onSelectPreset, onCustomChange }) => {
  const selectedOption = prompt.options?.find((option) => option === value) ?? null;
  const [isCustomOpen, setIsCustomOpen] = useState(Boolean(value && !selectedOption));
  const tokens = getJourneyToneTokens(journeyTone);
  const textareaFocusRing = TEXTAREA_FOCUS_RING[journeyTone] ?? TEXTAREA_FOCUS_RING.primary;

  const handleSelectPreset = (option) => {
    onSelectPreset(option);
    setIsCustomOpen(false);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="text-center space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant font-bold">
          {questionNumber} of {totalQuestions}
        </p>
        <h2 className="font-serif italic text-2xl text-on-surface">{prompt.label}</h2>
      </div>

      {/* Compact two-column layout (Build 16): identical grid treatment to
          the live journey's own PromptStepper.jsx - this is the exact
          same interactive short-option radiogroup (same options, same
          AnswerOptionButton, same single-select semantics), just backed
          by a local draft instead of an immediate write, so the same
          layout stays clear here. See PromptStepper.jsx's own doc
          comment for the real measured 320px numbers this shares (no
          narrow-screen fallback needed - genuine testing showed it
          stays readable at 320px). */}
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={prompt.label}>
        {prompt.options?.map((option) => (
          <AnswerOptionButton
            key={option}
            label={option}
            selected={selectedOption === option}
            onClick={() => handleSelectPreset(option)}
            journeyTone={journeyTone}
            groupName={groupName}
          />
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setIsCustomOpen((v) => !v)}
          aria-expanded={isCustomOpen}
          aria-controls={`${prompt.id}-edit-custom-field`}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors px-1 min-h-[44px] ${
            // Evening journey-theme correction — tints with journeyTone
            // (tokens.text) instead of a hardcoded peach; 'primary'
            // resolves to the exact original text-primary.
            isCustomOpen
              ? tokens.text
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
            id={`${prompt.id}-edit-custom-field`}
            value={value}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Write your own answer..."
            rows={3}
            className={`mt-2 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:ring-1 ${textareaFocusRing} focus:border-transparent outline-none resize-none`}
          />
        )}
      </div>
    </div>
  );
};
