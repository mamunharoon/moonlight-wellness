import { useEffect, useRef, useState } from 'react';
import { awaitWithFallback, AUDIO_HANDOFF_FALLBACK_MS } from '../lib/awaitWithFallback';

// Coordinated audio/visual handoff — shared by every natural-completion
// path that fades music out before revealing a completion panel or
// navigating to the next screen (Breathe.jsx/EveningBreathing.jsx/
// QuietBreathing.jsx/MorningFlow.jsx via InteractiveAmbientMusic.jsx;
// MorningMeditate.jsx/EveningMeditate.jsx/SelfGuidedMeditation.jsx via
// useMeditationSession.js, which uses this hook internally).
//
// `audioReady` starts true (nothing to wait for yet, so a screen that
// never calls beginHandoff - or music-off/a failed load, where the fade
// promise resolves immediately - never adds any delay).
// `beginHandoff(fadePromise)` flips it false the instant natural completion
// is detected, synchronously, in the same tick as everything else that
// already freezes the outgoing view (isCompleted, etc.) - and back to true
// once `fadePromise` genuinely settles OR AUDIO_HANDOFF_FALLBACK_MS
// elapses, whichever comes first, so a hung or failed fade can never stall
// whatever is gated on this.
//
// Guards against setting state after unmount: by construction, nothing
// gated on `audioReady` ever unmounts this hook's owner while audioReady is
// still false (the reveal/navigate it gates is exactly what would cause
// that unmount) - this guard is only for an unrelated exit path (closing
// the tab, an unrelated route change) racing the fallback window.
export const useAudioFadeHandoff = () => {
  const [audioReady, setAudioReady] = useState(true);
  const isMountedRef = useRef(true);
  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const beginHandoff = (fadePromise) => {
    setAudioReady(false);
    awaitWithFallback(fadePromise, AUDIO_HANDOFF_FALLBACK_MS).then(() => {
      if (isMountedRef.current) setAudioReady(true);
    });
  };

  return { audioReady, beginHandoff };
};
