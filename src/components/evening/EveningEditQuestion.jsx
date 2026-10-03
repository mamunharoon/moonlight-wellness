/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { AnswerOptionButton } from './AnswerOptionButton';
import { getJourneyToneTokens } from '../../lib/journeyTone';
import { getOptionPresentation } from '../../lib/eveningOptionPresentation';
import { decodeMultiAnswer, encodeMultiAnswer, toggleMultiSelectOption, NOT_SURE_YET_OPTION, MULTI_SELECT_INSTRUCTION } from '../../lib/eveningJourneyQuestions';

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
 * seeds fresh for each question - the same "expand only if the draft
 * already carries custom text" rule EveningReviewQuestion/PromptStepper
 * both already use, just re-derived once per question instead of once
 * per app-wide answer map.
 *
 * Evening Reflection/Gratitude multiple-selection enhancement — this
 * question (like the live journey and Review) is always multi-select
 * now; `value` is decoded via decodeMultiAnswer (the same backward-
 * compatible single-string encoding PromptStepper.jsx uses) rather than
 * compared directly against `prompt.options`. `onSelectPreset`/
 * `onCustomChange` keep their original names and signatures - each still
 * just receives the one new full draft STRING to write - only what gets
 * passed through them changed, from a bare tapped option to the
 * re-encoded `{ selections, custom }` pair.
 */
export const EveningEditQuestion = ({ prompt, questionNumber, totalQuestions, value, journeyTone = 'primary', groupName, onSelectPreset, onCustomChange }) => {
  const decoded = decodeMultiAnswer(prompt, value);
  const [isCustomOpen, setIsCustomOpen] = useState(Boolean(decoded.custom));
  const tokens = getJourneyToneTokens(journeyTone);
  const textareaFocusRing = TEXTAREA_FOCUS_RING[journeyTone] ?? TEXTAREA_FOCUS_RING.primary;

  const handleToggleOption = (option) => {
    const nextSelections = toggleMultiSelectOption(decoded.selections, option);
    const nextCustom = nextSelections.includes(NOT_SURE_YET_OPTION) ? '' : decoded.custom;
    onSelectPreset(encodeMultiAnswer({ selections: nextSelections, custom: nextCustom }));
  };

  const handleCustomTextChange = (text) => {
    const nextSelections = text.trim() ? decoded.selections.filter((s) => s !== NOT_SURE_YET_OPTION) : decoded.selections;
    onCustomChange(encodeMultiAnswer({ selections: nextSelections, custom: text }));
  };

  return (
    <div className="space-y-6 w-full">
      <div className="text-center space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant font-bold">
          {questionNumber} of {totalQuestions}
        </p>
        <h2 className="font-serif italic text-2xl text-on-surface">{prompt.label}</h2>
        <p className="text-xs text-on-surface-variant/80 font-semibold">{MULTI_SELECT_INSTRUCTION}</p>
      </div>

      {/* Compact two-column layout (Build 16): identical grid treatment to
          the live journey's own PromptStepper.jsx. Evening Reflection/
          Gratitude multiple-selection enhancement — every option is now a
          real checkbox (AnswerOptionButton's own `multi` prop), `selected`
          comes from the decoded `selections` array (more than one may be
          checked at once), and the container role is "group" rather than
          "radiogroup", matching native semantics for independent
          checkboxes. Still backed by a local draft instead of an
          immediate write, so Cancel remains honest. See PromptStepper.jsx's
          own doc comment for the real measured 320px numbers this shares
          (no narrow-screen fallback needed - genuine testing showed it
          stays readable at 320px). */}
      <div className="grid grid-cols-2 gap-3" role="group" aria-label={prompt.label}>
        {prompt.options?.map((option) => {
          const presentation = getOptionPresentation(prompt.id, option);
          return (
            <AnswerOptionButton
              key={option}
              label={presentation.label}
              descriptor={presentation.descriptor}
              selected={decoded.selections.includes(option)}
              onClick={() => handleToggleOption(option)}
              journeyTone={journeyTone}
              groupName={groupName}
              multi
            />
          );
        })}
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
            value={decoded.custom}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            placeholder="Write your own answer..."
            rows={3}
            className={`mt-2 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:ring-1 ${textareaFocusRing} focus:border-transparent outline-none resize-none`}
          />
        )}
      </div>
    </div>
  );
};
