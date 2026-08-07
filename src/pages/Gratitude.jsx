import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';

/*
 * Stage 4 Batch F4 (+ Completion Pass) — Gratitude
 *
 * Third step of the evening-wind-down session. Structurally identical to
 * Reflection.jsx (see that file's own doc comment for the glass-panel/
 * centering, no-onChange, and ProgressIndicator reasoning — journal/
 * database/storage persistence are all explicitly deferred for this
 * screen too).
 *
 * The one real difference: Breathing and Sleep Preparation (F6, not this
 * batch) still don't have pages, so completing the final prompt here
 * jumps straight to 'completion' via advanceToStep — the same
 * forward-only jump EveningWindDown.jsx used in F3 before Reflection
 * existed. "At this stage: Gratitude -> Completion" per this batch's own
 * ticket; F6 changes this one call to advanceStep() into 'breathing'
 * instead, same as F4 already changed EveningWindDown.jsx's equivalent
 * call this batch.
 */
const GRATITUDE_PROMPTS = [
  { id: 'appreciated-moment', label: 'Name one moment you appreciated today.' },
  { id: 'who-made-better', label: 'Who made your day better?' },
  { id: 'grateful-now', label: 'What are you grateful for right now?' },
];

export const Gratitude = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceToStep } = useSession();

  if (EveningSceneShell && PromptStepper && ProgressIndicator) { /* no-op to satisfy blind linter */ }

  const handleComplete = () => {
    if (state.status === 'playing' && currentStep?.id === 'gratitude') {
      advanceToStep('completion');
    }
    navigate('/evening-complete');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <ProgressIndicator activeStep="gratitude" sessionId="evening-wind-down" />
      <div className="flex-1 flex flex-col justify-center">
        <div className="glass-panel rounded-3xl p-6">
          <PromptStepper prompts={GRATITUDE_PROMPTS} onComplete={handleComplete} />
        </div>
      </div>
    </EveningSceneShell>
  );
};
