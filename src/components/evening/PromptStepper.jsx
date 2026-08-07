import { useState } from 'react';

/*
 * Stage 4 Batch F2 — PromptStepper
 *
 * Generic "one question per screen" sub-stepper, meant to be reused by
 * both Reflection and Gratitude (F4, not this batch) instead of each
 * writing its own 3-question pagination logic. Mirrors the precedent
 * already proven in MorningFlow.jsx: several small steps nested inside
 * ONE Session Engine step, using local component state for the
 * sub-navigation rather than creating extra Session Engine steps for
 * every individual question.
 *
 * Purely presentational/local-state — no Session Engine, no Supabase,
 * no navigation. The parent page owns what happens with each answer
 * (e.g. writing to journal_entries) and what happens after the final
 * prompt (e.g. advanceStep()) via onComplete. Not wired into any real
 * screen yet — this batch is shared infrastructure only.
 *
 * PROPS
 *   prompts     array of { id, label, placeholder? } — rendered one at
 *               a time, in order.
 *   onChange    (promptId, value) => void, optional. Called on every
 *               keystroke for the currently active prompt.
 *   onComplete  (answers) => void, optional. Called once, when Next or
 *               Skip is pressed on the final prompt. `answers` is a
 *               { [promptId]: value } map of everything entered —
 *               skipped prompts are simply absent from the map.
 *
 * Previous/Next/Skip reuse the same button styling already established
 * by every existing morning page (glass-panel for secondary actions,
 * bg-primary for the primary action) — no new visual language invented.
 */
export const PromptStepper = ({ prompts, onChange, onComplete }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const activePrompt = prompts[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === prompts.length - 1;

  if (!activePrompt) return null;

  const handleValueChange = (value) => {
    setAnswers((prev) => ({ ...prev, [activePrompt.id]: value }));
    onChange?.(activePrompt.id, value);
  };

  const goPrevious = () => {
    if (isFirst) return;
    setActiveIndex((i) => i - 1);
  };

  // Next keeps whatever was typed for the active prompt (already synced into
  // `answers` via handleValueChange on every keystroke) and advances.
  const handleNext = () => {
    if (isLast) {
      onComplete?.(answers);
      return;
    }
    setActiveIndex((i) => i + 1);
  };

  // Skip is distinct from Next: it discards any value typed for the active
  // prompt before advancing, so a skipped prompt is genuinely skipped, not
  // silently recorded — matching the design intent that Skip stays a real
  // "leave this one blank" affordance, not a same-effect alias for Next.
  const handleSkip = () => {
    const rest = { ...answers };
    delete rest[activePrompt.id];
    setAnswers(rest);
    if (isLast) {
      onComplete?.(rest);
      return;
    }
    setActiveIndex((i) => i + 1);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="text-center space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant/60 font-bold">
          {activeIndex + 1} of {prompts.length}
        </p>
        <h2 className="font-serif italic text-2xl text-on-surface">{activePrompt.label}</h2>
      </div>

      <textarea
        value={answers[activePrompt.id] ?? ''}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder={activePrompt.placeholder ?? ''}
        rows={4}
        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary focus:border-transparent outline-none resize-none"
      />

      <div className="flex gap-3">
        {!isFirst && (
          <button
            onClick={goPrevious}
            className="flex-1 py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Previous</span>
          </button>
        )}
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
        className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
      >
        Skip
      </button>
    </div>
  );
};
