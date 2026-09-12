import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';

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

// Video Integration: additional rows right at the morning routine's own
// entry screen - the natural "Rise & Reset" moment, before Begin/Skip
// Routine. Shown to any signed-in user (guests excluded); no "Beta"
// label on any row - each presents as an ordinary WakeWise exercise.
// Access was originally gated on profiles.beta_access; that gate was
// removed once these videos were approved for general availability in
// this environment.
export const MorningStart = () => {
  const navigate = useNavigate();
  const { routineDuration, setJourneyStep } = useAlarm();
  // Stage 3C Group 3D Batch A: mirrors the start -> affirmation transition
  // (Begin) and the start -> abandoned transition (Skip Routine) into the
  // Session Engine. See handleBegin/handleSkip below for the only places
  // any of this is used.
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  const { isGuest } = useAuth();
  // id of the video currently open in the modal, or null. Exactly one
  // modal is ever mounted (see the render below), so only one of these
  // rows can ever be playing at a time.
  const [openVideoId, setOpenVideoId] = useState(null);
  const openVideo = openVideoId ? getBetaVideoById(openVideoId) : null;

  if (BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

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

        {!isGuest && (
          <div className="w-full max-w-sm mx-auto space-y-3">
            {MORNING_START_VIDEOS.map(({ id, blurb }) => {
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
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={() => setOpenVideoId(null)} />
      )}
    </div>
  );
};


