import { useEffect, useRef, useState } from 'react';
import { MEDITATION_STYLES, DEFAULT_MEDITATION_STYLE_ID, getMeditationStyleById } from '../lib/meditationStyles';
import { MEDITATION_DURATIONS, DEFAULT_MEDITATION_DURATION_ID, getMeditationDurationById } from '../lib/meditationDurations';
import { isValidMeditationSoundId, getSuggestedSoundIdForStyle, toControllerSoundId } from '../lib/meditationSounds';
import { createMeditationSessionController } from '../lib/meditationSessionController';

/*
 * WakeWise — Journey Embedding (Self-Guided Meditation) — shared React
 * timer/controller glue.
 *
 * Extracted verbatim from SelfGuidedMeditation.jsx's own internal state
 * machine (phase/styleId/durationId/soundId/soundExplicit/soundUnavailable/
 * snapshot, the controllerRef/intervalRef/beganRef triad, and the
 * begin/pause/resume/selectStyle/selectSound handlers) so the standalone
 * page, MorningMeditate.jsx and EveningMeditate.jsx can all drive the exact
 * same real timer/audio behaviour without duplicating any of this logic.
 * Owns NOTHING about navigation, routes, or which screen is shown - the
 * caller supplies `onComplete(finishedSummary)` (called at the exact
 * moment the original inline `navigate('/self-guided-meditation-complete',
 * ...)` call fired) and reads `phase`/`endSession()` to decide what to
 * render/do next. This hook never calls navigate() itself.
 *
 * `initialStyleId`/`initialDurationId`/`initialSoundId` let each caller
 * seed its own starting selection (Morning: Mindful Pause/2min/IM01;
 * Evening: Quiet Meditation/5min/IM02; standalone: unchanged registry
 * defaults, or a restored Meditate Again/Choose Another Meditation preset)
 * - each caller's own hook instance is independent local state, so Morning/
 * Evening/standalone selections can never leak into one another (three
 * separate useMeditationSession() calls, three separate closures).
 */
export const useMeditationSession = ({
  initialStyleId,
  initialDurationId,
  initialSoundId,
  onComplete
} = {}) => {
  const [styleId, setStyleIdState] = useState(() =>
    getMeditationStyleById(initialStyleId) ? initialStyleId : DEFAULT_MEDITATION_STYLE_ID
  );
  const [durationId, setDurationId] = useState(() =>
    getMeditationDurationById(initialDurationId) ? initialDurationId : DEFAULT_MEDITATION_DURATION_ID
  );
  // Same "explicit choice beats style-suggested default" rule
  // SelfGuidedMeditation.jsx already established - a caller-seeded
  // initialSoundId (e.g. a restored preset) counts as explicit too.
  const [soundExplicit, setSoundExplicit] = useState(() => isValidMeditationSoundId(initialSoundId));
  const [soundId, setSoundIdState] = useState(() =>
    isValidMeditationSoundId(initialSoundId) ? initialSoundId : getSuggestedSoundIdForStyle(styleId)
  );
  const [soundUnavailable, setSoundUnavailable] = useState(false);
  const [phase, setPhase] = useState('setup');
  const [snapshot, setSnapshot] = useState(null);

  const controllerRef = useRef(null);
  const intervalRef = useRef(null);
  // Guards a repeated/double Begin tap - see meditationSessionController.js's
  // own idempotent begin().
  const beganRef = useRef(false);

  const style = getMeditationStyleById(styleId) || MEDITATION_STYLES[0];
  const duration = getMeditationDurationById(durationId) || MEDITATION_DURATIONS[1];

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const cleanupSession = () => {
    stopInterval();
    controllerRef.current?.destroy();
    controllerRef.current = null;
    beganRef.current = false;
  };

  // Covers unmount, route change away from the owning page (Back/Close/
  // Leave/Skip/completion, or any other navigation), and a fresh mount
  // replacing a stale instance - the one place that guarantees audio/
  // interval are never left running behind a screen the user is no longer
  // on. Also what makes "refresh during active meditation" truthful: a
  // refresh remounts the owning page fresh (phase back to 'setup', no
  // elapsed-seconds restoration - this phase does not implement
  // second-by-second persistence for any caller).
  useEffect(() => () => cleanupSession(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => {
    if (beganRef.current) return;
    beganRef.current = true;

    const controller = createMeditationSessionController({
      styleId: style.id,
      durationSeconds: duration.seconds,
      initialSoundId: toControllerSoundId(soundId)
    });
    controllerRef.current = controller;
    controller.begin();
    setSnapshot(controller.getSnapshot());
    setPhase('active');

    intervalRef.current = setInterval(() => {
      const current = controllerRef.current;
      if (!current) return;
      const { completed } = current.tick();
      let latestSnapshot = current.getSnapshot();
      // Truthful-state guarantee - see meditationAudioController.js's own
      // doc comment: a genuinely failed start()/resume() must never keep
      // showing a track selected as if it were actually playing.
      if (latestSnapshot.audioError) {
        current.setSoundId(null);
        setSoundIdState('none');
        setSoundUnavailable(true);
        latestSnapshot = current.getSnapshot();
      }
      setSnapshot(latestSnapshot);
      if (completed) {
        stopInterval();
        const finished = {
          styleId: style.id,
          durationId: duration.id,
          soundId: latestSnapshot.soundId || 'none'
        };
        cleanupSession();
        setPhase('setup');
        onComplete?.(finished);
      }
    }, 1000);
  };

  const pause = () => {
    controllerRef.current?.pause();
    setSnapshot(controllerRef.current?.getSnapshot());
  };

  const resume = () => {
    controllerRef.current?.resume();
    setSnapshot(controllerRef.current?.getSnapshot());
  };

  const selectStyle = (newStyleId) => {
    setStyleIdState(newStyleId);
    if (!soundExplicit) {
      setSoundIdState(getSuggestedSoundIdForStyle(newStyleId));
    }
  };

  const selectSound = (newSoundId) => {
    setSoundIdState(newSoundId);
    setSoundExplicit(true);
    setSoundUnavailable(false);
    if (phase === 'active') {
      controllerRef.current?.setSoundId(toControllerSoundId(newSoundId));
      setSnapshot(controllerRef.current?.getSnapshot());
    }
  };

  // Deliberate early stop (End Session/End Meditation, mid-session Back/
  // Close). Stops the timer/audio and returns phase to 'setup' - never
  // navigates; the caller decides what happens next (standalone navigates
  // away to context.fallback; embedded callers simply stay on the same
  // page, now showing its own pre-start screen again - see each page's own
  // doc comment).
  const endSession = () => {
    cleanupSession();
    setPhase('setup');
  };

  return {
    phase,
    style,
    duration,
    durationId,
    soundId,
    soundUnavailable,
    snapshot,
    setDurationId,
    selectStyle,
    selectSound,
    begin,
    pause,
    resume,
    endSession
  };
};
