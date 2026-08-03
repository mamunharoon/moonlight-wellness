import React from 'react';
import { Link } from 'react-router-dom';

export const SessionComplete = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-10 py-12 max-w-xl mx-auto">
      
      {/* Circular Progress Gauge */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="rgba(255,255,255,0.05)" strokeWidth="4"></circle>
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="var(--color-primary)" strokeDasharray="276.46" strokeDashoffset="0" strokeLinecap="round" strokeWidth="5"></circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
          <span className="text-3xl font-extrabold text-on-surface mt-1">100%</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Complete</span>
        </div>
      </div>

      {/* Centered Message */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-white tracking-tight">Session Finished</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          You've centered yourself beautifully. Take this moment of clarity with you as you move forward.
        </p>
      </div>

      {/* Rewards Row */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
          <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">Vibe Points</p>
          <p className="text-2xl font-extrabold text-primary">+450</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
          <span className="material-symbols-outlined text-secondary text-2xl">local_fire_department</span>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">Daily Streak</p>
          <p className="text-2xl font-extrabold text-secondary">12 Days</p>
        </div>
      </div>

      {/* Redirect Paths */}
      <div className="flex flex-col gap-3 w-full">
        <Link to="/journal" className="w-full bg-primary text-on-primary py-4 rounded-full font-semibold text-center hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-sm">edit_note</span> Journal Thoughts
        </Link>
        <Link to="/" className="w-full glass-panel text-on-surface font-semibold py-4 rounded-full text-center hover:bg-white/10 active:scale-95 transition-all border-white/20">
          Return Home
        </Link>
      </div>
    </div>
  );
};