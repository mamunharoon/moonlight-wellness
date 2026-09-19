/* eslint-disable no-unused-vars */
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { getAffirmationForIntention } from '../lib/intentionAffirmations';
import { BackButton } from '../components/BackButton';

/*
 * Morning-flow redesign — Affirm step (now Step 4 of 4, after Breathe).
 *
 * Previously this screen showed one fixed generic quote plus optional
 * guided-video rows (E07/E11/E12/E21/E22/E24/E26, A01-A06) requiring a
 * video choice before continuing. Per the approved redesign: the screen
 * now automatically shows one affirmation matched to the user's own
 * selected Morning intention (IntentionSetup.jsx, now Step 1) - no video
 * choice, nothing to tap before Continue. The removed videos are not
 * deleted (see docs/... none needed - lib/mediaCatalog.js's own
 * MORNING-FLOW REDESIGN REACHABILITY UPDATE comment): every one of them
 * remains fully browsable and playable via Library, exactly like every
 * other id whose `page` metadata is null.
 *
 * Also previously branched to skip Stretching for routineDuration ===
 * 'quick' - that branch point moved to IntentionSetup.jsx's own
 * handleComplete now that Intention comes before Stretch instead of
 * after it. This screen (the last content step before Complete, in every
 * routine duration) now always advances straight to Complete.
 */
export const Affirmation = () => {
  const navigate = useNavigate();
  const { setJourneyStep, intentions } = useAlarm();
  const { state, currentStep, advanceStep, abandonSession } = useSession();

  const affirmation = getAffirmationForIntention(intentions[0]);

  // Mirror only when the engine is genuinely playing at the 'affirmation'
  // step — a direct-route visit with no active session, or a mismatched
  // mirror, silently does nothing here.
  const mirrorTransition = () => {
    if (state.status !== 'playing' || currentStep?.id !== 'affirmation') return;
    advanceStep();
  };

  const handleNext = () => {
    setJourneyStep('complete');
    navigate('/session-complete');
    mirrorTransition();
  };

  // Same real action as Continue — this step has no separate content to
  // skip past (an automatically-shown affirmation, read at a glance),
  // matching this routine's own established Skip-equals-Continue pattern
  // (IntentionSetup.jsx's own Skip button behaves identically).
  const handleSkip = handleNext;

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'affirmation') abandonSession();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10">
      <div className="flex items-center gap-3">
        <BackButton fallback="/breathe" />
      </div>
      <ProgressIndicator activeStep="affirmation" />

      <div className="my-auto space-y-12 text-center relative overflow-hidden p-6 rounded-3xl bg-gradient-to-tr from-[#fffdfa] via-[#fff5f2] to-[#ffebd2] border border-primary/10 shadow-[0_8px_30px_rgba(149,72,53,0.04)]">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <span className="material-symbols-outlined text-9xl">wb_sunny</span>
        </div>

        <div className="space-y-6 relative z-10">
          <span className="material-symbols-outlined text-primary text-4xl animate-pulse">auto_awesome</span>
          <h2 className="text-3xl font-extrabold text-[#954835] leading-tight tracking-tight px-2">
            Today is a fresh beginning.
          </h2>
          <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed font-medium">
            "{affirmation}"
          </p>
        </div>
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={handleNext}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <span>Continue</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleSkip}
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
  );
};
