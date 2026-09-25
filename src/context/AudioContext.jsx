/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { onSignOutBroadcast } from '../lib/signOutCleanup';

const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playbackError, setPlaybackError] = useState(null);
  const audioRef = useRef(new Audio());

  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;
  }, [volume]);

  // Logout / cross-user client-state audit — a signed-out user's track
  // was otherwise left genuinely playing (not just visible: the real
  // underlying <audio> element kept running), showing the next signed-in
  // identity someone else's now-playing track. Stops playback and fully
  // releases the element (removeAttribute + load(), not just pause()) so
  // it can't silently resume or keep buffering, then clears the
  // now-stale track/progress state.
  useEffect(() => {
    return onSignOutBroadcast(() => {
      const audio = audioRef.current;
      audio.pause();
      audio.loop = false;
      audio.removeAttribute('src');
      audio.load();
      setIsPlaying(false);
      setCurrentTrack(null);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackError(null);
    });
  }, []);

  // audio.play() returns a Promise that can reject (blocked autoplay
  // policy, a blocked/unreachable source, etc.) - it must be awaited so a
  // failure is reported instead of leaving isPlaying stuck at true while
  // nothing is actually audible.
  //
  // `loop` (default false, preserves every existing caller's behaviour
  // unchanged) is the real alarm's own requirement - a ring must keep
  // repeating until the user explicitly resolves it (Begin/Remind/Skip -
  // see AlarmContext.jsx's stopTrack() calls), which a single ~8s clip
  // cannot do on its own. Uses the native HTMLMediaElement `loop`
  // attribute, reset on every call so a later non-looping playTrack()
  // (e.g. any other track in this app) never inherits a stale `true`.
  //
  // useCallback, stable across unrelated renders: this context's value
  // object is consumed by effects elsewhere that list these functions as
  // dependencies (AlarmContext.jsx's own Background Clock Observer lists
  // playTrack; the settings "Test alarm sound" preview's unmount-cleanup
  // effect lists stopTrack) - as plain re-created-every-render functions,
  // every one of those effects would re-run on every AudioProvider
  // re-render, including the very frequent 'timeupdate' progress ticks
  // while something is playing. For the preview specifically this was a
  // real, observed bug: a re-render shortly after starting playback (the
  // isPlaying/currentTrack state updates from playTrack() itself) gave
  // stopTrack a new identity, which re-ran the cleanup effect's PREVIOUS
  // destructor immediately - calling stopTrack() and aborting the
  // just-started play() with AbortError, even though nothing had actually
  // unmounted.
  const playTrack = useCallback((track, { loop = false } = {}) => {
    const audio = audioRef.current;
    if (!currentTrack || currentTrack.url !== track.url) {
      audio.src = track.url;
      setCurrentTrack(track);
    }
    audio.loop = loop;
    setPlaybackError(null);
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => setIsPlaying(true))
        .catch((err) => {
          setIsPlaying(false);
          setPlaybackError({ name: err.name, message: err.message });
        });
    } else {
      setIsPlaying(true);
    }
    return playPromise;
  }, [currentTrack]);

  // A genuine, immediate stop (not just a pause a later resume could
  // continue) - the alarm's own resolution actions (Begin/Remind/Skip)
  // and the settings "Test alarm sound" preview both need this: neither
  // wants the shared player left mid-track afterwards (a stray
  // currentTrack would otherwise surface in Layout.jsx's global
  // persistent-audio mini-player with no reason to be there), and the
  // preview specifically must not linger as a "paused" track the user
  // could later resume expecting music playback semantics.
  const stopTrack = useCallback(() => {
    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
    setIsPlaying(false);
    setCurrentTrack(null);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying]);

  const seek = useCallback((percentage) => {
    const audio = audioRef.current;
    if (!audio.duration) return;
    const seekTime = (percentage / 100) * audio.duration;
    audio.currentTime = seekTime;
    setProgress(percentage);
  }, []);

  return (
    <AudioContext.Provider value={{
      currentTrack,
      isPlaying,
      progress,
      duration,
      currentTime,
      volume,
      setVolume,
      playTrack,
      stopTrack,
      togglePlay,
      seek,
      playbackError
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);


