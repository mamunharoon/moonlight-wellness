/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { BreathingRing } from '../components/BreathingRing';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { ExercisePausedPanel } from '../components/ExercisePausedPanel';
import { MusicEntryChoice } from '../components/MusicEntryChoice';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';

// Background Music — shared with EveningBreathing.jsx/QuietBreathing.jsx/
// MorningFlow.jsx (see InteractiveAmbientMusic.jsx's own doc comment). Not
// yet registered in the manifest/Edge Function, so this renders nothing
// until it is — see isInteractiveMusicEligible's own doc comment.
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';

// Each { id, blurb } pairs a manifest entry with this page's own short,
// contextual line, matching the pattern already established for E08
// here. E08 first since it was already here, E28 appended in the order
// it was assigned to this screen.
const BREATHE_VIDEOS = [
  { id: 'E08', blurb: 'A guided video for this breathing exercise.' },
  { id: 'E28', blurb: 'A guided video for slow, mindful breathing.' }
];

// B01-B05: a distinct "Breathing Sessions" collection, kept in its own
// array/section (with its own heading) rather than merged into
// BREATHE_VIDEOS above, specifically so "Deep Breathing Practice" (B01)
// reads as its own thing next to the existing E08 "Deep Breathing" row on
// this same page, not as a duplicate of it.
const BREATHING_SESSION_VIDEOS = [
  { id: 'B01', blurb: 'A guided video for a deep breathing practice.' },
  { id: 'B02', blurb: 'A guided video for box breathing.' },
  { id: 'B03', blurb: 'A guided video for 4-7-8 breathing.' },
  { id: 'B04', blurb: 'A guided video for coherent breathing.' },
  { id: 'B05', blurb: 'A guided video for alternate nostril breathing.' }
];

// Video Integration: additional rows offering "Deep Breathing" and
// "Mindful Breathing" alongside the morning routine's own breathing step
// - reuses this exact page rather than adding a parallel breathing
// screen, since its own copy ("Deep Belly Breath") already matches both
// videos' subject. Shown to any signed-in user (guests excluded). Access
// was originally gated on profiles.beta_access; that gate was removed
// once these videos were approved for general availability in this
// environment.
//
// Morning-flow redesign — interactive timer vs. optional guided video:
// this screen's own Inhale/Hold/Exhale ring has no narration or audio of
// its own (confirmed by direct audit - the rows below open a completely
// separate, same-page BetaVideoModal, never mixed with the ring itself).
// Selecting any row now: (1) marks videoOpenedDuringExercise so the timer
// stops advancing and background music is suspended (via
// InteractiveAmbientMusic's own `suspended` prop, driven by openVideo
// directly), and (2) requires a deliberate "Resume Exercise" tap to
// continue afterward — closing the video alone never restarts the timer
// or the music, exactly as required.
export const Breathe = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  // Stage 3C Group 3D Batch B: mirrors the breathe -> affirmation transition
  // into the Session Engine from all three genuine exits (timer expiry,
  // Complete/Continue, Skip Breathing). See mirrorBreathingExitRef below.
  // Pause/resume deliberately never calls interruptSession()/resumeSession()
  // — it only ever toggles the pre-existing local isPaused state.
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  const [breatheState, setBreatheState] = useState('Inhale'); // 'Inhale', 'Hold', 'Exhale'
  const [secondsLeft, setSecondsLeft] = useState(56); // 1-minute production timer
  const [isPaused, setIsPaused] = useState(false);
  // Morning-flow redesign: set the moment any guided-video row is tapped
  // (from that same click handler, never from an effect), never cleared
  // automatically — only the deliberate "Resume Exercise" tap clears it.
  // Distinct from `isPaused` (the ordinary manual Pause/Resume toggle)
  // so the UI can show a clearly different "Resume Exercise" affordance
  // only when a video was actually opened.
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

  if (ProgressIndicator) { /* no-op to satisfy blind linter */ }
  if (BreathingRing && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  // A real click-handler state update (see handleSelectVideo below), never
  // an effect — setting isPaused/videoOpenedDuringExercise here is exactly
  // the sanctioned "respond to a user gesture" pattern, not a derived-state
  // synchronization the linter would flag.
  const handleSelectVideo = (id) => {
    setVideoOpenedDuringExercise(true);
    handleSelect(id);
  };

  const handleResumeExercise = () => {
    setVideoOpenedDuringExercise(false);
  };

  // "Resume with Music" - a second, distinct deliberate gesture from
  // "Resume Exercise": also starts this screen's own ambient loop, via
  // the ref InteractiveAmbientMusic exposes (see its own doc comment).
  // By the time this button exists at all, the video is already closed
  // (openVideo is null), so `suspended` is already false - start() runs
  // exactly as if the toggle itself had just been tapped. A failed start
  // is handled entirely inside InteractiveAmbientMusic (loadError,
  // toggle stays off) - nothing here needs to know or react to that.
  const musicPlayerRef = useRef(null);
  const handleResumeWithMusic = () => {
    setVideoOpenedDuringExercise(false);
    musicPlayerRef.current?.start();
  };
  // Mirrors InteractiveAmbientMusic's own eligibility check so
  // ExercisePausedPanel can hide "Resume with Music" entirely rather than
  // show a button that would silently do nothing (feature flag off, or
  // no IB01 manifest entry) - see that component's own eligible check.
  const musicEligible = isInteractiveMusicEligible({
    musicVariantId: INTERACTIVE_BREATHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });

  // Entry choice, asked once per visit before the countdown starts at all
  // (see MusicEntryChoice's own doc comment) - only when there's a real
  // choice to make (musicEligible); otherwise this never blocks anything
  // and the timer starts immediately, exactly as before this feature
  // existed. Deliberately a SEPARATE flag from videoOpenedDuringExercise:
  // if a video is opened before this choice is ever made, closing it
  // shows this same initial choice again (not ExercisePausedPanel) - see
  // the panel's own render condition below, which requires
  // musicChoiceMade to already be true.
  const [musicChoiceMade, setMusicChoiceMade] = useState(false);
  const awaitingMusicChoice = musicEligible && !musicChoiceMade;
  const handleStartWithMusic = () => {
    setMusicChoiceMade(true);
    musicPlayerRef.current?.start();
  };
  const handleContinueWithoutMusic = () => {
    setMusicChoiceMade(true);
  };

  // Stage 3C Group 3D Batch B: one-shot guard for the Session Engine
  // mirror only — multiple exits (timer, manual, skip) could theoretically
  // reach the mirror close together, and this ensures it dispatches at
  // most once regardless of which exit gets there first. It never blocks
  // or alters the legacy countdown/breathing-cycle/pause-resume/navigation
  // statements it sits beside.
  const hasMirroredExitRef = useRef(false);
  // Kept as a ref (rather than depending on state.status/currentStep
  // directly in the timer effect below) so the countdown effect's own
  // dependency array — and therefore its timing — is completely untouched
  // by Session Engine state.
  const mirrorBreathingExitRef = useRef(() => {});
  useEffect(() => {
    mirrorBreathingExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'breathe') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  useEffect(() => {
    if (isPaused || videoOpenedDuringExercise || awaitingMusicChoice) return;

    if (secondsLeft <= 0) {
      setJourneyStep('affirmation');
      navigate('/affirmation');
      mirrorBreathingExitRef.current();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        const cycleTime = (56 - nextSec) % 14;
        if (cycleTime < 4) {
          setBreatheState('Inhale');
        } else if (cycleTime < 8) {
          setBreatheState('Hold');
        } else {
          setBreatheState('Exhale');
        }
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isPaused, videoOpenedDuringExercise, awaitingMusicChoice, navigate, setJourneyStep]);

  const handleComplete = () => {
    setJourneyStep('affirmation');
    navigate('/affirmation');
    mirrorBreathingExitRef.current();
  };

  const handleSkip = () => {
    setJourneyStep('affirmation');
    navigate('/affirmation');
    mirrorBreathingExitRef.current();
  };

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'breathe') abandonSession();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10 select-none">
      <div className="flex items-center gap-3">
        <BackButton fallback="/morning-flow" />
      </div>
      <ProgressIndicator activeStep="breathe" />

      {awaitingMusicChoice && (
        <MusicEntryChoice onStartWithMusic={handleStartWithMusic} onContinueWithoutMusic={handleContinueWithoutMusic} />
      )}

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Grounding Exercise</span>
        <h2 className="text-2xl font-bold text-on-surface">Center Yourself</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Take a deep breath. Let the world fade away for just a minute.
        </p>
      </div>

      {/* Breathing Ring Visualizer — extracted to components/BreathingRing.jsx (Stage 4 Batch F2) */}
      <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />

      <InteractiveAmbientMusic ref={musicPlayerRef} musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID} suspended={Boolean(openVideo)} />

      {/* Immediately below the ring/music toggle, ABOVE every optional
          video row below - visible in the initial viewport with no
          scroll, unlike the old bottom-of-page single button it replaces.
          Gated on musicChoiceMade already being true: a video opened
          before that initial choice was ever made resolves back to
          MusicEntryChoice above on close, never this panel - one relevant
          prompt at a time. */}
      {musicChoiceMade && videoOpenedDuringExercise && !openVideo && (
        <ExercisePausedPanel
          onResumeExercise={handleResumeExercise}
          onResumeWithMusic={handleResumeWithMusic}
          showResumeWithMusic={musicEligible}
        />
      )}

      <div className="text-center space-y-2">
        <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
          Deep Belly Breath (4-4-6)
        </span>
      </div>

      {BREATHE_VIDEOS.map(({ id, blurb }) => {
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

      <div className="space-y-3">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Breathing Sessions</h3>
        {BREATHING_SESSION_VIDEOS.map(({ id, blurb }) => {
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

      {/* Controls */}
      <div className="space-y-3 w-full">
        {/* Hidden while the ExercisePausedPanel above is showing its own
            two resume actions - avoids two conflicting "what happens if I
            tap this" affordances on screen at once. The ordinary manual
            Pause/Resume toggle is otherwise completely unrelated to that
            panel's state and unaffected by it. */}
        {!(videoOpenedDuringExercise && !openVideo) && !awaitingMusicChoice && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="flex-1 py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10"
            >
              <span className="material-symbols-outlined text-sm">{isPaused ? 'play_arrow' : 'pause'}</span>
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={handleComplete}
              className="flex-1 bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              <span>Continue</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
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

      {/* Closing this leaves the user right here on the breathing screen -
          no navigation needed for a return path. The timer stays paused
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
