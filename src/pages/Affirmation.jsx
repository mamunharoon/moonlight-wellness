import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { useAuth } from '../context/AuthContext';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';

// Each { id, blurb } pairs a manifest entry with this page's own short,
// contextual line, matching the pattern already established for E07
// here. E07 first since it was already here, E11-E12 appended in the
// order they were assigned to this screen.
const AFFIRMATION_VIDEOS = [
  { id: 'E07', blurb: 'A short guided moment of gratitude.' },
  { id: 'E11', blurb: 'A guided video to lift your energy and mood.' },
  { id: 'E12', blurb: 'A guided video to help you feel steady and self-assured.' }
];

// Video Integration: this is the morning session's own moment of
// positive reflection - the closest existing analogue to a "morning
// gratitude" stage (Gratitude.jsx/Reflection.jsx are evening-only steps)
// - so these videos live here as additional rows, shown to any signed-in
// user (guests excluded). No "Beta" label on any row - each presents as
// an ordinary WakeWise exercise. Access was originally gated on
// profiles.beta_access; that gate was removed once these videos were
// approved for general availability in this environment.
export const Affirmation = () => {
  const navigate = useNavigate();
  const { setJourneyStep, routineDuration } = useAlarm();
  // Stage 3C Group 3D Batch A: mirrors the affirmation -> stretch (standard
  // and gentle) or affirmation -> breathe (quick, an atomic forward jump)
  // transition into the Session Engine. See handleNext/handleSkip below.
  const { state, currentStep, advanceStep, advanceToStep } = useSession();
  const { isGuest } = useAuth();
  const [openVideoId, setOpenVideoId] = useState(null);
  const openVideo = openVideoId ? getBetaVideoById(openVideoId) : null;

  if (ProgressIndicator && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  // Stage 3C Group 3D Batch A: mirror only when the engine is genuinely
  // playing at the 'affirmation' step — a direct-route visit with no
  // active session, or a mismatched mirror, silently does nothing here.
  const mirrorTransition = () => {
    if (state.status !== 'playing' || currentStep?.id !== 'affirmation') return;
    if (routineDuration === 'quick') {
      advanceToStep('breathe');
    } else {
      advanceStep();
    }
  };

  const handleNext = () => {
    if (routineDuration === 'quick') {
      setJourneyStep('breathe');
      navigate('/breathe'); // Quick routine skips stretching entirely
    } else {
      setJourneyStep('stretch');
      navigate('/morning-flow');
    }
    mirrorTransition();
  };

  const handleSkip = () => {
    if (routineDuration === 'quick') {
      setJourneyStep('breathe');
      navigate('/breathe');
    } else {
      setJourneyStep('stretch');
      navigate('/morning-flow');
    }
    mirrorTransition();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10">
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
            "Your pace is enough. Move gently and intentionally."
          </p>
        </div>
      </div>

      {!isGuest && (
        <div className="space-y-3">
          {AFFIRMATION_VIDEOS.map(({ id, blurb }) => {
            const entry = getBetaVideoById(id);
            if (!entry) return null;
            return (
              <BetaVideoRow
                key={id}
                title={entry.title}
                description={blurb}
                onClick={() => setOpenVideoId(id)}
              />
            );
          })}
        </div>
      )}

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
          Skip
        </button>
      </div>

      {/* Closing this leaves the user right here on the affirmation screen
          - no navigation needed for a return path. Continue/Skip above are
          entirely unaffected by whether this is open. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={() => setOpenVideoId(null)} />
      )}
    </div>
  );
};
