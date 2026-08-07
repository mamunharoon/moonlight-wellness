import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { ProgressIndicator } from '../components/ProgressIndicator';

/*
 * Stage 4 Batch F6 — PrepareForRest
 *
 * Fifth (terminal-before-completion) step of the evening-wind-down
 * session. "Prepare for Rest" — deliberately not a clinical label like
 * "Sleep Hygiene Checklist". REST_ITEMS below are static, presentational
 * only: no local state, no persistence, no database write, no
 * gamification, per this batch's explicit requirements — there is
 * nothing to check off, only four short lines to read.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase — see Reflection.jsx's own doc comment
 * for the full reasoning. sleepPreparation -> completion is immediately
 * adjacent, so advanceStep() (not advanceToStep) is correct here.
 */
const REST_ITEMS = [
  { icon: 'smartphone', text: 'Put your phone down soon.' },
  { icon: 'water_drop', text: 'Have a little water.' },
  { icon: 'lightbulb', text: 'Dim the room.' },
  { icon: 'nights_stay', text: 'Let the day finish.' },
];

export const PrepareForRest = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();

  if (EveningSceneShell && ProgressIndicator) { /* no-op to satisfy blind linter */ }

  const handleContinue = () => {
    if (state.status === 'playing' && currentStep?.id === 'sleepPreparation') {
      advanceStep();
    }
    navigate('/evening-complete');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <ProgressIndicator activeStep="sleepPreparation" sessionId="evening-wind-down" />

      <div className="flex-1 flex flex-col justify-center space-y-8">
        <h1 className="font-serif italic text-3xl text-on-surface text-center">Prepare for Rest</h1>

        <div className="space-y-4">
          {REST_ITEMS.map((item) => (
            <div key={item.text} className="flex items-center gap-4 glass-panel rounded-2xl p-4">
              <span className="material-symbols-outlined text-primary text-2xl">{item.icon}</span>
              <p className="text-sm text-on-surface">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>Continue</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </EveningSceneShell>
  );
};
