import React, { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';
import { useAlarm } from '../context/AlarmContext';

export const Layout = () => {
  const { isDark, toggleTheme } = useTheme();
  const { currentTrack, isPlaying, togglePlay, progress } = useAudio();
  const { isRinging } = useAlarm();
  const location = useLocation();
  const navigate = useNavigate();

  // If the alarm triggers, automatically redirect the entire layout to the lockscreen alarm page
  useEffect(() => {
    if (isRinging) {
      navigate('/alarm-trigger');
    }
  }, [isRinging, navigate]);

  const navItems = [
    { label: 'Breathe', path: '/breathe', icon: 'air' },
    { label: 'Flow', path: '/morning-flow', icon: 'directions_run' },
    { label: 'Vibe', path: '/vibes', icon: 'groups' },
    { label: 'Profile', path: '/profile', icon: 'person' }
  ];

  // Check if we are on full-screen onboarding or alarm views where bottom bar should be hidden
  const hideNavigation = ['/onboarding', '/alarm-trigger', '/session-complete', '/landing'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 overflow-x-hidden">
      
      {/* Background decoration for desktop viewports */}
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none hidden md:block">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[120px]"></div>
      </div>

      {/* Main Smartphone Shell */}
      <div className="relative w-full max-w-md min-h-screen md:min-h-[840px] md:max-h-[850px] md:rounded-[3rem] md:border-[12px] md:border-surface-container-highest shadow-2xl flex flex-col bg-background overflow-hidden z-10 transition-all duration-300 md:ring-1 md:ring-white/10">
        
        {/* Mobile Status Bar Simulation (Desktop view only) */}
        <div className="hidden md:flex justify-between items-center px-8 pt-4 pb-2 text-[11px] text-on-surface/40 font-semibold select-none z-50 shrink-0">
          <span>09:41</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs">signal_cellular_4_bar</span>
            <span className="material-symbols-outlined text-xs">wifi</span>
            <span className="material-symbols-outlined text-xs">battery_full</span>
          </div>
        </div>

        {/* Global Page Header */}
        {!hideNavigation && (
          <header className="flex justify-between items-center px-6 py-4 w-full glass-panel border-b border-white/5 shrink-0 z-40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
              <h1 className="font-headline-md text-primary font-bold text-lg leading-none">Moonlight</h1>
            </div>
            <button onClick={toggleTheme} className="text-on-surface-variant p-2 rounded-full hover:bg-white/5 transition-transform active:scale-90">
              <span className="material-symbols-outlined text-xl">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </header>
        )}

        {/* Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto scroll-hide pb-28 pt-2 px-6">
          <Outlet />
        </div>

        {/* Global Persistent Mini-Player */}
        {currentTrack && !hideNavigation && (
          <div className="absolute bottom-20 left-4 right-4 z-40 glass-panel rounded-2xl p-3 flex items-center justify-between shadow-2xl border-white/10 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                <img className="w-full h-full object-cover" src={currentTrack.image} alt={currentTrack.title} />
              </div>
              <div className="overflow-hidden w-full">
                <h6 className="font-label-md text-on-surface truncate text-xs font-bold leading-none">{currentTrack.title}</h6>
                <div className="w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 ml-2 active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-lg">{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
          </div>
        )}

        {/* Mobile Floating Bottom Bar */}
        {!hideNavigation && (
          <nav className="absolute bottom-4 left-4 right-4 z-40 glass-panel rounded-full h-16 shadow-[0_10px_20px_rgba(149,72,53,0.15)] border border-white/10 flex justify-around items-center px-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center rounded-full transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary-container/80 text-on-primary-container px-5 py-1.5 active:scale-90 scale-105 shadow-md shadow-primary/10' 
                      : 'text-on-surface-variant/70 hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

      </div>
    </div>
  );
};