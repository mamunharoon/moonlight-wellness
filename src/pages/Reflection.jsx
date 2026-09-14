/* eslint-disable no-unused-vars */
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';

// Each { id, blurb } pairs a manifest entry with this page's own short,
// contextual line, matching the pattern already established for E10
// here. E10 first since it was already here, E19 appended in the order
// it was assigned to this screen.
const REFLECTION_VIDEOS = [
  { id: 'E10', blurb: 'A guided video to close out your day.' },
  { id: 'E19', blurb: "A guided video to help you release what isn't yours to carry." },
  { id: 'E23', blurb: 'A guided video for a quiet moment of gratitude.' },
  { id: 'E25', blurb: 'A guided video for hope and healing.' }
];

// M01-M05: a distinct "Meditation Sessions" collection, kept in its own
// array/section (with its own heading) rather than merged into
// REFLECTION_VIDEOS above, matching the pattern already established for
// the A-series "Affirmation Sessions", B-series "Breathing Sessions" and
// G-series "Grounding Sessions" sections. No dedicated Meditation page
// exists in the app, so this page - the evening wind-down's own
// reflection step - is the closest existing contextual home for
// mindfulness/body-scan/loving-kindness/gratitude/guided-reflection
// content.
const MEDITATION_SESSION_VIDEOS = [
  { id: 'M01', blurb: 'A guided mindfulness meditation.' },
  { id: 'M02', blurb: 'A guided body scan meditation.' },
  { id: 'M03', blurb: 'A guided loving kindness meditation.' },
  { id: 'M04', blurb: 'A guided meditation for gratitude.' },
  { id: 'M05', blurb: 'A guided meditation for quiet reflection.' }
];

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

// Video Integration: additional rows below the reflection prompts offer
// "Evening Reflection" and "Letting Go" - the exact evening wind-down
// reflection stage the mapping calls for. Shown to any signed-in user
// (guests excluded); PromptStepper's own journaling/Continue/Skip are
// entirely unaffected. Access was originally gated on
// profiles.beta_access; that gate was removed once these videos were
// approved for general availability in this environment.
export const Reflection = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

  if (EveningSceneShell && PromptStepper && ProgressIndicator && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  const handleComplete = () => {
    if (state.status === 'playing' && currentStep?.id === 'reflection') {
      advanceStep();
    }
    navigate('/gratitude');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'dusk' }} showBack backFallback="/evening-wind-down">
      <ProgressIndicator activeStep="reflection" sessionId="evening-wind-down" />
      <div className="flex-1 flex flex-col justify-center space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <PromptStepper prompts={REFLECTION_PROMPTS} onComplete={handleComplete} />
        </div>

        {REFLECTION_VIDEOS.map(({ id, blurb }) => {
          const entry = getBetaVideoById(id);
          if (!entry) return null;
          return (
            <BetaVideoRow
              key={id}
              title={entry.title}
              description={blurb}
              onClick={() => handleSelect(id)}
            />
          );
        })}

        <div className="space-y-3">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Meditation Sessions</h3>
          {MEDITATION_SESSION_VIDEOS.map(({ id, blurb }) => {
            const entry = getBetaVideoById(id);
            if (!entry) return null;
            return (
              <BetaVideoRow
                key={id}
                title={entry.title}
                description={blurb}
                onClick={() => handleSelect(id)}
              />
            );
          })}
        </div>
      </div>

      {/* Closing this leaves the user right here on Reflection - no
          navigation needed for a return path. PromptStepper's own
          journaling/Continue/Skip above are entirely unaffected. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}
      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
    </EveningSceneShell>
  );
};
