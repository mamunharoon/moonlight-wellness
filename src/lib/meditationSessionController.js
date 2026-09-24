// WakeWise — Self-Guided Meditation — session controller.
//
// Composes the pure timer (meditationSession.js) with the audio
// controller (meditationAudioController.js) and the style's prompt
// schedule (meditationStyles.js) into one framework-agnostic object.
// SelfGuidedMeditation.jsx wires this to a single real `setInterval`
// (1000ms) calling tick() - this module never owns a timer itself, so it
// stays fully synchronous and directly testable (see
// meditationSessionController.test.js).
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
// reconciled separately (reconcileAudio) and never participates in that
// decision - a failed or slow signed-URL fetch can never delay, block, or
// otherwise affect completion.
import { createMeditationSession } from './meditationSession';
import { createMeditationAudioController } from './meditationAudioController';
import { getMeditationStyleById, getPromptForStyle, DEFAULT_MEDITATION_STYLE_ID } from './meditationStyles';

export const createMeditationSessionController = ({
  mediaId,
  styleId,
  durationSeconds,
  musicEnabled: initialMusicEnabled = true,
  createAudioElement,
  resolveUrl
} = {}) => {
  const session = createMeditationSession({ durationSeconds });
  const audio = createMeditationAudioController({ mediaId, createAudioElement, resolveUrl });
  const style = getMeditationStyleById(styleId) || getMeditationStyleById(DEFAULT_MEDITATION_STYLE_ID);

  let musicEnabled = Boolean(initialMusicEnabled);
  let began = false;

  // The single place that decides what the audio element SHOULD be doing
  // right now, given the current music preference and session status -
  // called after every state transition (begin/pause/resume/setMusicEnabled)
  // rather than duplicating this "should it be playing?" logic at each call
  // site. Never called from tick() itself, so audio can never influence
  // completion timing.
  const reconcileAudio = () => {
    const shouldPlay = musicEnabled && session.getStatus() === 'running';
    if (shouldPlay) {
      // hasStarted() distinguishes "never started" (Begin happened with
      // music Off, or the first-ever start) from "started, currently
      // paused/stopped" - only the former calls start() (fetch + play from
      // the beginning); the latter calls resume() (same element, no
      // re-fetch, no restart), matching "turning it back On resumes
      // appropriately without resetting meditation progress."
      if (audio.hasStarted()) audio.resume();
      else audio.start();
    } else {
      audio.pause();
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
  // from natural completion (see tick() below) but both end in the audio
  // being fully stopped.
  const end = () => {
    session.end();
    audio.stop();
  };

  const setMusicEnabled = (next) => {
    musicEnabled = Boolean(next);
    reconcileAudio();
  };

  const tick = () => {
    const completed = session.tick();
    if (completed) audio.stop();
    return { completed };
  };

  const destroy = () => {
    audio.destroy();
  };

  const getSnapshot = () => {
    const elapsedSeconds = session.getElapsedSeconds();
    const durationSecondsValue = session.getDurationSeconds();
    return {
      status: session.getStatus(),
      elapsedSeconds,
      remainingSeconds: session.getRemainingSeconds(),
      durationSeconds: durationSecondsValue,
      styleId: style.id,
      promptText: getPromptForStyle(style, elapsedSeconds, durationSecondsValue),
      musicEnabled,
      audioStarted: audio.hasStarted(),
      audioError: Boolean(audio.getLastError())
    };
  };

  return { begin, pause, resume, end, tick, setMusicEnabled, destroy, getSnapshot };
};
