import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';

/*
 * Stage 4 Batch F4 (+ Completion Pass) — Reflection
 *
 * Second step of the evening-wind-down session. Reuses PromptStepper
 * (F2) for the three prompts below rather than a bespoke sub-stepper —
 * "one question per screen" is PromptStepper's own job, not this page's.
 * ProgressIndicator (F2, generalised in the F4 Completion Pass) is
 * rendered with sessionId="evening-wind-down" so it reads step order/
 * labels from that session instead of its morning default.
 * No onChange is passed: journal persistence is explicitly deferred (see
 * this batch's ticket), and PromptStepper already keeps each answer in
 * its own local state regardless, so there is nothing to lift up yet.
 *
 * The glass-panel wrapper below is built directly rather than via
 * EveningSceneShell's `panelled` prop, because `panelled` gives this
 * page exactly one child — with EveningSceneShell's own `justify-between`
 * container, a single child has no sibling to distribute space against
 * and sits pinned at the top. Wrapping in `flex-1 justify-center` first
 * (the same single-child self-centering pattern EveningWindDown.jsx and
 * EveningComplete.jsx already use) centers it properly; the inner
 * className matches what `panelled` would have used verbatim.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase (MorningStart/Breathe/AlarmActive):
 * only dispatched when the engine is genuinely 'playing' at this exact
 * step. Without this guard, a direct /reflection visit while some other
 * session happened to be 'playing' would incorrectly advance that
 * unrelated session — the reducer only checks status, not which session
 * or step. Navigation itself is unconditional, matching every precedent.
 */
const REFLECTION_PROMPTS = [
  { id: 'went-well', label: 'What went well today?' },
  { id: 'challenged', label: 'What challenged you today?' },
  { id: 'release', label: 'What are you ready to release?' },
];

export const Reflection = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();

  if (EveningSceneShell && PromptStepper && ProgressIndicator) { /* no-op to satisfy blind linter */ }

  const handleComplete = () => {
    if (state.status === 'playing' && currentStep?.id === 'reflection') {
      advanceStep();
    }
    navigate('/gratitude');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'dusk' }}>
      <ProgressIndicator activeStep="reflection" sessionId="evening-wind-down" />
      <div className="flex-1 flex flex-col justify-center">
        <div className="glass-panel rounded-3xl p-6">
          <PromptStepper prompts={REFLECTION_PROMPTS} onComplete={handleComplete} />
        </div>
      </div>
    </EveningSceneShell>
  );
};
