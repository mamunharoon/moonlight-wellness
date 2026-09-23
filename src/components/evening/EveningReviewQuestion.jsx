/* eslint-disable no-unused-vars */
import { AnswerOptionButton } from './AnswerOptionButton';
import { resolveSavedAnswerDisplay } from '../../lib/eveningJourneyQuestions';

/*
 * Evening completed-review — EveningReviewQuestion
 *
 * Read-only presentation of ONE saved Reflection/Gratitude answer, shared
 * by ReflectionReview.jsx/GratitudeReview.jsx. Deliberately does not
 * reuse PromptStepper.jsx - that component's entire reason to exist is
 * managing an EDITABLE answer (preset taps that write, a toggleable
 * custom-text field, Skip, Clear) which is exactly the set of affordances
 * completed review must never expose. This is a much smaller, purely
 * presentational sibling: every option renders via AnswerOptionButton's
 * own `readOnly` mode (a saved selection shows selected and inert, never
 * editable - see that component's own doc comment for the exact native-
 * disabled mechanism), and a saved custom answer renders as a plain,
 * always-expanded, non-editable paragraph - never a textarea, never an
 * "Add your own" toggle, matching the approved read-only presentation
 * requirements exactly.
 *
 * Which of {selected preset, custom answer, nothing saved} to show is
 * derived the same way the live journey already derives it (PromptStepper's
 * own `selectedOption`/`currentValue` logic) - never a second, possibly-
 * diverging interpretation of the same saved string.
 */
export const EveningReviewQuestion = ({ prompt, questionNumber, totalQuestions, savedValue, accent, groupName }) => {
  const { trimmed, hasValue, selectedOption, isCustomAnswer } = resolveSavedAnswerDisplay(prompt, savedValue);

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
            accent={accent}
            groupName={groupName}
            readOnly
          />
        ))}
      </div>

      {isCustomAnswer && (
        <div className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 px-1">Your own words</span>
          <p className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-on-surface leading-relaxed">
            {trimmed}
          </p>
        </div>
      )}

      {!hasValue && (
        <p className="text-sm text-on-surface-variant text-center px-4 py-3">No response was saved for this question.</p>
      )}
    </div>
  );
};
