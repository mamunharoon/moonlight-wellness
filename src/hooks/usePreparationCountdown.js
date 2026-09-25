import { useEffect, useRef, useState } from 'react';

// Build 16 physical-iPhone correction (F3) — shared 5-second preparation
// countdown for Stretch/Breathing/Meditation's own Begin gesture. Owns
// only the countdown's own timing/state; it never starts an exercise
// timer or audio itself - the caller's `onComplete` is what actually
// begins the real practice, at zero or on a deliberate "Start now" skip.
// Deliberately NOT tied to any one journey controller (Session Engine,
// meditationSessionController, InteractiveAmbientMusic) so it can sit in
// front of any of them without widening their own state machines.
//
// Reaching zero is detected and acted on in a dedicated useEffect below,
// NOT inside the interval's setSecondsRemaining functional updater. An
// earlier version called onComplete() (a real side effect - it goes on to
// start a whole separate session's timer/audio via several of ITS OWN
// setState calls) directly from inside that updater. React updater
// functions must be pure and can be invoked more than once per commit
// (React 18/StrictMode dev double-invocation is the visible case, but the
// contract itself is not StrictMode-only) - found live that this silently
// dropped the transition to the active screen: internal state (phase,
// timer ticks) advanced correctly and completely invisibly, while the
// screen itself kept showing the countdown/setup UI. Moving the
// onComplete() call into an effect keyed on [isActive, secondsRemaining]
// keeps the updater itself a pure decrement and runs the real side effect
// only after React has actually committed that state.
//
// `completedOnceRef` still guards the transition to exactly one call per
// start() (covers a rapid double-tap on "Start now" landing the same
// render pass as a natural zero), satisfying "prevent double-starts."
export const usePreparationCountdown = ({ seconds = 5, onComplete } = {}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(seconds);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef(null);
  const completedOnceRef = useRef(false);
  // Ref mirror so the interval's own closure always calls the LATEST
  // onComplete, never one captured at start()-time (matches this
  // codebase's own established mirrorStretchExitRef/mirrorExitRef pattern
  // elsewhere for the identical reason). Assigned in an effect, never
  // during render (this repo's lint config forbids writing a ref in the
  // render path itself).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Covers unmount mid-countdown (Back/Close/route change away) - never
  // leaves a stray interval running behind a screen the user already left.
  useEffect(() => () => stopInterval(), []);

  const start = () => {
    if (isActive) return;
    completedOnceRef.current = false;
    setSecondsRemaining(seconds);
    setIsActive(true);
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  };

  // The one place a natural zero actually fires onComplete - runs as a
  // committed-state effect, never inside the interval's own updater.
  useEffect(() => {
    if (isActive && secondsRemaining <= 0 && !completedOnceRef.current) {
      completedOnceRef.current = true;
      stopInterval();
      setIsActive(false);
      onCompleteRef.current?.();
    }
  }, [isActive, secondsRemaining]);

  // "Start now" - a genuine user gesture (a real event-handler call, not a
  // setState updater), ends the countdown immediately and runs the exact
  // same onComplete a natural zero would have.
  const skip = () => {
    if (completedOnceRef.current) return;
    completedOnceRef.current = true;
    stopInterval();
    setIsActive(false);
    onCompleteRef.current?.();
  };

  // Back/Cancel during the countdown - returns to setup WITHOUT ever
  // calling onComplete, so the exercise is never marked started. Also
  // one-shot-safe: marks completedOnceRef so a tick already queued for
  // this exact render pass can never sneak through after cancel.
  const cancel = () => {
    completedOnceRef.current = true;
    stopInterval();
    setIsActive(false);
  };

  return { secondsRemaining, isActive, start, skip, cancel };
};
