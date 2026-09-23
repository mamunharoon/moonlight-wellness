/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { AnswerOptionButton } from './AnswerOptionButton';

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
export const EveningEditQuestion = ({ prompt, questionNumber, totalQuestions, value, accent, groupName, onSelectPreset, onCustomChange }) => {
  const selectedOption = prompt.options?.find((option) => option === value) ?? null;
  const [isCustomOpen, setIsCustomOpen] = useState(Boolean(value && !selectedOption));

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

      <div className="space-y-3" role="radiogroup" aria-label={prompt.label}>
        {prompt.options?.map((option) => (
          <AnswerOptionButton
            key={option}
            label={option}
            selected={selectedOption === option}
            onClick={() => handleSelectPreset(option)}
            accent={accent}
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
            // Build 15 Evening UX correction — Gratitude's "Add your own"
            // toggle now matches Reflection's peach exactly, same as
            // AnswerOptionButton's own selected-state tokens.
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
            id={`${prompt.id}-edit-custom-field`}
            value={value}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Write your own answer..."
            rows={3}
            className="mt-2 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary focus:border-transparent outline-none resize-none"
          />
        )}
      </div>
    </div>
  );
};
