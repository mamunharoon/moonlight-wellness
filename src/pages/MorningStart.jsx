import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { fetchOwnBetaAccess } from '../lib/betaAccess';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';

const GENTLE_AWAKENING_VIDEO = getBetaVideoById('E06');

// Beta Video Integration (E06-E10 batch): one additional, beta-gated row
// offering "Gentle Awakening" right at the morning routine's own entry
// screen - the natural "Rise & Reset" moment, before Begin/Skip Routine.
// Gated on profiles.beta_access the same way as every other integration
// point (Support.jsx/PrepareForRest.jsx); non-beta users and guests see
// this screen completely unchanged. No "Beta" label on the row itself -
// it presents as an ordinary WakeWise exercise, per this batch's
// labeling requirement; that framing stays on /beta only.
export const MorningStart = () => {
  const navigate = useNavigate();
  const { routineDuration, setJourneyStep } = useAlarm();
  // Stage 3C Group 3D Batch A: mirrors the start -> affirmation transition
  // (Begin) and the start -> abandoned transition (Skip Routine) into the
  // Session Engine. See handleBegin/handleSkip below for the only places
  // any of this is used.
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  const { user, isGuest, loading: authLoading } = useAuth();
  const [betaAccess, setBetaAccess] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  if (BetaVideoModal) { /* no-op to satisfy blind linter */ }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (authLoading) return;
      if (isGuest) {
        setBetaAccess(false);
        return;
      }
      const value = await fetchOwnBetaAccess(user.id);
      if (!cancelled) setBetaAccess(value);
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [user, isGuest, authLoading]);

  const getDurationDetails = () => {
    switch (routineDuration) {
      case 'quick':
        return { mins: 2, steps: ['Positive Affirmation', '60-Second Breathing'] };
      case 'extended':
        return { mins: 10, steps: ['Morning Affirmation', 'Stretching Exercises', 'Grounding Breathing', 'Set Intention'] };
      default:
        return { mins: 5, steps: ['Morning Affirmation', 'Stretching Exercises', 'Grounding Breathing', 'Set Intention'] };
    }
  };

  const details = getDurationDetails();

  const handleBegin = () => {
    setJourneyStep('affirmation');
    navigate('/affirmation');

    // Stage 3C Group 3D Batch A: mirror only when the engine is genuinely
    // playing at the 'start' step — a direct-route visit with no active
    // session, or a mismatched mirror, silently does nothing here.
    if (state.status === 'playing' && currentStep?.id === 'start') {
      advanceStep();
    }
  };

  const handleSkip = () => {
    setJourneyStep('');
    navigate('/');

    // Stage 3C Group 3D Batch A: mirror the routine-skip as an abandoned
    // session, guarded the same way as handleBegin above. resetSession()
    // is deliberately not used here per the approved plan.
    if (state.status === 'playing' && currentStep?.id === 'start') {
      abandonSession();
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10">
      <div className="space-y-6 text-center my-auto">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <span className="material-symbols-outlined text-3xl">wb_sunny</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Begin your morning.</h2>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
            Take a few minutes to connect with yourself and set a peaceful tone for your day.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl max-w-sm mx-auto text-left space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-primary">
            <span>{routineDuration.toUpperCase()} ROUTINE</span>
            <span>~ {details.mins} Minutes</span>
          </div>
          <ul className="space-y-2 text-xs text-on-surface-variant">
            {details.steps.map((step, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {betaAccess && GENTLE_AWAKENING_VIDEO && (
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="w-full max-w-sm mx-auto flex items-center gap-4 glass-panel rounded-2xl p-4 hover:bg-white/5 active:scale-[0.99] transition-all text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-xl">play_circle</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-on-surface">Watch: {GENTLE_AWAKENING_VIDEO.title}</span>
              <span className="block text-xs text-on-surface-variant">A soft guided start before you begin.</span>
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant shrink-0">chevron_right</span>
          </button>
        )}
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={handleBegin}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>Begin</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleSkip}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          Skip Routine
        </button>
      </div>

      {/* Closing this leaves the user right here on the morning routine's
          entry screen - no navigation needed for a return path. Begin/Skip
          Routine above are entirely unaffected by whether this is open. */}
      {videoOpen && (
        <BetaVideoModal entry={GENTLE_AWAKENING_VIDEO} onClose={() => setVideoOpen(false)} />
      )}
    </div>
  );
};


