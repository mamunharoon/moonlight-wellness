/* eslint-disable no-unused-vars */
import { AnswerOptionButton } from './AnswerOptionButton';
import { decodeMultiAnswer } from '../../lib/eveningJourneyQuestions';
import { getOptionPresentation } from '../../lib/eveningOptionPresentation';

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
 * own `readOnly` mode (a saved selection shows checked and inert, never
 * editable - see that component's own doc comment for the exact native-
 * disabled mechanism), and a saved custom answer renders as a plain,
 * always-expanded, non-editable paragraph - never a textarea, never an
 * "Add your own" toggle, matching the approved read-only presentation
 * requirements exactly.
 *
 * Evening Reflection/Gratitude multiple-selection enhancement — this
 * review is now multi-aware: decodeMultiAnswer (the same backward-
 * compatible single-string decode the live journey and Edit Mode use)
 * returns every selected option (zero, one, or many) plus any custom
 * text, so a legacy single-answer record and a new multi-valued one both
 * render correctly through the exact same code path - never a second,
 * diverging interpretation of the same saved string.
 */
export const EveningReviewQuestion = ({ prompt, questionNumber, totalQuestions, savedValue, journeyTone, groupName }) => {
  const { selections, custom, hasValue } = decodeMultiAnswer(prompt, savedValue);

  return (
    <div className="space-y-6 w-full">
      <div className="text-center space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant font-bold">
          {questionNumber} of {totalQuestions}
        </p>
        <h2 className="font-serif italic text-2xl text-on-surface">{prompt.label}</h2>
      </div>

      {/* Compact two-column layout (Build 16): this read-only presentation
          re-renders the exact same option list/structure the live
          journey and Edit Mode both show (every option, not just the
          saved one - see this file's own doc comment above), so the
          same grid genuinely shortens Review too without changing what
          it truthfully represents: still every option, still exactly
          one (or zero) shown as selected/checked, still fully disabled.
          See PromptStepper.jsx's own doc comment for the real measured
          320px numbers this shares (no narrow-screen fallback needed -
          genuine testing showed it stays readable at 320px). */}
      <div className="grid grid-cols-2 gap-3" role="group" aria-label={prompt.label}>
        {prompt.options?.map((option) => {
          const presentation = getOptionPresentation(prompt.id, option);
          return (
            <AnswerOptionButton
              key={option}
              label={presentation.label}
              descriptor={presentation.descriptor}
              selected={selections.includes(option)}
              journeyTone={journeyTone}
              groupName={groupName}
              multi
              readOnly
            />
          );
        })}
      </div>

      {custom && (
        <div className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 px-1">Your own words</span>
          <p className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-on-surface leading-relaxed">
            {custom}
          </p>
        </div>
      )}

      {!hasValue && (
        <p className="text-sm text-on-surface-variant text-center px-4 py-3">No response was saved for this question.</p>
      )}
    </div>
  );
};
