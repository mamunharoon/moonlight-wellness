// WakeWise — Self-Guided Meditation — session controller.
//
// Composes the pure timer (meditationSession.js) with one audio controller
// PER TRACK (meditationAudioController.js, lazily created and kept in
// `audioControllers`, keyed by track id) and the style's prompt schedule
// (meditationStyles.js) into one framework-agnostic object.
// SelfGuidedMeditation.jsx wires this to a single real `setInterval`
// (1000ms) calling tick() - this module never owns a timer itself, so it
// stays fully synchronous and directly testable (see
// meditationSessionController.test.js).
//
// Sound Choices (IM01/IM02/No Music): `currentSoundId` is `null` (No Music)
// or one of the two registered track ids. At most one track's audio
// controller is ever created per id for the life of a session controller
// instance (the Map), and at most one is ever playing at a time -
// setSoundId is the single place that decides what happens to the
// PREVIOUS track when switching:
//   - track -> track: the old track is paused (kept warm, in case the user
//     switches back - "start exactly one X instance" is satisfied across
//     the whole session either way, since the Map never creates a second
//     controller for the same id).
//   - track -> No Music: the old track is destroy()ed and dropped from the
//     Map entirely ("stop and release the active audio").
//   - No Music -> track: nothing to release; the (possibly brand new)
//     controller is start()ed fresh, matching the "start" (not "resume")
//     wording for this transition.
// reconcileAudio() itself only ever touches the CURRENT track - it is also
// what begin()/pause()/resume() call, so a timer pause/resume never
// destroys or re-fetches anything (Resume must never re-fetch or restart).
//
// begin() is idempotent (see the `began` guard below), and because a
// caller only ever creates ONE controller instance per session (held in a
// ref, created once on first Begin - see SelfGuidedMeditation.jsx), a
// repeated Begin tap can never produce a second timer or a second audio
// element: it either calls begin() on the same instance again (a no-op)
// or never reaches controller creation at all.
//
// The timer is authoritative: tick()'s completion result depends only on
// meditationSession.js's own elapsed/duration comparison. Audio state is
// reconciled separately and never participates in that decision - a
// failed or slow signed-URL fetch can never delay, block, or otherwise
// affect completion.
import { createMeditationSession } from './meditationSession';
import { createMeditationAudioController } from './meditationAudioController';
import { getMeditationStyleById, getPromptForStyle, DEFAULT_MEDITATION_STYLE_ID } from './meditationStyles';

export const createMeditationSessionController = ({
  styleId,
  durationSeconds,
  initialSoundId = null,
  createAudioElement,
  resolveUrl
} = {}) => {
  const session = createMeditationSession({ durationSeconds });
  const style = getMeditationStyleById(styleId) || getMeditationStyleById(DEFAULT_MEDITATION_STYLE_ID);

  // One audio controller per track id, created only the first time that
  // track is actually selected - never eagerly for both. `currentSoundId`
  // is `null` ("No Music") or a key of this map.
  const audioControllers = new Map();
  let currentSoundId = initialSoundId || null;
  let began = false;

  const getOrCreateAudioController = (soundId) => {
    if (!audioControllers.has(soundId)) {
      audioControllers.set(
        soundId,
        createMeditationAudioController({
          mediaId: soundId,
          createAudioElement,
          resolveUrl,
          // Captures `soundId` (this call's argument), compared against the
          // OUTER, mutable `currentSoundId` at the moment start()'s async
          // work actually resolves - see meditationAudioController.js's own
          // isCurrent doc comment for why this matters for rapid switching.
          isCurrent: () => currentSoundId === soundId
        })
      );
    }
    return audioControllers.get(soundId);
  };

  // The only place that decides what the CURRENT track should be doing
  // right now, given the session's running/paused status. Never touches
  // any other track - switching itself is setSoundId's job (below), so a
  // plain timer pause/resume can never re-fetch or release anything.
  const reconcileAudio = () => {
    if (!currentSoundId) return; // No Music - nothing to reconcile
    const controller = getOrCreateAudioController(currentSoundId);
    if (session.getStatus() === 'running') {
      if (controller.hasStarted()) controller.resume();
      else controller.start();
    } else {
      controller.pause();
    }
  };

  const begin = () => {
    if (began) return;
    began = true;
    session.begin();
    reconcileAudio();
  };

  const pause = () => {
    session.pause();
    reconcileAudio();
  };

  const resume = () => {
    session.resume();
    reconcileAudio();
  };

  // Deliberate early stop (End Session / leaving mid-session). Distinct
  // from natural completion (see tick() below) but both end in the current
  // track being stopped.
  const end = () => {
    session.end();
    if (currentSoundId && audioControllers.has(currentSoundId)) {
      audioControllers.get(currentSoundId).stop();
    }
  };

  // Switches the selected sound - see this module's own top-of-file doc
  // comment for the exact per-transition contract. A no-op if the id is
  // already current (never re-triggers a fetch/pause for the same track).
  const setSoundId = (nextSoundId) => {
    const normalizedNext = nextSoundId || null;
    if (normalizedNext === currentSoundId) return;

    const previousSoundId = currentSoundId;
    currentSoundId = normalizedNext;

    if (previousSoundId && audioControllers.has(previousSoundId)) {
      const previousController = audioControllers.get(previousSoundId);
      if (normalizedNext === null) {
        previousController.destroy();
        audioControllers.delete(previousSoundId);
      } else {
        previousController.pause();
      }
    }

    reconcileAudio();
  };

  const tick = () => {
    const completed = session.tick();
    if (completed && currentSoundId && audioControllers.has(currentSoundId)) {
      audioControllers.get(currentSoundId).stop();
    }
    return { completed };
  };

  // Full teardown (unmount/route-change) - releases every track ever
  // created this session, not only the current one, so a track the user
  // switched away from (paused but kept warm) can never keep holding its
  // element/network resources past this screen's lifetime.
  const destroy = () => {
    for (const controller of audioControllers.values()) controller.destroy();
    audioControllers.clear();
  };

  const getSnapshot = () => {
    const elapsedSeconds = session.getElapsedSeconds();
    const durationSecondsValue = session.getDurationSeconds();
    const currentController = currentSoundId ? audioControllers.get(currentSoundId) : null;
    return {
      status: session.getStatus(),
      elapsedSeconds,
      remainingSeconds: session.getRemainingSeconds(),
      durationSeconds: durationSecondsValue,
      styleId: style.id,
      promptText: getPromptForStyle(style, elapsedSeconds, durationSecondsValue),
      soundId: currentSoundId,
      audioStarted: currentController ? currentController.hasStarted() : false,
      audioError: currentController ? Boolean(currentController.getLastError()) : false
    };
  };

  return { begin, pause, resume, end, tick, setSoundId, destroy, getSnapshot };
};
