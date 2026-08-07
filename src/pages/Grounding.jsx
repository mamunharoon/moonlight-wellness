import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';

/*
 * Solas — Support & Calm, Sprint 1 Phase 1: Grounding (5-4-3-2-1)
 *
 * Deliberately not built on PromptStepper (src/components/evening/
 * PromptStepper.jsx): that component always renders a text input and
 * treats Skip as "discard this answer, advance one" — neither fits here.
 * The 5-4-3-2-1 exercise captures nothing (it's a noticing exercise, not
 * a journal prompt) and this flow's Skip means "leave the exercise
 * entirely," not "leave this one prompt blank." Reusing it would mean
 * either bending its contract or shipping an unused textarea, so a small
 * local stepper is the more honest fit — not a rejection of reuse, just
 * this component's contract doesn't match this exercise's shape.
 *
 * "Progress is felt, not counted": no "step 2 of 5" label is shown. The
 * countdown itself (5, 4, 3, 2, 1) already carries that sense — adding a
 * second, separate progress readout on top of it would be exactly the
 * kind of counted-progress UI the principle warns against.
 */
const PROMPTS = [
  { id: 'see', count: 5, icon: 'visibility', text: 'Five things you can see.' },
  { id: 'feel', count: 4, icon: 'back_hand', text: 'Four things you can feel.' },
  { id: 'hear', count: 3, icon: 'hearing', text: 'Three things you can hear.' },
  { id: 'smell', count: 2, icon: 'air', text: 'Two things you can smell.' },
  { id: 'notice', count: 1, icon: 'self_improvement', text: 'One thing you can notice.' }
];

export const Grounding = () => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  const active = PROMPTS[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === PROMPTS.length - 1;

  const goPrevious = () => {
    if (isFirst) return;
    setActiveIndex((i) => i - 1);
  };

  // Next moves through the exercise one sense at a time; on the final
  // prompt it finishes the exercise like any other page's primary action.
  const handleNext = () => {
    if (isLast) {
      navigate('/support-complete');
      return;
    }
    setActiveIndex((i) => i + 1);
  };

  // Skip is an exit from the whole exercise, not a per-prompt discard —
  // see the file-level note above. Always lands on the completion screen
  // regardless of which prompt is active.
  const handleSkip = () => {
    navigate('/support-complete');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <div
          key={active.id}
          className="w-24 h-24 rounded-full glass-panel border-white/10 flex items-center justify-center text-primary text-4xl font-bold"
          aria-hidden="true"
        >
          {active.count}
        </div>
        <div className="space-y-3">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-2xl">{active.icon}</span>
          <h1 className="font-serif italic text-2xl text-on-surface max-w-xs mx-auto leading-snug">
            {active.text}
          </h1>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-3">
          {!isFirst && (
            <button
              onClick={goPrevious}
              className="flex-1 py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Previous</span>
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <span>{isLast ? 'Continue' : 'Next'}</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
        <button
          onClick={handleSkip}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Skip
        </button>
      </div>
    </EveningSceneShell>
  );
};
