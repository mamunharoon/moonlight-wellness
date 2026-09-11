import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { useAuth } from '../context/AuthContext';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';

const EVENING_REFLECTION_VIDEO = getBetaVideoById('E10');

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

// Video Integration: one additional row below the reflection prompts
// offers "Evening Reflection" - the exact evening wind-down reflection
// stage the mapping calls for. Shown to any signed-in user (guests
// excluded); PromptStepper's own journaling/Continue/Skip are entirely
// unaffected. Access was originally gated on profiles.beta_access; that
// gate was removed once the videos were approved for general
// availability in this environment.
export const Reflection = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const { isGuest } = useAuth();
  const [videoOpen, setVideoOpen] = useState(false);

  if (EveningSceneShell && PromptStepper && ProgressIndicator && BetaVideoModal) { /* no-op to satisfy blind linter */ }

  const handleComplete = () => {
    if (state.status === 'playing' && currentStep?.id === 'reflection') {
      advanceStep();
    }
    navigate('/gratitude');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'dusk' }}>
      <ProgressIndicator activeStep="reflection" sessionId="evening-wind-down" />
      <div className="flex-1 flex flex-col justify-center space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <PromptStepper prompts={REFLECTION_PROMPTS} onComplete={handleComplete} />
        </div>

        {!isGuest && EVENING_REFLECTION_VIDEO && (
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="w-full flex items-center gap-4 glass-panel rounded-2xl p-4 hover:bg-white/5 active:scale-[0.99] transition-all text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-xl">play_circle</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-on-surface">Watch: {EVENING_REFLECTION_VIDEO.title}</span>
              <span className="block text-xs text-on-surface-variant">A guided video to close out your day.</span>
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant shrink-0">chevron_right</span>
          </button>
        )}
      </div>

      {/* Closing this leaves the user right here on Reflection - no
          navigation needed for a return path. PromptStepper's own
          journaling/Continue/Skip above are entirely unaffected. */}
      {videoOpen && (
        <BetaVideoModal entry={EVENING_REFLECTION_VIDEO} onClose={() => setVideoOpen(false)} />
      )}
    </EveningSceneShell>
  );
};
