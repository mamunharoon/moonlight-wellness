import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export const Home = () => {
  const { isDark } = useTheme();

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:text-3xl font-extrabold text-on-surface">
          {isDark ? 'Good evening, Sun' : 'Good morning, Sun'}
        </h2>
        <p className="text-on-surface-variant font-body-md opacity-80">
          {isDark ? 'The moon is at 84% illumination. Time to wind down.' : 'Ready for your breath of fresh air today?'}
        </p>
      </section>

      <section className="relative overflow-hidden rounded-3xl p-6 md:p-8 glass-panel flex flex-col md:flex-row gap-6 items-center shadow-lg border-primary/20">
        <div className="flex-1 space-y-4">
          <span className="inline-block font-label-sm text-label-sm text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wider">
            Daily Intention
          </span>
          <p className="text-on-surface font-body-lg italic leading-relaxed">
            "I will honor my body's need for rest tonight, allowing my mind to settle into a peaceful stillness."
          </p>
          <button className="bg-primary text-on-primary font-label-md px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md">
            Set New Intention
          </button>
        </div>
        <div className="w-full md:w-1/3 aspect-square glass-panel rounded-2xl flex items-center justify-center border-none">
          <div className="text-center">
            <div className="text-4xl font-extrabold text-primary mb-2">12</div>
            <div className="text-[10px] uppercase tracking-test text-on-surface-variant font-semibold">Intentions Met</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/breathe" className="glass-panel p-6 rounded-2xl flex flex-col justify-between hover:bg-white/15 transition-all duration-300 group h-48 cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
            <span className="material-symbols-outlined text-2xl">air</span>
          </div>
          <div>
            <h3 className="font-headline-md text-lg text-on-surface mb-1">Breathing Exercise</h3>
            <p className="text-xs text-on-surface-variant">Find your rhythm in 3 mins</p>
          </div>
        </Link>

        <Link to="/journal" className="glass-panel p-6 rounded-2xl flex flex-col justify-between hover:bg-white/15 transition-all duration-300 group h-48 cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary border border-tertiary/20">
            <span className="material-symbols-outlined text-2xl">favorite</span>
          </div>
          <div>
            <h3 className="font-headline-md text-lg text-on-surface mb-1">Positive Affirmations</h3>
            <p className="text-xs text-on-surface-variant">Reframe your headspace</p>
          </div>
        </Link>

        <Link to="/toolkit" className="glass-panel p-6 rounded-2xl flex flex-col justify-between hover:bg-white/15 transition-all duration-300 group h-48 cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <span className="material-symbols-outlined text-2xl">bolt</span>
          </div>
          <div>
            <h3 className="font-headline-md text-lg text-on-surface mb-1">Energy Boost</h3>
            <p className="text-xs text-on-surface-variant">Quick movement for vitality</p>
          </div>
        </Link>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-headline-md text-lg text-on-surface font-bold">Mindful Minutes</h3>
            <span className="text-primary font-bold text-sm">22 / 30m</span>
          </div>
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full" style={{ width: '73%' }}></div>
          </div>
          <div className="mt-3 flex justify-between text-xs text-on-surface-variant">
            <span>Almost at your daily goal</span>
            <span>8m remaining</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-headline-md text-lg text-on-surface font-bold">Journaling Streak</h3>
            <span className="text-tertiary font-bold text-sm">5 Days</span>
          </div>
          <div className="flex gap-2 justify-between">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-xs text-on-surface-variant">{day}</span>
                <div className={`w-full aspect-square rounded-lg flex items-center justify-center border ${
                  idx < 5 
                    ? 'bg-tertiary/15 border-tertiary/20 text-tertiary' 
                    : 'bg-white/5 border-white/10 text-on-surface-variant/40'
                }`}>
                  <span className="material-symbols-outlined text-sm">{idx < 5 ? 'check' : 'remove'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
