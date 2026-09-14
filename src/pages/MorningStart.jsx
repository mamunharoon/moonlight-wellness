/* eslint-disable no-unused-vars */
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';

// Each { id, blurb } pairs a manifest entry with this page's own short,
// contextual line (distinct from the manifest's generic description,
// matching the pattern already established for E06 here). Order is
// display order on the page - E06 first since it was already here,
// E13-E15 appended in the order they were assigned to this screen.
const MORNING_START_VIDEOS = [
  { id: 'E06', blurb: 'A soft guided start before you begin.' },
  { id: 'E13', blurb: 'A guided video to sharpen your focus for the day ahead.' },
  { id: 'E14', blurb: 'A guided video to help you find momentum this morning.' },
  { id: 'E15', blurb: 'A guided video for a clean, hopeful start.' }
];

/*
 * Rise & Reset double-start repair
 *
 * This page used to be a second, separate "Begin your morning" decision
 * screen — its own routine-duration summary, its own optional video
 * cards, its own Begin/Skip Routine buttons — reached by tapping
 * RoutineDetail's Start Routine (which already shows the exact same
 * duration/steps summary). Pressing Start Routine then landing on
 * another near-identical screen with another Begin button read as
 * "Start Routine didn't do anything." That duplicate summary card is
 * gone; this is now simply Step 1 of the routine — "Gentle Awakening" —
 * with the same ProgressIndicator/Back/Continue/Skip-this-step/Exit
 * pattern every other step in this routine uses (Affirmation.jsx,
 * MorningFlow.jsx, Breathe.jsx, IntentionSetup.jsx).
 *
 * RoutineDetail.jsx now starts the Session Engine itself
 * (startSession('morning-routine', { startIndex: <'start' step> }))
 * before navigating here, so state.status is already 'playing' with
 * currentStep.id === 'start' by the time this page renders — Continue
 * below advances that real, tracked session exactly like every other
 * step's Continue does. A direct /morning-start visit with no active
 * session (or the real alarm-triggered flow, which starts at 'alarm'
 * and reaches this page once the user taps through) still works
 * unconditionally via the guarded advanceStep()/setJourneyStep() calls
 * below, unchanged from before.
 *
 * The Morning Library videos below remain exactly where they were —
 * this step's own optional extra content, not a pre-start decision.
 */
export const MorningStart = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

  if (BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  const isActiveStep = state.status === 'playing' && currentStep?.id === 'start';

  const handleContinue = () => {
    setJourneyStep('affirmation');
    navigate('/affirmation');
    if (isActiveStep) advanceStep();
  };

  // Skip this step: same destination as Continue — this step has no
  // content of its own to complete (a guided welcome, read at a glance),
  // so "skip it" and "continue past it" are the same real action, same
  // as Affirmation.jsx's own existing Skip button.
  const handleSkipStep = handleContinue;

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (isActiveStep) abandonSession();
  };

  return (
    <div className="min-h-[85vh] flex flex-col py-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/routines/rise-reset" />
      </div>

      <ProgressIndicator activeStep="start" />

      <div className="flex-1 flex flex-col justify-between space-y-10">
        <div className="space-y-6 text-center my-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <span className="material-symbols-outlined text-3xl">wb_sunny</span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Step 1 of 5 · Gentle Awakening</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Begin your morning.</h2>
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
              Take a few minutes to connect with yourself and set a peaceful tone for your day.
            </p>
          </div>

          <div className="w-full max-w-sm mx-auto space-y-3">
            {MORNING_START_VIDEOS.map(({ id, blurb }) => {
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

        <div className="space-y-3 w-full">
          <button
            onClick={handleContinue}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span>Continue</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
          <button
            onClick={handleSkipStep}
            className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
          >
            Skip this step
          </button>
          <button
            onClick={handleExitRoutine}
            className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-2"
          >
            Exit routine
          </button>
        </div>
      </div>

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}
      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
    </div>
  );
};
