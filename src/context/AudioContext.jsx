/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';

const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
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

  const playTrack = (track) => {
    const audio = audioRef.current;
    if (!currentTrack || currentTrack.url !== track.url) {
      audio.src = track.url;
      setCurrentTrack(track);
    }
    audio.play();
    setIsPlaying(true);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const seek = (percentage) => {
    const audio = audioRef.current;
    if (!audio.duration) return;
    const seekTime = (percentage / 100) * audio.duration;
    audio.currentTime = seekTime;
    setProgress(percentage);
  };

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
      togglePlay,
      seek
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);


