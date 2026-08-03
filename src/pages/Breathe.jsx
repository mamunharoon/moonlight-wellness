import React, { useState, useEffect } from 'react';
import { useAudio } from '../context/AudioContext';

export const Breathe = () => {
  const [breatheState, setBreatheState] = useState('Inhale');
  const [timerVal, setTimerVal] = useState('04:52');
  const { playTrack } = useAudio();

  useEffect(() => {
    const states = ['Inhale', 'Exhale'];
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % states.length;
      setBreatheState(states[index]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-12">
      <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center">
        <div className={`absolute inset-0 rounded-full bg-primary/10 blur-3xl transition-all duration-[4000ms] ${
          breatheState === 'Inhale' ? 'scale-125 opacity-100' : 'scale-90 opacity-60'
        }`}></div>
        
        <div className={`w-48 h-48 rounded-full bg-gradient-to-br from-primary-container to-primary flex flex-col items-center justify-center shadow-2xl transition-all duration-[4000ms] ease-in-out ${
          breatheState === 'Inhale' ? 'scale-110 shadow-primary/30' : 'scale-95 shadow-transparent'
        }`}>
          <span className="text-white font-headline-md text-2xl tracking-widest uppercase transition-opacity">
            {breatheState}
          </span>
          <span className="material-symbols-outlined text-white/50 text-2xl mt-1 animate-pulse">air</span>
        </div>
      </div>

      <div className="text-center">
        <h3 className="text-4xl font-extrabold tracking-tight text-on-surface">{timerVal}</h3>
        <p className="text-xs text-on-surface-variant uppercase tracking-widest mt-1">Remaining</p>
      </div>

      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h3 className="font-label-md text-sm text-on-surface flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-primary text-[20px]">timer</span> Set Duration
          </h3>
          <div className="flex justify-between gap-2">
            {['1 min', '5 min', '10 min'].map((dur, i) => (
              <button key={i} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${
                i === 1 
                  ? 'bg-primary-container text-on-primary-container border-primary-container/20' 
                  : 'bg-white/5 border-white/10 text-on-surface-variant/80 hover:bg-white/10'
              }`}>
                {dur}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h3 className="font-label-md text-sm text-on-surface flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-secondary text-[20px]">waves</span> Ambient Sound
          </h3>
          <div className="space-y-2">
            <button 
              onClick={() => playTrack({
                title: 'Midnight Rain',
                url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=150'
              })}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/10 border border-secondary/20 hover:bg-secondary/15 transition-all text-xs text-on-surface font-semibold"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">water_drop</span> Midnight Rain
              </span>
              <span className="material-symbols-outlined text-secondary text-sm">volume_up</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};