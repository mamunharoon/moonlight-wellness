import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';

/*
 * Stage 4 Batch F4/F6 — Gratitude
 *
 * Third step of the evening-wind-down session. Structurally identical to
 * Reflection.jsx (see that file's own doc comment for the glass-panel/
 * centering, no-onChange, and ProgressIndicator reasoning — journal/
 * database/storage persistence are all explicitly deferred for this
 * screen too).
 *
 * F4 had this jump straight to 'completion' via advanceToStep, since
 * Breathing/Sleep Preparation had no pages yet. Now that EveningBreathing
 * exists (F6), completing the final prompt advances one real step at a
 * time via advanceStep() instead — gratitude -> breathing is immediately
 * adjacent, so advanceStep() is correct here, same change already made
 * to EveningWindDown.jsx in F4.
 */
const GRATITUDE_PROMPTS = [
  { id: 'appreciated-moment', label: 'Name one moment you appreciated today.' },
  { id: 'who-made-better', label: 'Who made your day better?' },
  { id: 'grateful-now', label: 'What are you grateful for right now?' },
];

export const Gratitude = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();

  if (EveningSceneShell && PromptStepper && ProgressIndicator) { /* no-op to satisfy blind linter */ }

  const handleComplete = () => {
    if (state.status === 'playing' && currentStep?.id === 'gratitude') {
      advanceStep();
    }
    navigate('/evening-breathing');
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
