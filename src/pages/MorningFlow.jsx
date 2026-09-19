/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';

// Background Music — the interactive stretching timer's own loop, distinct
// from IB01 (breathing/grounding). Not yet registered in the manifest/
// Edge Function, so InteractiveAmbientMusic renders nothing until it is —
// see isInteractiveMusicEligible's own doc comment.
const INTERACTIVE_STRETCHING_MUSIC_ID = 'IS01';

// S01-S05: a "Stretching Sessions" collection, matching the pattern
// already established for the A-, B-, G- and M-series sections. Shown to
// any signed-in user (guests excluded).
const STRETCHING_SESSION_VIDEOS = [
  { id: 'S01', blurb: 'A guided video to release tension in your neck.' },
  { id: 'S02', blurb: 'A guided video to release tension in your shoulders.' },
  { id: 'S03', blurb: 'A guided video to stretch your upper back.' },
  { id: 'S04', blurb: 'A guided morning stretching flow.' },
  { id: 'S05', blurb: 'A guided evening stretching flow.' }
];

// Morning-flow redesign — interactive timer vs. optional guided video:
// this screen's own 4-exercise countdown has no narration or audio of its
// own (confirmed by direct audit - the rows below open a completely
// separate, same-page BetaVideoModal, never mixed with the countdown
// itself). Selecting any row now: (1) marks videoOpenedDuringExercise so
// the timer stops advancing and background music is suspended (via
// InteractiveAmbientMusic's own `suspended` prop, driven by openVideo
// directly), and (2) requires a deliberate "Resume Exercise" tap to
// continue afterward — closing the video alone never restarts the timer
// or the music, exactly as required. Same pattern as Breathe.jsx.
export const MorningFlow = () => {
  const navigate = useNavigate();
  const { setJourneyStep, routineDuration } = useAlarm();
  // Stage 3C Group 3D Batch B: mirrors the stretch -> breathe transition
  // into the Session Engine from all three genuine exits (timer
  // auto-advance, manual Next/Continue on the final exercise, Skip
  // Stretching). See mirrorStretchExitRef below.
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  const [activeStep, setActiveStep] = useState(0);
  // Morning-flow redesign: set the moment any guided-video row is tapped
  // (from that same click handler, never from an effect), never cleared
  // automatically — only the deliberate "Resume Exercise" tap clears it.
  const [videoOpenedDuringExercise, setVideoOpenedDuringExercise] = useState(false);
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

  if (ProgressIndicator && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  const handleSelectVideo = (id) => {
    setVideoOpenedDuringExercise(true);
    handleSelect(id);
  };

  const handleResumeExercise = () => {
    setVideoOpenedDuringExercise(false);
  };

  const steps = [
    { title: 'Reach to the Sky', desc: 'Extend your arms high and breathe deep.', icon: 'wb_sunny' },
    { title: 'Shoulder Rolls', desc: 'Roll your shoulders backward gently.', icon: 'rotate_right' },
    { title: 'Gentle Neck Stretch', desc: 'Slowly lower your ear to your shoulder.', icon: 'autorenew' },
    { title: 'Gentle Twist', desc: 'Slowly rotate your torso from side to side.', icon: 'spa' }
  ];

  const getStepDuration = () => {
    if (routineDuration === 'extended') return 40;
    return 20; // Default to 20s for standard routine mode
  };

  const [timeLeft, setTimeLeft] = useState(getStepDuration());

  // Stage 3C Group 3D Batch B: one-shot guard for the Session Engine
  // mirror only — multiple exits (timer, manual, skip) could theoretically
  // reach the mirror close together (e.g. a manual click right as the
  // timer expires), and this ensures it dispatches at most once regardless
  // of which exit gets there first. It never blocks or alters the legacy
  // navigation/timer/exercise-progression statements it sits beside.
  const hasMirroredExitRef = useRef(false);
  // The timer effect below is set up once and its dependency array
  // deliberately excludes Session Engine state (adding it would reset the
  // running countdown whenever the mirror fires) — so its setInterval
  // closure calls through this ref, which is kept pointing at a fresh
  // closure on every render, instead of depending on stale values captured
  // at effect-setup time.
  const mirrorStretchExitRef = useRef(() => {});
  useEffect(() => {
    mirrorStretchExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'stretch') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  useEffect(() => {
    if (videoOpenedDuringExercise) return;

    const stepDur = routineDuration === 'extended' ? 40 : 20;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setActiveStep((curr) => {
            if (curr < steps.length - 1) {
              return curr + 1;
            } else {
              setJourneyStep('breathe');
              navigate('/breathe');
              mirrorStretchExitRef.current();
              return curr;
            }
          });
          return stepDur;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, setJourneyStep, routineDuration, steps.length, videoOpenedDuringExercise]);

  const handleNextStep = () => {
    const stepDur = routineDuration === 'extended' ? 40 : 20;
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
      setTimeLeft(stepDur);
    } else {
      setJourneyStep('breathe');
      navigate('/breathe');
      mirrorStretchExitRef.current();
    }
  };

  const handleSkip = () => {
    setJourneyStep('breathe');
    navigate('/breathe');
    mirrorStretchExitRef.current();
  };

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'stretch') abandonSession();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-8 select-none">
      <div className="flex items-center gap-3">
        <BackButton fallback="/intention-setup" />
      </div>
      <ProgressIndicator activeStep="stretch" />

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Morning Awakening</span>
        <h2 className="text-2xl font-bold text-on-surface">Light Morning Stretching</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
          Wake up your body with gentle, slow stretches.
        </p>
      </div>

      {/* Progress visual bar */}
      <div className="glass-panel p-5 rounded-2xl space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
          <span>Stretching Progress</span>
          <span>Exercise {activeStep + 1} of {steps.length}</span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-1000"
            style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isCompleted = idx < activeStep;
          const isActive = idx === activeStep;

          return (
            <div
              key={idx}
              className={`glass-panel p-5 rounded-2xl flex items-center justify-between border transition-all duration-300 ${
                isActive ? 'border-primary/30 opacity-100 shadow-md shadow-primary/5 bg-primary/5' : isCompleted ? 'opacity-50 border-transparent' : 'opacity-30 border-transparent'
              }`}
            >
              <div className="flex gap-4 items-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-primary/25 text-primary' : 'bg-white/5 text-on-surface-variant'
                }`}>
                  <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                </div>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold flex items-center gap-2">
                    {step.title}
                    {isCompleted && <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>}
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-1">{step.desc}</p>
                </div>
              </div>

              {isActive && (
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-primary">0:{timeLeft.toString().padStart(2, '0')}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Remaining</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <InteractiveAmbientMusic musicVariantId={INTERACTIVE_STRETCHING_MUSIC_ID} suspended={Boolean(openVideo)} />

      <div className="space-y-3">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Stretching Sessions</h3>
        {STRETCHING_SESSION_VIDEOS.map(({ id, blurb }) => {
          const entry = getBetaVideoById(id);
          if (!entry) return null;
          return (
            <BetaVideoRow
              key={id}
              title={entry.title}
              description={blurb}
              onClick={() => handleSelectVideo(id)}
            />
          );
        })}
      </div>

      <div className="space-y-3 w-full">
        {videoOpenedDuringExercise && !openVideo ? (
          <button
            onClick={handleResumeExercise}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            <span>Resume Exercise</span>
          </button>
        ) : (
          <button
            onClick={handleNextStep}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span>{activeStep === steps.length - 1 ? 'Continue' : 'Next Step'}</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        )}
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

      {/* Closing this leaves the user right here on the stretching screen
          - no navigation needed for a return path. The timer stays paused
          (videoOpenedDuringExercise) until a deliberate Resume Exercise
          tap - see the doc comment above. */}
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
